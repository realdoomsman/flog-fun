# flog.fun

Static site: no build step. Upload this folder to any static host (Netlify, Vercel, Cloudflare Pages) and point `flog.fun` at it. To preview locally, run `npx serve .` in this folder. The meme maker's download is blocked if you open `index.html` straight from disk.

## When the coin is live

Open `app.js` and set `CONFIG.ca` to the contract address. The buy (pump.fun) and chart (dexscreener) buttons fill themselves in from it. Then set `links.x` and `links.telegram`.

## Adding a buyback to the flog log

Every time you claim creator fees, buy back and lock, add one entry to `log.json`:

```json
{
  "supply": 1000000000,
  "entries": [
    {
      "date": "2026-11-30",
      "fees_sol": 2.41,
      "bought": 3150000,
      "locked": 3150000,
      "locked_until": "2027-11-30",
      "claim_tx": "<signature of the fee claim>",
      "buy_tx": "<signature of the buy>",
      "lock_tx": "<signature of the lock>"
    }
  ]
}
```

- `locked` is optional; when it's missing the site counts `bought` as locked.
- Any `*_tx` you leave out is just not shown. Links go to Solscan (`CONFIG.explorer`).
- Each entry adds one log to the pile and updates the counters.
- `supply` is the total token supply, used for the "% of supply locked" counter.

Fonts are VT323 and Bricolage Grotesque (SIL Open Font License, see `fonts/`).
