"""Repeatable, targeted extraction of live navigation data and starmap textures."""

import argparse, hashlib, io, json, os, struct, sys, time
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".extractor"))
from build_catalog import build
from nav_metadata import navigation
from p4k import P4K

ENTRY = "data/objectcontainers/pu/system/stanton/stantonsystem.socpak"
PIPELINE_VERSION = 13


def fingerprint(game):
    st = (game / "Data.p4k").stat()
    manifest = game / "build_manifest.id"
    return dict(
        size=st.st_size,
        mtime_ns=st.st_mtime_ns,
        manifest=(
            hashlib.sha256(manifest.read_bytes()).hexdigest()
            if manifest.exists()
            else None
        ),
    )


def read_catalog_xml(archive):
    return P4K(archive).container(ENTRY)


def texture_png(archive, name, max_size=512):
    """Decode a 512px mip directly; never unpack 4K textures for a phone."""
    from PIL import Image

    raw = archive.read(name)
    if raw[:4] != b"DDS ":
        raise ValueError("Invalid DDS texture")
    header = bytearray(raw[: 148 if raw[84:88] == b"DX10" else 128])
    height, width = struct.unpack_from("<II", raw, 12)
    parts = [
        (int(k.rsplit(".", 1)[1]), k)
        for k in archive.entries
        if k.startswith(name + ".") and k.rsplit(".", 1)[1].isdigit()
    ]
    if parts:
        parts.sort(reverse=True)
        largest = parts[0][0]
        skip = max(0, (max(width, height) // max_size).bit_length() - 1)
        level = max(1, largest - skip)
        selected = next((k for n, k in parts if n == level), parts[-1][1])
        target = max(width, height) // (2 ** (largest - level))
        divisor = 2 ** (largest - level)
        struct.pack_into(
            "<II", header, 12, max(1, height // divisor), max(1, width // divisor)
        )
        struct.pack_into("<I", header, 28, 1)
        image = Image.open(io.BytesIO(bytes(header) + archive.read(selected))).convert(
            "RGBA"
        )
    else:
        image = Image.open(io.BytesIO(raw)).convert("RGBA")
    image.thumbnail((max_size, max_size))
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()


def update(game, force=False):
    state = ROOT / "storage/game-update.json"
    state.parent.mkdir(parents=True, exist_ok=True)
    before = fingerprint(game)
    catalog = ROOT / "public/catalog.json"
    try:
        previous = json.loads(state.read_text()) if state.exists() else {}
    except (ValueError, OSError):
        previous = {}
    if (
        not force
        and previous.get("pipeline") == PIPELINE_VERSION
        and previous.get("fingerprint") == before
        and catalog.exists()
        and previous.get("catalog_sha256")
        == hashlib.sha256(catalog.read_bytes()).hexdigest()
        and all((ROOT / "public" / p).exists() for p in previous.get("assets", []))
    ):
        print("Game unchanged; catalogue and textures are current.", flush=True)
        return False
    print(
        "Indexing game archive; extracting navigation, body containers and map textures...",
        flush=True,
    )
    archive = P4K(game / "Data.p4k")
    localization = {}
    for line in (
        archive.read("data/localization/english/global.ini", 32 * 1024 * 1024)
        .decode("utf-8-sig")
        .splitlines()
    ):
        if "=" in line:
            key, value = line.split("=", 1)
            normal = key.split(",", 1)[0].lower()
            if normal not in localization or "," not in key:
                localization[normal] = value
    nav, systems = navigation(
        archive.read("data/game2.dcb", 512 * 1024 * 1024), localization, True
    )
    systems = [s for s in systems if s["id"] in ("stanton", "pyro", "nyx")]
    if {s["id"] for s in systems} != {"stanton", "pyro", "nyx"}:
        raise ValueError("Incomplete installed system definitions")
    stamp = hashlib.sha256(
        (json.dumps(before, sort_keys=True) + str(PIPELINE_VERSION)).encode()
    ).hexdigest()[:16]
    destination = ROOT / "public/game-assets" / stamp
    destination.mkdir(parents=True, exist_ok=True)
    assets = {};detail_assets={}
    asset_paths = []
    for entry in archive.entries:
        if entry.startswith(
            (
                "data/ui/starmap/textures/stanton/",
                "data/ui/starmap/textures/pyro/",
                "data/ui/starmap/textures/nyx/",
            )
        ) and entry.endswith(".dds"):
            basename = Path(entry).stem
            matching = [
                m
                for m in nav.values()
                if Path(
                    m.get("starMapMaterialPath", "").replace("\\", "/")
                ).stem.lower()
                == basename
            ]
            if not matching:
                continue
            path = destination / (basename + ".png")
            temp = path.with_suffix(".tmp")
            try:
                temp.write_bytes(texture_png(archive, entry))
            except (OSError, ValueError) as e:
                raise ValueError(f"Texture {entry}: {e}")
            temp.replace(path)
            relative = path.relative_to(ROOT / "public").as_posix()
            asset_paths.append(relative)
            detail=texture_png(archive,entry,1024)
            if detail!=path.read_bytes():
                detail_path=destination/(basename+'-detail.png');detail_path.write_bytes(detail)
                detail_relative=detail_path.relative_to(ROOT/'public').as_posix();asset_paths.append(detail_relative);detail_assets[relative]=detail_relative
            for m in matching:
                assets[m["record"]] = relative
    if len(assets) < 30:
        raise ValueError(
            "Incomplete body texture extraction; previous catalogue retained"
        )
    cache = {}

    def resolver(path):
        if path not in cache:
            cache[path] = archive.container(path)
        return cache[path]

    staged = ROOT / "storage/catalog-next.json"
    results = []
    for system in systems:
        entry = f'data/objectcontainers/pu/system/{system["id"]}/{system["id"]}system.socpak'
        source = ROOT / "storage" / (system["id"] + "system.xml")
        source.write_bytes(resolver(entry))
        part = build(
            source,
            staged,
            installed=True,
            resolver=resolver,
            metadata=nav,
            assets=assets,
            system=system["name"],
        )
        system["build"] = part["build"]
        results.append(part)
    result = results[0]
    result["bodies"] = [b for part in results for b in part["bodies"]]
    for body in result['bodies']:
        if body.get('texture') in detail_assets:body['textureDetail']=detail_assets[body['texture']]
    result["systems"] = systems
    result["system"] = "Universe"
    result["generation"] = stamp
    result["galacticUnits"] = "game galactic coordinates (not metres)"
    from map_models import extract_models
    asset_paths.extend(extract_models(archive,result,nav,ROOT))
    from star_materials import extract_stars
    asset_paths.extend(extract_stars(archive,result,nav,ROOT))
    from location_art import extract_location_art
    asset_paths.extend(extract_location_art(archive,result,nav,ROOT))
    from environment_assets import extract_environment
    asset_paths.extend(extract_environment(archive,result,ROOT))
    staged.write_text(
        json.dumps(result, separators=(",", ":"), allow_nan=False), encoding="utf-8"
    )
    if len(result["bodies"]) < 150:
        raise ValueError(
            "Surface navigation extraction incomplete; previous catalogue retained"
        )
    if fingerprint(game) != before:
        raise ValueError("Game changed during extraction; retry after patch completes")
    os.replace(staged, catalog)
    record = dict(
        pipeline=PIPELINE_VERSION,
        fingerprint=before,
        build=result["build"],
        extracted=time.time(),
        catalog_sha256=hashlib.sha256(catalog.read_bytes()).hexdigest(),
        assets=asset_paths,
        locations=len(result["bodies"]),
        containers=len(cache),
        navigationRecords=len(nav),
    )
    temp = state.with_suffix(".tmp")
    temp.write_text(json.dumps(record, indent=2))
    temp.replace(state)
    print(
        f'Published {len(result["bodies"])} locations, {len(assets)} body textures, {len(cache)} containers. Running app will reload automatically.',
        flush=True,
    )
    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument(
        "--game",
        type=Path,
        default=Path(r"D:\Games\Roberts Space Industries\StarCitizen\LIVE"),
    )
    p.add_argument("--force", action="store_true")
    p.add_argument("--watch", action="store_true")
    a = p.parse_args()
    while True:
        try:
            update(a.game, a.force)
            if (ROOT/'public/v2-catalog.json').exists():
                from build_v2_catalog import run as update_v2
                update_v2(a.game,a.force)
            a.force = False
        except (OSError, ValueError, struct.error, ET.ParseError, ImportError) as e:
            print(f"Update failed; last good catalogue retained: {e}", flush=True)
            if not a.watch:
                raise SystemExit(1)
        if not a.watch:
            break
        time.sleep(60)


if __name__ == "__main__":
    main()
