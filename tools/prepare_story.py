#!/usr/bin/env python3
"""
Prepare a story folder for the reader.

    python3 tools/prepare_story.py desert-arc            # WebP copies + cover + stories.json sizes
    python3 tools/prepare_story.py desert-arc --teasers  # also rebuild the "coming soon" teaser crops

What it does, for stories/<id>/:
  * every 01.jpg, 02.jpg ... gets a sibling 01.webp (the reader serves WebP, JPG is the fallback)
  * cover.jpg / cover.webp  - a portrait crop of the first panel for the homepage card
                              (+ cover-ambient.jpg, a tiny copy used as a soft glow)
  * updates the story's entry in stories.json with the image count, width and each panel's
    size, so the reader can reserve space before images load (no layout shift)

Needs Pillow:  python3 -m pip install pillow
"""
import argparse
import json
import random
import sys
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    sys.exit("Pillow is required:  python3 -m pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
WEBP_QUALITY = 82
COVER_WIDTH = 840
TEASER_WIDTH = 420


def panels_in(folder: Path):
    files = sorted(p for p in folder.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png") and p.stem.isdigit())
    if not files:
        sys.exit(f"No numbered images (01.jpg, 02.jpg ...) found in {folder}")
    return files


def to_webp(src: Path):
    with Image.open(src) as im:
        im.convert("RGB").save(src.with_suffix(".webp"), "WEBP", quality=WEBP_QUALITY, method=6)
        return im.size


def crop_ratio(im: Image.Image, ratio: float, anchor_y: float):
    """Crop to width/height == ratio, sliding the window vertically to anchor_y (0 top, 1 bottom)."""
    w, h = im.size
    ch = min(h, int(w / ratio))
    cw = int(ch * ratio)
    x = (w - cw) // 2
    y = int((h - ch) * anchor_y)
    return im.crop((x, y, x + cw, y + ch))


def save_pair(im: Image.Image, base: Path, quality=80):
    im = im.convert("RGB")
    im.save(base.with_suffix(".jpg"), "JPEG", quality=quality, optimize=True, progressive=True)
    im.save(base.with_suffix(".webp"), "WEBP", quality=quality, method=6)


def make_cover(first: Path, out: Path):
    with Image.open(first) as im:
        crop = crop_ratio(im, 4 / 5, 0.18)
        crop = crop.resize((COVER_WIDTH, int(COVER_WIDTH * 5 / 4)), Image.LANCZOS)
        save_pair(crop, out, quality=82)
        # a tiny copy the browser upscales into a soft ambient glow behind the card
        tiny = crop.resize((42, int(42 * 5 / 4)), Image.LANCZOS).convert("RGB")
        tiny.save(out.with_name("cover-ambient.jpg"), "JPEG", quality=70)


def make_teasers(files, out_dir: Path, count=4):
    """Heavily blurred, darkened, grainy crops for the coming-soon cards."""
    out_dir.mkdir(parents=True, exist_ok=True)
    rnd = random.Random(42)
    picks = [files[i % len(files)] for i in (2, 4, 6, 8)][:count]
    for n, src in enumerate(picks, start=2):
        with Image.open(src) as im:
            crop = crop_ratio(im.convert("RGB"), 4 / 5, rnd.uniform(0.2, 0.8))
            crop = crop.resize((TEASER_WIDTH, int(TEASER_WIDTH * 5 / 4)), Image.LANCZOS)
            crop = crop.filter(ImageFilter.GaussianBlur(9))
            crop = ImageEnhance.Brightness(crop).enhance(0.55)
            crop = ImageEnhance.Color(crop).enhance(0.8)
            noise = Image.effect_noise(crop.size, 42).convert("RGB")
            crop = Image.blend(crop, noise, 0.08)
            save_pair(crop, out_dir / f"teaser-{n:02d}", quality=70)
    print(f"  teasers -> {out_dir.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id", help="story folder name inside stories/")
    ap.add_argument("--teasers", action="store_true", help="rebuild assets/teasers from this story")
    args = ap.parse_args()

    folder = ROOT / "stories" / args.id
    if not folder.is_dir():
        sys.exit(f"Folder not found: {folder}")

    files = panels_in(folder)
    sizes = []
    for f in files:
        sizes.append(list(to_webp(f)))
        print(f"  {f.name} -> {f.with_suffix('.webp').name}  {sizes[-1][0]}x{sizes[-1][1]}")

    widths = {w for w, _ in sizes}
    if len(widths) > 1:
        print(f"  warning: panels have different widths {sorted(widths)} - the strip scales them all to one width")

    make_cover(files[0], folder / "cover")
    print("  cover.jpg / cover.webp")

    if args.teasers:
        make_teasers(files, ROOT / "assets" / "teasers")

    manifest_path = ROOT / "stories.json"
    manifest = json.loads(manifest_path.read_text())
    entry = next((s for s in manifest["stories"] if s["id"] == args.id), None)
    if entry is None:
        entry = {"id": args.id, "title": args.id.replace("-", " ").title(), "status": "live"}
        manifest["stories"].append(entry)
        print(f"  added a new entry for '{args.id}' to stories.json - check the title")
    entry["cover"] = f"stories/{args.id}/cover.jpg"
    entry["count"] = len(files)
    entry["ext"] = files[0].suffix.lstrip(".").lower()
    entry["webp"] = True
    entry["width"] = max(widths)
    entry["panels"] = sizes
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"  stories.json updated ({len(files)} panels)")


if __name__ == "__main__":
    main()
