#!/usr/bin/env python3
"""Create Android launcher assets from the existing GENDER WARFARE logo.

Requires Pillow: pip install Pillow
Run from repository root: python tools/build_android_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "game/ui/logo.webp"
OUT = ROOT / "android/app/src/main/res"
ART = ROOT / "assets_src/GENDER_WARFARE_android_icon_512.png"

logo = Image.open(SOURCE).convert("RGBA")
pix = logo.load()
coords = [(x, y) for y in range(logo.height) for x in range(logo.width)
          if pix[x, y][3] > 16 and max(pix[x, y][:3]) > 26]
if coords:
    xs, ys = zip(*coords)
    logo = logo.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

def icon(size):
    ss = 4 * size
    im = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    pen = ImageDraw.Draw(im)
    rad = round(ss * 0.19)
    pen.rounded_rectangle((0, 0, ss - 1, ss - 1), radius=rad, fill=(14, 13, 18, 255))
    for i in range(round(ss * 0.02), round(ss * 0.12)):
        c = int(42 - 28 * i / (ss * 0.12))
        pen.rounded_rectangle((i, i, ss - 1 - i, ss - 1 - i),
                              radius=max(0, rad - i), outline=(min(130, c + 48), c, c // 2, 255))
    pen.rounded_rectangle((int(ss * .07), int(ss * .07), int(ss * .93), int(ss * .93)),
                          radius=int(ss * .14), outline=(180, 133, 66, 255), width=max(2, int(ss * .004)))
    k = min(ss * .86 / logo.width, ss * .78 / logo.height)
    scaled = logo.resize((int(logo.width * k), int(logo.height * k)), Image.Resampling.LANCZOS)
    im.alpha_composite(scaled, ((ss - scaled.width) // 2, (ss - scaled.height) // 2))
    return im.resize((size, size), Image.Resampling.LANCZOS)

for density, size in (("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)):
    folder = OUT / ("mipmap-" + density)
    folder.mkdir(parents=True, exist_ok=True)
    image = icon(size)
    for filename in ("ic_launcher.png", "ic_launcher_round.png"):
        image.save(folder / filename, optimize=True)

ART.parent.mkdir(parents=True, exist_ok=True)
icon(512).save(ART, optimize=True)
print("Generated GENDER WARFARE Android launcher PNGs.")
