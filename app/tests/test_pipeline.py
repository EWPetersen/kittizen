import io, json, sys, tempfile, unittest, zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from update_game_data import read_catalog_xml, ENTRY, fingerprint
from build_catalog import build, ROOT


class PipelineTests(unittest.TestCase):
    def archive(self, root, xml=b"<ObjectContainer/>", inner_name="stantonsystem.xml"):
        inner = io.BytesIO()
        with zipfile.ZipFile(inner, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr(inner_name, xml)
        p = root / "Data.p4k"
        with zipfile.ZipFile(p, "w") as z:
            z.writestr(ENTRY, inner.getvalue())
        return p

    def test_extract_target_without_unpacking_other_files(self):
        with tempfile.TemporaryDirectory() as t:
            p = self.archive(Path(t))
            self.assertEqual(read_catalog_xml(p), b"<ObjectContainer/>")
            self.assertEqual(len(list(Path(t).iterdir())), 1)

    def test_missing_container(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / "empty.zip"
            with zipfile.ZipFile(p, "w") as z:
                z.writestr("other.xml", "x")
            with self.assertRaises((ValueError, FileNotFoundError)):
                read_catalog_xml(p)

    def test_missing_xml_and_binary_format(self):
        with tempfile.TemporaryDirectory() as t:
            for xml, name in [
                (b"CryXmlB\x00", "stantonsystem.xml"),
                (b"<x/>", "different.xml"),
            ]:
                with self.assertRaises(ValueError):
                    read_catalog_xml(self.archive(Path(t), xml, name))

    def test_bad_input_preserves_catalogue(self):
        with tempfile.TemporaryDirectory() as t:
            source = Path(t) / "bad.xml"
            source.write_text("<ObjectContainer/>")
            out = Path(t) / "catalog.json"
            out.write_text("previous catalogue")
            with self.assertRaises(ValueError):
                build(source, out)
            self.assertEqual(out.read_text(), "previous catalogue")

    def test_deterministic_and_parent_coordinates(self):
        with tempfile.TemporaryDirectory() as t:
            out = Path(t) / "catalog.json"
            source = ROOT / "data2/scuniverse/stanton/stantonsystem.xml"
            first = build(source, out)
            raw = out.read_bytes()
            second = build(source, out)
            self.assertEqual(first, second)
            self.assertEqual(raw, out.read_bytes())
            self.assertFalse(first["currentBuildVerified"])
            self.assertEqual(first["units"], "metres")

    def test_fingerprint_detects_manifest_changes(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            self.archive(root)
            first = fingerprint(root)
            (root / "build_manifest.id").write_text("new")
            self.assertNotEqual(first, fingerprint(root))


if __name__ == "__main__":
    unittest.main()
