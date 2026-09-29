#!/usr/bin/env python3
"""
Rebuild the social share image (assets/img/og.jpg, 1200x630) from a story cover.

    python3 tools/make_og.py              # uses desert-arc
    python3 tools/make_og.py my-story

Needs:  python3 -m pip install pillow fonttools brotli
"""
import sys
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
story = sys.argv[1] if len(sys.argv) > 1 else "desert-arc"

ttf = Path(tempfile.gettempdir()) / "bricolage.ttf"
font_file = TTFont(ROOT / "assets/fonts/bricolage-grotesque.woff2")
font_file.flavor = None
font_file.save(ttf)


def font(size, weight):
    f = ImageFont.truetype(str(ttf), size)
    f.set_variation_by_axes([weight])
    return f


W, H = 1200, 630
cover = Image.open(ROOT / f"stories/{story}/cover.jpg").convert("RGB")
og = Image.new("RGB", (W, H), (11, 11, 12))
ambient = ImageEnhance.Brightness(cover.resize((W, H)).filter(ImageFilter.GaussianBlur(60))).enhance(0.5)
og = Image.blend(og, ambient, 0.6)

ch = H - 84
cw = int(ch * 4 / 5)
mask = Image.new("L", (cw, ch), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=24, fill=255)
og.paste(cover.resize((cw, ch)), (W - cw - 42, 42), mask)

d = ImageDraw.Draw(og)
logo = Image.open(ROOT / "assets/img/logo.png").resize((56, 56))
og.paste(logo, (64, 64), logo)
d.text((132, 76), "SEEQUENCE", font=font(30, 650), fill=(246, 243, 238))
d.text((132 + d.textlength("SEEQUENCE", font=font(30, 650)) + 12, 82), "by BlackSheep", font=font(22, 420), fill=(200, 196, 190))
for i, line in enumerate(["STORIES", "THAT NEVER", "END."]):
    d.text((60, 200 + i * 92), line, font=font(96, 720), fill=(246, 243, 238))
d.text((64, 540), "Vertical comics that scroll forever.", font=font(26, 420), fill=(200, 196, 190))

og.save(ROOT / "assets/img/og.jpg", quality=86, optimize=True, progressive=True)
print("assets/img/og.jpg updated")
