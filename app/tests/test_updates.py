import json, struct, sys, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import server
import extract_game
from nav_metadata import navigation


class UpdateTests(unittest.TestCase):
    def test_unknown_datacore_fails_before_guessing_names(self):
        data = bytearray(120)
        struct.pack_into("<I", data, 4, 99)
        with self.assertRaisesRegex(ValueError, "version"):
            navigation(data, {})

    def test_bad_extraction_preserves_published_catalogue(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / "public").mkdir()
            (root / "storage").mkdir()
            (root / "Data.p4k").write_bytes(b"archive")
            catalog = root / "public/catalog.json"
            catalog.write_text("last good map")
            data = bytearray(120)
            struct.pack_into("<I", data, 4, 99)
            fake = SimpleNamespace(
                read=lambda name, *args: (
                    b"key=value" if name.endswith(".ini") else bytes(data)
                )
            )
            with patch.object(extract_game, "ROOT", root), patch.object(
                extract_game, "P4K", return_value=fake
            ):
                with self.assertRaises(ValueError):
                    extract_game.update(root, True)
            self.assertEqual(catalog.read_text(), "last good map")

    def test_hot_reload_replaces_catalogue_without_server_restart(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / "public").mkdir()
            (root / "public/catalog.json").write_text(
                json.dumps({"build": "test-patch", "bodies": [{"id": "new-location"}]})
            )
            with patch.multiple(
                server,
                ROOT=root,
                CATALOG=server.CATALOG,
                BODIES=server.BODIES,
                CATALOG_REVISION=server.CATALOG_REVISION,
            ):
                server.reload_catalog()
                self.assertIn("new-location", server.BODIES)
                self.assertEqual(server.CATALOG["build"], "test-patch")

    def test_watcher_waits_for_stability_and_updates_once_per_patch(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            archive = root / "Data.p4k"
            archive.write_bytes(b"first")

            class Stop:
                count = 0

                def is_set(self):
                    return self.count >= 6

                def wait(self, _):
                    self.count += 1
                    if self.count == 3:
                        archive.write_bytes(b"new patch changed size")

            with patch.object(server, "reload_catalog"), patch.object(
                server.subprocess, "run", return_value=SimpleNamespace(returncode=0)
            ) as run, patch.object(server, "UPDATE_STATUS", {}):
                server.game_watcher(root, Stop())
                self.assertEqual(run.call_count, 2)
                self.assertEqual(server.UPDATE_STATUS["state"], "ready")

    def test_failed_update_keeps_service_alive_and_exposes_error(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / "Data.p4k").write_bytes(b"bad patch")

            class Stop:
                count = 0

                def is_set(self):
                    return self.count >= 3

                def wait(self, _):
                    self.count += 1

            with patch.object(server, "reload_catalog"), patch.object(
                server.subprocess,
                "run",
                return_value=SimpleNamespace(
                    returncode=1, stdout="Unsupported new format", stderr=""
                ),
            ), patch.object(server, "UPDATE_STATUS", {}):
                server.game_watcher(root, Stop())
                self.assertEqual(server.UPDATE_STATUS["state"], "error")
                self.assertIn("Unsupported", server.UPDATE_STATUS["message"])


if __name__ == "__main__":
    unittest.main()
