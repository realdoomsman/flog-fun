# flog.fun

Static site, no build step, hosted on GitHub Pages (this repo, custom domain `flog.fun`). Push to `main` and it's live in about a minute. To preview locally, run `npx serve .` in this folder; the meme maker and log-ify downloads are blocked if you open `index.html` straight from disk.

## When the coin is live

Open `app.js` and set:

- `CONFIG.ca`: the contract address. The buy (pump.fun) and chart (dexscreener) buttons fill themselves in from it.
- `CONFIG.links.x`: your X profile.
- `CONFIG.keeper`: the keeper's public URL (see `../LAUNCH.md`).

## The flog log

The keeper bot writes the log. The site reads `<CONFIG.keeper>/log` every minute: one entry per buyback, each with its claim, buy and lock transactions and a link to its Streamflow lock. The counters, the pile and the status pill in the hero all come from it. Nothing needs editing by hand.

`log.json` in this folder is only a fallback for when the keeper URL isn't set or can't be reached. It uses the same shape as `/log`.

Fonts are VT323 and Bricolage Grotesque (SIL Open Font License, see `fonts/`).
