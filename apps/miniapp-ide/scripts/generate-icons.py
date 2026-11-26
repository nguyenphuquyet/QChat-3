#!/usr/bin/env python3
"""Generate every app/installer icon of QChat Mini App Studio from one PNG.

Usage (from anywhere):

    python scripts/generate-icons.py "C:/path/to/logo.png"

The source is a single square PNG. The script writes, inside
`src-tauri/icons/`:

  icon.ico            16/24/32/48/64/128/256 - Windows app + NSIS setup icon
  icon.icns           16/32/64/128/256/512/1024 - macOS bundle icon
  icon.png            1024x1024 master
  32x32.png           32x32
  64x64.png           64x64
  128x128.png         128x128
  128x128@2x.png      256x256
  Square*Logo.png     Windows Store logos (30/44/71/89/107/142/150/284/310)
  StoreLogo.png       50x50 Windows Store logo
  source/<name>.png   1024x1024 copy of the artwork, kept for regeneration

Requires Pillow (`python -m pip install Pillow`).

The NSIS installer icon comes from the same `icon.ico`, wired up through
`bundle.windows.nsis.installerIcon` / `uninstallerIcon` in tauri.conf.json.
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri" / "icons"

ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)

# macOS icon types: (icns type, pixel size). PNG payloads are accepted for
# every one of these on macOS 10.7+.
ICNS_ENTRIES = (
    ("icp4", 16),
    ("icp5", 32),
    ("ic11", 32),  # 16x16@2x
    ("ic12", 64),  # 32x32@2x
    ("ic07", 128),
    ("ic13", 256),  # 128x128@2x
    ("ic08", 256),
    ("ic14", 512),  # 256x256@2x
    ("ic09", 512),
    ("ic10", 1024),
)

SQUARE_LOGOS = (30, 44, 71, 89, 107, 142, 150, 284, 310)


def load_master(source: Path) -> Image.Image:
    image = Image.open(source)
    image.load()
    image = image.convert("RGBA")
    width, height = image.size
    if width != height:
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
        print(f"source was {width}x{height}; centre-cropped to {side}x{side}")
    if image.width > 1024:
        image = image.resize((1024, 1024), Image.LANCZOS)
    return image


def scaled(master: Image.Image, size: int) -> Image.Image:
    if master.width == size:
        return master.copy()
    return master.resize((size, size), Image.LANCZOS)


def write_png(master: Image.Image, size: int, path: Path) -> None:
    scaled(master, size).save(path, format="PNG", optimize=True)


def write_ico(master: Image.Image, path: Path) -> None:
    # Pillow writes a BMP entry for every size below 256 and an embedded PNG
    # for 256; that is exactly what Windows Explorer and NSIS expect.
    master.save(path, format="ICO", sizes=[(s, s) for s in ICO_SIZES])


def write_icns(master: Image.Image, path: Path) -> None:
    import io

    chunks = bytearray()
    for kind, size in ICNS_ENTRIES:
        buffer = io.BytesIO()
        scaled(master, size).save(buffer, format="PNG", optimize=True)
        payload = buffer.getvalue()
        chunks += kind.encode("ascii")
        chunks += struct.pack(">I", len(payload) + 8)
        chunks += payload

    header = b"icns" + struct.pack(">I", len(chunks) + 8)
    path.write_bytes(header + bytes(chunks))


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2

    source = Path(argv[1]).expanduser()
    if not source.is_file():
        print(f"error: source image not found: {source}")
        return 1

    ICONS.mkdir(parents=True, exist_ok=True)
    (ICONS / "source").mkdir(parents=True, exist_ok=True)

    master = load_master(source)
    print(f"master: {master.width}x{master.height}")

    write_ico(master, ICONS / "icon.ico")
    write_icns(master, ICONS / "icon.icns")
    write_png(master, 1024, ICONS / "icon.png")
    write_png(master, 32, ICONS / "32x32.png")
    write_png(master, 64, ICONS / "64x64.png")
    write_png(master, 128, ICONS / "128x128.png")
    write_png(master, 256, ICONS / "128x128@2x.png")
    write_png(master, 50, ICONS / "StoreLogo.png")
    for size in SQUARE_LOGOS:
        write_png(master, size, ICONS / f"Square{size}x{size}Logo.png")

    artwork = ICONS / "source" / "qchat-app-icon.png"
    write_png(master, 1024, artwork)

    print(f"wrote {len(list(ICONS.iterdir()))} entries into {ICONS}")
    print(f"kept artwork at {artwork}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
