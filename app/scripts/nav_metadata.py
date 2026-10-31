"""Read only navigation records from the installed DataCore v8 database.

Uses the database's own schema sizes/offsets, not guessed POI names. Other
record types are skipped. Format reference: scdatatools forge/dftypes and
StarBreaker DataCore readers (linked in README). Unknown versions fail closed.
"""

import struct


def guid(raw):
    c, b, a = struct.unpack_from("<HHI", raw)
    tail = raw[8:][::-1].hex()
    return f"{a:08x}-{b:04x}-{c:04x}-{tail[:4]}-{tail[4:]}"


def navigation(data, localization, include_systems=False):
    h = struct.unpack_from("<30I", data)
    if h[1] != 8:
        raise ValueError(f"Unsupported DataCore version {h[1]}")
    ns, np, ne, nm, nr = h[4:9]
    if max(ns, np, ne, nm, nr) > 2000000:
        raise ValueError("Invalid DataCore counts")
    structures = [struct.unpack_from("<IIHHI", data, 120 + i * 16) for i in range(ns)]
    propbase = 120 + ns * 16
    mapbase = propbase + np * 12 + ne * 8
    recbase = mapbase + nm * 8
    pool = (
        recbase
        + nr * 36
        + sum(
            n * s
            for n, s in zip(
                h[9:28], [1, 1, 2, 4, 8, 1, 2, 4, 8, 4, 8, 16, 4, 4, 4, 8, 8, 20, 4]
            )
        )
    )
    pool2 = pool + h[28]
    instancebase = pool2 + h[29]

    def string(base, offset):
        start = base + offset
        if not base <= start < instancebase:
            raise ValueError("DataCore string offset out of bounds")
        return data[start : data.index(0, start, instancebase)].decode("utf-8")

    indexes = {string(pool2, s[0]): i for i, s in enumerate(structures)}
    target = indexes.get("StarMapObject")
    if target is None:
        raise ValueError("Missing StarMapObject schema")
    offsets = {}
    pos = instancebase
    for i in range(nm):
        count, index = struct.unpack_from("<II", data, mapbase + i * 8)
        offsets[index] = pos
        pos += count * structures[index][4]
    if pos != len(data):
        raise ValueError(
            "DataCore instance sizes do not match file; unsupported layout"
        )
    fields = {}
    size = 0
    s = structures[target]
    if s[1] != 0xFFFFFFFF:
        raise ValueError("Unexpected inherited StarMapObject layout")
    widths = {
        1: 1,
        2: 1,
        3: 2,
        4: 4,
        5: 8,
        6: 1,
        7: 2,
        8: 4,
        9: 8,
        10: 4,
        11: 4,
        12: 8,
        13: 4,
        14: 16,
        15: 4,
        272: 8,
        528: 8,
        784: 20,
    }
    for i in range(s[3], s[3] + s[2]):
        nameoff, index, typ, conversion, _ = struct.unpack_from(
            "<IHHHH", data, propbase + i * 12
        )
        name = string(pool2, nameoff)
        fields[name] = (size, typ, conversion)
        size += 8 if conversion else structures[index][4] if typ == 16 else widths[typ]
    if size != s[4]:
        raise ValueError("Navigation schema size mismatch")

    def layout(index):
        result = {}
        offset = 0
        definition = structures[index]
        for i in range(definition[3], definition[3] + definition[2]):
            no, sub, typ, conv, _ = struct.unpack_from(
                "<IHHHH", data, propbase + i * 12
            )
            result[string(pool2, no)] = (offset, typ, conv, sub)
            offset += 8 if conv else structures[sub][4] if typ == 16 else widths[typ]
        if offset != definition[4]:
            raise ValueError("DataCore property layout mismatch")
        return result

    type_index = indexes.get("StarMapObjectType")
    system_index = indexes.get("SSolarSystem")
    type_names = {}
    systems = []
    for i in range(nr):
        at = recbase + i * 36
        nameoff, _, _, index = struct.unpack_from("<4I", data, at)
        if index == type_index:
            type_names[guid(data[at + 16 : at + 32])] = string(pool2, nameoff).split(
                ".", 1
            )[-1]
        if index == system_index:
            instance = struct.unpack_from("<H", data, at + 32)[0]
            base = offsets[index] + instance * structures[index][4]
            lf = layout(index)
            name = string(pool, struct.unpack_from("<I", data, base + lf["Name"][0])[0])
            pos = struct.unpack_from("<3f", data, base + lf["galacticPosition"][0])
            systems.append(dict(id=name.lower(), name=name, position=list(pos)))
    result = {}
    for i in range(nr):
        at = recbase + i * 36
        nameoff, filename, _, index = struct.unpack_from("<4I", data, at)
        if index != target:
            continue
        key = guid(data[at + 16 : at + 32])
        instance = struct.unpack_from("<H", data, at + 32)[0]
        at = offsets[target] + instance * s[4]
        item = {"record": string(pool2, nameoff).removeprefix("StarMapObject.")}
        if "type" in fields:
            item["type"] = type_names.get(
                guid(data[at + fields["type"][0] + 4 : at + fields["type"][0] + 20]), ""
            )
        if "quantumTravelData" in fields:
            pointer = at + fields["quantumTravelData"][0]
            qi, qn = struct.unpack_from("<II", data, pointer)
            if qi != 0xFFFFFFFF and qn != 0xFFFFFFFF:
                base = offsets[qi] + qn * structures[qi][4]
                ql = layout(qi)
                item["quantum"] = {
                    n: struct.unpack_from("<f", data, base + off)[0]
                    for n, (off, typ, conv, _) in ql.items()
                    if typ == 11 and not conv
                }
        for name in [
            "name",
            "size",
            "hideInStarmap",
            "blockTravel",
            "showOrbitLine",
            "starMapGeomPath",
            "starMapMaterialPath",
            "locationImagePath",
        ]:
            if name not in fields:
                continue
            off, typ, conv = fields[name]
            off += at
            if conv:
                continue
            if typ in (10, 13):
                value = string(pool, struct.unpack_from("<I", data, off)[0])
                value = localization.get(value.lstrip("@").lower(), value)
            elif typ == 12:
                value = struct.unpack_from("<d", data, off)[0]
            elif typ == 11:
                value = struct.unpack_from("<f", data, off)[0]
            elif typ == 1:
                value = bool(data[off])
            else:
                continue
            item[name] = value
        result[key] = item
    return (result, systems) if include_systems else result
