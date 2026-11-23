# flog.fun

Static site, no build step, hosted on GitHub Pages (this repo, custom domain `flog.fun`). Push to `main` and it's live in about a minute. To preview locally, run `python -m http.server 8000` (or `npx serve .`) in this folder and open http://localhost:8000. Opening `index.html` straight from disk breaks the media loading and the image downloads.

All copy follows `../LORE.md` (lowercase, deadpan, every claim true).

## When the coin is live

Open `app.js` and set:

- `CONFIG.ca`: the contract address. The buy (pump.fun) and chart (dexscreener) buttons fill themselves in from it.
- `CONFIG.links.x`: your X profile.
- `CONFIG.keeper`: the keeper's public URL (see `../LAUNCH.md`).

## The flog log

The keeper bot writes the log. The site reads `<CONFIG.keeper>/log` every minute: one entry per buyback, each with its claim, buy and lock transactions and a link to its Streamflow lock. The counters, the pile, the rings (one ring per entry), the forest milestones and the status pill in the hero all come from it. Nothing needs editing by hand.

`log.json` in this folder is only a fallback for when the keeper URL isn't set or can't be reached. It uses the same shape as `/log`.

## Media: `data/media.json` + `data/media-new.json`

Every picture, tape, sticker cutout and the 3D model on the page comes from two JSON files, so new assets show up without touching code:

- `data/media.json`: the base list (the original 30 sightings/memes, 4 tapes, the standing cutout).
- `data/media-new.json`: optional, newer assets. If it's missing (404) the site just uses the base list.

Both use the same shape. The site concatenates them; an entry in `media-new.json` with the same `id` as a base entry replaces it. `model` from `media-new.json` wins if set.

```json
{
  "sightings": [{ "id": "31_name", "file": "img/sightings/31_name.jpg", "place": "…", "time": "…", "note": "…" }],
  "memes":     [{ "id": "31_name", "file": "img/memes/31_name.jpg", "caption": "…" }],
  "cutouts":   [{ "id": "01_wave", "file": "img/cutouts/01_wave.png", "label": "wave" }],
  "videos":    [{ "id": "dance", "file": "video/dance.mp4", "poster": "video/dance.jpg", "title": "…", "caption": "…", "aspect": "16:9" }],
  "model": "3d/flog.glb"
}
```

Where things go (paths are relative to this folder, names continue the `NN_name` numbering):

| list | files | used by |
| --- | --- | --- |
| `sightings` | `img/sightings/NN_name.jpg` (with date stamp) + the same name in `img/clean/` (no stamp) | sightings grid, lightbox, meme maker thumbs, sticker studio backgrounds. A sighting may set `"clean"` explicitly; otherwise `img/clean/<same name>` is used, falling back to the stamped file. |
| `memes` | `img/memes/NN_name.jpg` | memes grid + lightbox (`caption` is the alt text and lightbox caption) |
| `cutouts` | `img/cutouts/NN_name.png`, transparent PNG, flog standing on the bottom edge | sticker studio ("put flog anywhere"); the first cutout is also the flog on the quiz card |
| `videos` | `video/name.mp4` + `video/name.jpg` poster; `aspect` is `"16:9"` or `"1:1"` | the tapes (lazy-loaded, play when on screen) |
| `model` | `3d/flog.glb` (already set in `media.json`; just drop the file in) | the specimen card: interactive 3D via `<model-viewer>` 4.4.0 (Google CDN), only downloaded once a HEAD check finds the file. If the file is missing (404) or fails to load, the card keeps the turntable video. |

## Scripts

- `js/fx.js`: knock-on-wood sound, ambient sound toggle (WebAudio, off by default), scroll reveal, parallax, mobile nav, shared helpers. Respects `prefers-reduced-motion`.
- `js/rings.js`: the tree cross-section (one ring per log entry) and the forest milestones.
- `js/specimen.js`: the 3D specimen and its video fallback.
- `js/studio.js`: the sticker studio.
- `js/quiz.js`: "how wood are you?" and its share card.
- `app.js`: config, the flog log, media loading, galleries, meme maker, log-ify.

Fonts are VT323 and Bricolage Grotesque (SIL Open Font License, see `fonts/`).
