# SEEQUENCE

Comics by BlackSheep: a static reading site for vertical comics that **loop forever**.
Live at **https://wmtm.github.io/Seequence/**.
Plain HTML/CSS/JS, no build step, no frameworks. Every path is relative, so it works at
`https://wmtm.github.io/<any-repo-name>/`.

```
index.html              homepage / story library (cards rendered from stories.json)
story.html?id=<id>      the reader
stories.json            list of stories
stories/<id>/01.jpg…    numbered panels (+ .webp copies, cover.jpg/.webp, cover-ambient.jpg)
assets/css/             base.css (shared), home.css, reader.css
assets/js/              common.js (cursor, easter eggs), home.js, reader.js
assets/img/             logo, favicons, og.jpg (share image)
assets/teasers/         blurred crops used by the "coming soon" cards
assets/fonts/           Bricolage Grotesque + Inter (self-hosted, OFL)
tools/                  optional Python helpers for preparing images
```

To replace or update a story's art, drop the new numbered files in with the same names and
run `python3 tools/prepare_story.py <id>` (add `--teasers` to rebuild the coming-soon crops
from it), and `python3 tools/make_og.py` for the share image.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

(Opening `index.html` straight from disk won't work: the pages `fetch()` `stories.json`.)

## Add a new story

1. Create a folder `stories/<id>/` (lowercase, dashes, e.g. `stories/night-market/`) and add
   the panels numbered from `01`: `01.jpg`, `02.jpg`, `03.jpg`… All panels should share the
   same width.
2. Add one entry to `stories.json`. If there's a "coming soon" card you want to replace,
   swap it for the new story:
   ```json
   { "id": "night-market", "title": "Night Market", "status": "live" }
   ```
   Optional fields: `"accent": "Night"` picks which word of the title gets the italic
   accent (the last word by default).
3. Run the helper (it needs Pillow: `python3 -m pip install pillow`):
   ```bash
   python3 tools/prepare_story.py night-market
   ```
   This creates the WebP copies, the homepage cover (`cover.jpg/.webp`, a crop of panel 01)
   and fills in `count`, `width`, `ext` and each panel's size in `stories.json`. The
   reader uses those sizes to reserve space before images load, so nothing jumps.

   **No Python?** Add the fields by hand and the site still works:
   ```json
   { "id": "night-market", "title": "Night Market", "status": "live",
     "count": 12, "ext": "jpg", "webp": false, "cover": "stories/night-market/01.jpg" }
   ```
   The reader then measures the images itself and serves the JPGs.

`status` is `"live"` (clickable, readable) or `"coming-soon"` (blurred teaser card, not
clickable). A coming-soon entry needs a `teaser` image. `--teasers` rebuilds the four
teasers in `assets/teasers/` from a story's panels. The homepage shows the first five
entries.

## How the infinite reader works

The strip is made of identical *sets* (01→09). Only enough sets to cover about three
screens exist at any time (two on most devices). A spacer above them keeps set *k* at
exactly `k × setHeight`. As you scroll down, the set that has left the screen far above
moves to the bottom, and the spacer grows by the same height in the same frame. Nothing
on screen moves and the DOM never grows. After you've scrolled past a few loops and
stopped for a moment (never mid-swipe), the page quietly jumps back a whole number of loops.
Every set is identical, so that jump is invisible (tested pixel-identical on desktop) and
the page height stays small. Images load via IntersectionObserver two screens ahead, and
the next three panels are preloaded. Panel sizes are reserved up front, so there's no
layout shift.

Keyboard: `Space`/`Page Down`/arrows scroll as normal, and `j`/`k` (or `→`/`←`) jump one panel.

## The hidden 42s

Nothing displays "42", but it's everywhere:

| # | Where | What |
|---|-------|------|
| 1 | `base.css` `--u` | The whole layout runs on a **42px** unit: gutters, section padding, header offsets, and the back button (42×42). |
| 2 | `base.css` `--t` | The standard transition is **420ms**. |
| 3 | Custom cursor | The ring is **42px** across and grows to 84px (2×42) over cards. |
| 4 | Tickers | Both marquees loop every **42s**. |
| 5 | Hero glow | The violet/coral blobs drift on a **42s** cycle (the second is offset by 21s). |
| 6 | Grain | The noise jitters on a **4.2s** loop, with `baseFrequency` 0.**842**. |
| 7 | Tilts | Stacked cards tilt **±4.2°** as the next card covers them. The logo tilts 4.2° on hover, the coming-soon titles skew 4.2° when glitching, and the sheep in the flock hop at 4.2°. |
| 8 | Hero "END." | Each letter bobs on a **4.2s** loop, staggered by 0.42s. |
| 9 | Deck | Each card sticks 10.5px (**42 ÷ 4**) lower than the one before. The glitch runs at **420ms** and the tap-glitch at 840ms. |
| 10 | Live card | The cover zooms to **1.042** on hover. |
| 11 | Redaction bars | The bar widths are built from 42 / 84 / 21 / 63. |
| 12 | Images | Teaser crops are **420px** wide with noise level 42 and random seed 42. The card's ambient glow image is **42px** wide. |
| 13 | Reader | The header hides after **42px** of downward scroll, and the loop rebase waits for **420ms** of stillness. |
| 14 | Toasts | Messages stay up for **4.2s**. |
| 15 | Easter egg 1 | Type **4 then 2** on any page: **42 sheep** stampede across the screen ("Don't panic."). In code it's written `6 * 7`. |
| 16 | Easter egg 2 | Loop a story **42 times** (counted across visits in localStorage) and the flock arrives, then again every 42 loops. |
| 17 | Console | Open DevTools for a hint about "the answer". |

## Deploy to GitHub Pages

The site lives in **wmtm/Seequence** and is served from the `main` branch root.

1. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
   Branch: `main` / `(root)` → Save** (one time only).
2. Wait a minute, then open **https://wmtm.github.io/Seequence/**.
3. From then on, every push to `main` redeploys automatically:
   ```bash
   git add -A && git commit -m "Add new story" && git push
   ```

The social share tags (`og:image`, `twitter:image`) already point to
`https://wmtm.github.io/Seequence/assets/img/og.jpg`. If the repo is ever renamed, update
them in `index.html` and `story.html`. Everything else uses relative paths.

The empty `.nojekyll` file tells GitHub Pages to serve everything as-is.

## Browser notes

- Page transitions use cross-document View Transitions (Chrome/Edge 126+, Safari 18.2+).
  Other browsers just navigate normally.
- `prefers-reduced-motion` turns off tickers, grain, card stacking, the cursor, view
  transitions and the flock animation. The easter-egg message still shows.
- The custom cursor only appears with a mouse (fine pointer + hover).

Fonts: Bricolage Grotesque and Inter, SIL Open Font License (see `assets/fonts/`).
