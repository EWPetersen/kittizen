"""Build a small, provenance-labelled catalogue from the retained game XML.
CryEngine rotations are w,x,y,z; children inherit the parent's full transform.
No game installation files are modified or redistributed.
"""

import json, re, math, sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from routing import orbit_markers


def mul(a, b):
    w, x, y, z = a
    W, X, Y, Z = b
    return (
        w * W - x * X - y * Y - z * Z,
        w * X + x * W + y * Z - z * Y,
        w * Y - x * Z + y * W + z * X,
        w * Z + x * Y - y * X + z * W,
    )


def rotate(q, v):
    n = math.sqrt(sum(x * x for x in q))
    if n < 1e-12:
        raise ValueError("Invalid zero-length container quaternion")
    q = tuple(x / n for x in q)
    return mul(mul(q, (0, *v)), (q[0], -q[1], -q[2], -q[3]))[1:]


def build(
    source=None,
    output=None,
    installed=False,
    resolver=None,
    metadata=None,
    assets=None,
    system="Stanton",
):
    source = (
        Path(source) if source else ROOT / "data2/scuniverse/stanton/stantonsystem.xml"
    )
    tree = ET.parse(source)
    bodies = []
    metadata = metadata or {}
    assets = assets or {}
    emitted = set()
    expanded = set()

    def walk(el, position=(0, 0, 0), rotation=(1, 0, 0, 0), parent=None):
        for child in el.findall("./ChildObjectContainers/Child"):
            local = tuple(map(float, child.get("pos", "0,0,0").split(",")))
            p = tuple(a + b for a, b in zip(position, rotate(rotation, local)))
            q = mul(rotation, tuple(map(float, child.get("rot", "1,0,0,0").split(","))))
            name = child.get("entityName", "")
            path = child.get("name", "").lower()
            kind = ""
            record_id = child.get("starMapRecord", "")
            meta = metadata.get(record_id, {})
            label = name.replace("OOC_", "").replace("_", " ")
            if name == "OOC_Stanton":
                kind = "star"
                label = "Stanton"
            elif re.match(r"OOC_Stanton_[1-4]_", name):
                kind = "planet"
                label = name.split("_")[-1].replace("Microtech", "microTech")
            elif re.match(r"OOC_Stanton_[1-4][a-d]_", name):
                kind = "moon"
                label = name.split("_")[-1]
            elif "lagrangepoints/" in path and re.search(
                r"stanton([1-4])_(l\d)\.socpak$", path
            ):
                kind = "lagrange"
                m = re.search(r"stanton([1-4])_(l\d)", path)
                label = ["", "HUR", "CRU", "ARC", "MIC"][int(m[1])] + "-" + m[2].upper()
            elif "jumppoint_" in path:
                kind = "gateway"
                label = path.split("_")[-1].split(".")[0].title() + " Gateway"
            elif "commarray" in path:
                kind = "comm"
                label = (
                    next((b["name"] for b in bodies if b["id"] == parent), "")
                    + " Comm Array"
                )
            elif "station" in path or "reststop" in path:
                kind = "station"
                label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", label)
            elif record_id and meta:
                kind = "poi"
            if system != "Stanton":
                if name.lower() == system.lower() + "star":
                    kind = "star"
                    label = system
                elif re.fullmatch(system + r"[1-9]", meta.get("record", ""), re.I):
                    kind = "planet"
                elif re.fullmatch(system + r"[1-9][a-z]", meta.get("record", ""), re.I):
                    kind = "moon"
                elif (
                    meta.get("showOrbitLine")
                    and meta.get("size", 0) > 5000
                    and "sphere" in meta.get("starMapGeomPath", "").lower()
                ):
                    kind = "body"
                elif re.search(r"/lagrangepoints/[^/]+_l\d\.socpak$", path):
                    kind = "lagrange"
                elif re.search(r"jumppoint_[^/]+\.socpak$", path):
                    kind = "gateway"
                elif "commarray" in path:
                    kind = "comm"
            if meta.get("name") and not meta["name"].startswith("@"):
                label = meta["name"].strip()
            if (
                metadata
                and kind
                not in ("star", "planet", "moon", "body", "gateway", "lagrange", "comm")
                and not record_id
            ):
                kind = ""
            if (
                kind
                not in ("star", "planet", "moon", "body", "gateway", "lagrange", "comm")
                and record_id
            ):
                kind = (
                    "station"
                    if any(
                        t in meta.get("starMapGeomPath", "").lower()
                        for t in ("station", "reststop")
                    )
                    else "poi"
                )
            if kind not in (
                "star",
                "planet",
                "moon",
                "body",
                "lagrange",
                "gateway",
            ) and meta.get("hideInStarmap"):
                kind = ""
            current = parent
            identity = (
                name
                if kind in ("star", "planet", "moon", "lagrange", "gateway", "comm")
                else "nav:" + record_id if record_id else name
            )
            if system != "Stanton":
                identity = system.lower() + ":" + identity
            if kind and identity not in emitted:
                emitted.add(identity)
                bodies.append(
                    dict(
                        id=identity,
                        name=label,
                        kind=kind,
                        parent=parent,
                        position=list(p),
                        local=list(local),
                        rotation=list(q),
                        radius=(
                            meta.get("size", 0)
                            if kind in ("planet", "moon", "body")
                            else 0
                        ),
                        system=system.lower(),
                        quantum=meta.get("quantum", {}),
                        destinationSystem=(
                            re.search(r"jumppoint_\w+?_(\w+)\.socpak", path)[1]
                            if kind == "gateway"
                            and re.search(r"jumppoint_\w+?_(\w+)\.socpak", path)
                            else None
                        ),
                        navigationRecord=record_id,
                        source=path or child.get("class", ""),
                        texture=assets.get(meta.get("record")),
                        jumpable=not meta.get("blockTravel", False),
                        hidden=bool(meta.get("hideInStarmap", False))
                        and kind != "gateway",
                        category=(
                            "auxiliary"
                            if kind not in ("star", "planet", "moon")
                            and "planet_sphere"
                            in meta.get("starMapGeomPath", "").lower()
                            else "navigation"
                        ),
                    )
                )
            if kind:
                current = identity
            walk(child, p, q, current)
            # Planetary containers contain surface POIs and orbital facilities;
            # Lagrange containers contain the rest stops missing from system XML.
            structural = (
                not kind
                and child.get("class") == "OrbitingObjectContainer"
                and path.startswith(
                    "data/objectcontainers/pu/system/" + system.lower() + "/"
                )
            )
            if (
                resolver
                and (
                    kind in ("star", "planet", "moon", "body", "lagrange", "gateway")
                    or structural
                )
                and path
                and path not in expanded
            ):
                expanded.add(path)
                external = ET.fromstring(resolver(path))
                walk(external, p, q, current)

    walk(tree.getroot())
    if system == "Stanton" and len([b for b in bodies if b["kind"] == "planet"]) != 4:
        raise ValueError("Expected four Stanton planets; catalogue was not replaced.")
    expected = {"Pyro": 6, "Nyx": 3}.get(system)
    if expected and sum(b["kind"] == "planet" for b in bodies) != expected:
        raise ValueError(f"Incomplete {system} planetary catalogue")
    if len({b["id"] for b in bodies}) != len(bodies):
        raise ValueError("Duplicate location IDs; catalogue was not replaced.")
    if any(not all(math.isfinite(v) for v in b["position"]) for b in bodies):
        raise ValueError("Non-finite coordinates")
    bodies.extend(marker for body in list(bodies) if body['kind'] in ('planet','moon') and body.get('radius',0)>0 for marker in orbit_markers(body))
    result = dict(
        system=system,
        units="metres",
        source=source.name,
        build=tree.getroot().get("editorBuildChangelist"),
        currentBuildVerified=installed,
        schemaVersion=2,
        frame="CryEngine reference pose; metres; composed parent transforms",
        bodies=bodies,
    )
    out = Path(output) if output else ROOT / "app/public/catalog.json"
    temp = out.with_suffix(".tmp")
    temp.write_text(
        json.dumps(result, separators=(",", ":"), allow_nan=False), encoding="utf-8"
    )
    temp.replace(out)
    print(f"Built {len(bodies)} locations, {out.stat().st_size} bytes")
    return result


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path)
    a = p.parse_args()
    build(a.source)
