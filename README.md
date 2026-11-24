# flog.fun

Static site, no build step, hosted on GitHub Pages (this repo, custom domain `flog.fun`). Push to `main` and it's live in about a minute. To preview locally, run `python -m http.server 8000` in this folder and open http://localhost:8000 (opening `index.html` from disk breaks the module imports and media loading).

All copy follows `../LORE.md` (lowercase, deadpan, every claim true).

## What the page is

One VHS tape: a scroll-driven three.js walk through a night forest. You find flog in a clearing, pass the story carved into trees, the sawmill, the pile (one 3D log per lock), the giant ring slice, the flog log on a lantern-lit log, and end in a clearing with the CA and buy links. A camcorder layer (REC, tape counter, chapter titles, static) sits on top.

- `html.webgl`: the journey. Chosen in an inline script in `<head>` when WebGL works, the visitor doesn't prefer reduced motion, and hasn't picked the plain page.
- `html.static`: the same content as a plain page, no three.js loaded. Used for no-WebGL, reduced motion, or the "lights on (plain page)" button in the menu (remembered in `localStorage['flog-static']`).

The essentials are always one tap away in the HUD: `menu` (a VCR menu that jumps to every chapter, plus tapes / found photos / memes / meme kit / plain page, and x / telegram / stickers), sound toggle (off by default), and buy.

The meme kit lives in `kit/` (the files) and `kit-page/kit.html` (the page + `flog-meme-kit.zip`); the page links into `../kit/`, so keep both folders side by side. They are copies of `../kit/` and `../kit-page/`. After regenerating the kit, re-copy `kit/` and the zip freely, but `kit-page/kit.html` here carries site-only edits that the generated page doesn't have. If you re-copy it, re-apply: the five `@font-face` rules pointing at `../fonts/*.woff2` (Bricolage, Caveat, ReenieBeanie, SpecialElite, VT323) instead of the kit TTFs, the `.osd .back` styles plus the `◀ back to the forest` link (to `/`) replacing `SP` in the header OSD, the `back to the forest` entry at the end of the section nav, and the footer links (back to the forest, telegram https://t.me/FlogFun, the two sticker packs).

## When the coin is live

Open `app.js` and set:

- `CONFIG.ca`: the contract address. Buy (pump.fun) and chart (dexscreener) fill themselves in from it.
- `CONFIG.links`: `x`, `tg` (telegram), `stickers` / `stickersTapes` (telegram sticker packs), `devlock` (the dev's Streamflow lock). Any `<a data-link="…">` gets its href from here.
- `CONFIG.devLocked`: the dev lock amount. "total locked" in the proof section = (`devLocked` + every log entry's `locked`) / the log's `supply`.
- `CONFIG.keeper`: the keeper's public URL (see `../LAUNCH.md`).

## The flog log

The keeper bot writes the log. The site reads `<CONFIG.keeper>/log` every minute: one entry per buyback, each with its claim, buy and lock transactions and a link to its Streamflow lock. From it: the counters and hopper in the sawmill, the 3D pile (one log per entry, ghost "future logs" while empty), the ring slice (one ring per lock), the forest milestones, the ledger rows, and the status display in the last clearing. Nothing needs editing by hand. `log.json` here is only a fallback for when the keeper can't be reached (same shape as `/log`).

## Media: `data/media.json` + `data/media-new.json`

Tapes, found photos, memes and the 3D model come from two JSON files, so new assets show up without code changes:

- `data/media.json`: the base list.
- `data/media-new.json`: optional, newer assets. Same shape. Entries with the same `id` replace base ones; `model` wins if set.

```json
{
  "sightings": [{ "id": "31_name", "file": "img/sightings/31_name.jpg", "place": "…", "time": "…", "note": "…" }],
  "memes":     [{ "id": "31_name", "file": "img/memes/31_name.jpg", "caption": "…" }],
  "cutouts":   [{ "id": "01_wave", "file": "img/cutouts/01_wave.png", "label": "wave" }],
  "videos":    [{ "id": "dance", "file": "video/dance.mp4", "poster": "video/dance.jpg", "title": "…", "caption": "…", "aspect": "16:9", "square": { "file": "video/dance-sq.mp4", "poster": "video/dance-sq.jpg", "aspect": "1:1" } }],
  "model": "3d/flog.glb"
}
```

Where files go: stamped photos in `img/sightings/`, unstamped versions with the same name in `img/clean/`, memes in `img/memes/`, transparent cutouts in `img/cutouts/`, tapes + posters in `video/`, the model in `3d/`. `app.js` puts the merged list on `window.FLOG_MEDIA` and fires a `flog:media` event.

## Files

- `index.html`: the beats (`<section class="beat">`, in order: tape, forest, flog, lignification, sawmill, pile, log, proof, end) and the HUD. Lines with `data-carve` are also burned into tree trunks.
- `style.css`: HUD, subtitles, in-scene panels, and the plain-page layout.
- `app.js`: config, the keeper log, media loading.
- `js/fx.js`: shared helpers, knock sound, ambient sound.
- `js/world.js`: scroll state shared with the 3D (`window.FLOG_SCROLL` + `flog:scroll`), subtitle timing, HUD menu/rail, plain-page switch, easter eggs.
- `js/world3d.js`: the three.js forest, camera path, flog, carved lines, post-processing.
- `js/mill3d.js`, `js/pile3d.js` (+ `css/mill3d.css`): the sawmill, the pile, the ring slice, the ledger log.
- `js/vhs.js` + `css/vhs.css`: boot tape, camcorder overlay, VHS post shader.
- `js/overlays.js` + `css/overlays.css`: tapes shelf, found photos, memes, slide projector.
- `js/rings.js`: the SVG ring slice and milestones for the plain page.
- `textures/`: CC0 textures from Poly Haven (walnut, oak, planks, brick, metal) and one generated paper texture.

three.js 0.170.0 loads from jsDelivr through the import map in `index.html`, only in `html.webgl`, after first paint.

Fonts: VT323, Bricolage Grotesque, Caveat, Reenie Beanie (SIL OFL) and Special Elite (Apache 2.0); licenses in `fonts/`.
