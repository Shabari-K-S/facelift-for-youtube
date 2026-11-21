"""Generate the two-tone thumbnail-and-caption mark, without image libraries."""
from pathlib import Path
import struct
import zlib


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


directory = Path(__file__).resolve().parents[1] / "public/icons"
directory.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            # Work on a 32-unit pixel grid to keep the small mark legible.
            col, row = (x + .5) * 32 / size, (y + .5) * 32 / size
            inside = 1 <= col < 31 and 2 <= row < 30
            frame = 5 <= col < 27 and 6 <= row < 21
            triangle = 13 <= col and abs(row - 13.5) < (21 - col) * .64
            caption = 5 <= col < 20 and 24 <= row < 26
            ink = 250 if (frame and not triangle) or caption else 37
            rows.extend((ink, ink, ink, 255 if inside else 0))
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    (directory / f"{size}.png").write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                                           + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))
