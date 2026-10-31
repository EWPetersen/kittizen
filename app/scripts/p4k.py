"""Read selected P4K entries without unpacking the game or holding its full index.

ZIP64 offsets are standard; CIG's trailing extra fields and central method IDs
are not. The actual local header determines decoding. No game writes occur.
"""

import io
import struct
import zipfile
import zlib
from pathlib import Path


class P4K:
    def __init__(self, path):
        self.path = Path(path)
        self.entries = {}
        self.count = 0
        with self.path.open("rb") as f:
            f.seek(0, 2)
            length = f.tell()
            f.seek(max(0, length - 65557))
            tail = f.read()
            at = tail.rfind(b"PK\x05\x06")
            if at < 0:
                raise ValueError("Missing ZIP directory")
            offset = struct.unpack_from("<I", tail, at + 16)[0]
            if offset == 0xFFFFFFFF:
                locator = tail[at - 20 : at]
                if locator[:4] != b"PK\x06\x07":
                    raise ValueError("Missing ZIP64 locator")
                f.seek(struct.unpack_from("<Q", locator, 8)[0])
                record = f.read(56)
                if record[:4] != b"PK\x06\x06":
                    raise ValueError("Invalid ZIP64 directory")
                offset = struct.unpack_from("<Q", record, 48)[0]
            f.seek(offset)
            while True:
                h = f.read(46)
                if h[:4] != b"PK\x01\x02":
                    break
                nl, el, cl = struct.unpack_from("<HHH", h, 28)
                name = (
                    f.read(nl)
                    .decode("utf-8", errors="replace")
                    .replace("\\", "/")
                    .lower()
                )
                extra = f.read(el)
                f.seek(cl, 1)
                self.count += 1
                if not (
                    name.endswith(".socpak")
                    or "starmap" in name
                    or name.endswith("/english/global.ini")
                    or name.endswith("game2.dcb")
                ):
                    continue
                compressed, size = struct.unpack_from("<II", h, 20)
                local = struct.unpack_from("<I", h, 42)[0]
                if extra[:2] == b"\x01\x00":
                    pos = 4
                    if size == 0xFFFFFFFF:
                        size = struct.unpack_from("<Q", extra, pos)[0]
                        pos += 8
                    if compressed == 0xFFFFFFFF:
                        compressed = struct.unpack_from("<Q", extra, pos)[0]
                        pos += 8
                    if local == 0xFFFFFFFF:
                        local = struct.unpack_from("<Q", extra, pos)[0]
                self.entries[name] = (local, compressed, size)
        if not self.count:
            raise ValueError("Empty or unsupported archive index")

    def read(self, name, limit=64 * 1024 * 1024):
        name = name.replace("\\", "/").lower()
        if name not in self.entries:
            raise FileNotFoundError(name)
        offset, compressed, size = self.entries[name]
        if max(compressed, size) > limit:
            raise ValueError(f"Entry too large: {name}")
        with self.path.open("rb") as f:
            f.seek(offset)
            h = f.read(30)
            if h[:4] != b"PK\x03\x04":
                raise ValueError("Invalid local header")
            flags, method = struct.unpack_from("<HH", h, 6)
            nl, el = struct.unpack_from("<HH", h, 26)
            if flags & 1:
                raise ValueError("Encrypted entry unsupported")
            f.seek(nl + el, 1)
            raw = f.read(compressed)
        if method == 0:
            data = raw
        elif method == 8:
            data = zlib.decompress(raw, -15)
        elif method in (93, 100):
            try:
                import zstandard
            except ImportError:
                raise ValueError(
                    "Zstandard extraction requires: pip install -r app/scripts/requirements.txt"
                )
            data = zstandard.ZstdDecompressor().decompress(raw, max_output_size=limit)
        else:
            raise ValueError(f"Unsupported compression {method}: {name}")
        if len(data) != size:
            raise ValueError(f"Entry size mismatch: {name}")
        return data

    def container(self, name):
        """Return the root XML from a nested object container, CRC checked by zipfile."""
        with zipfile.ZipFile(io.BytesIO(self.read(name))) as z:
            target = Path(name).stem.lower() + ".xml"
            entry = next(
                (
                    i
                    for i in z.infolist()
                    if i.filename.replace("\\", "/").lower() == target
                ),
                None,
            )
            if not entry or entry.file_size > 16 * 1024 * 1024:
                raise ValueError(f"Missing container XML: {name}")
            xml = z.read(entry)
            if not xml.lstrip().startswith(b"<"):
                raise ValueError(f"Binary CryXML unsupported: {name}")
            return xml
