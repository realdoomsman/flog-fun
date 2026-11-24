// ---------------------------------------------------------------
// edit when live. buy/chart links fill in from the CA automatically.
// ---------------------------------------------------------------
const CONFIG = {
  ca: "CGJUUXmWgHaCp3ZVfX6rQJKQbNvLj7gXp3mBbUtJpump",
  links: {
    buy: "",       // default: https://pump.fun/coin/<ca>
    chart: "",     // default: https://dexscreener.com/solana/<ca>
    x: "https://x.com/flogdotfun",
    tg: "https://t.me/FlogFun",
    stickers: "https://t.me/addstickers/flogfun",
    stickersTapes: "https://t.me/addstickers/flogtapes",
    devlock: "https://app.streamflow.finance/contract/solana/mainnet/2yyYwkDbWamDuZi7bivuseMQskyZFxDBd6gSy2i1iD6Q",
  },
  devLocked: 66728855.72,   // the dev's own Streamflow lock (until 2093-11-23), counted into "total locked"
  explorer: "https://solscan.io/tx/",
  account: "https://solscan.io/account/",
  keeper: "https://keeper-production-f49f8214.up.railway.app",   // keeper base URL (serves /log and /health)
};
// the flog log comes from the keeper's /log; log.json is the fallback (see README.md)
// tapes, photos, memes and the 3D model come from data/media.json + data/media-new.json (see README.md)

// ---- links + CA ----
const ca = CONFIG.ca.trim();
const links = {
  ...CONFIG.links,
  buy: CONFIG.links.buy || (ca ? `https://pump.fun/coin/${ca}` : "https://pump.fun"),
  chart: CONFIG.links.chart || (ca ? `https://dexscreener.com/solana/${ca}` : "https://dexscreener.com/solana"),
};
document.querySelectorAll("[data-link]").forEach((a) => (a.href = links[a.dataset.link] || "#"));
if (ca) $("#ca-text").textContent = ca;
$("#ca-copy").addEventListener("click", async () => {
  const b = $("#ca-copy");
  knock();
  if (!ca) { b.textContent = "not yet"; setTimeout(() => (b.textContent = "copy"), 1300); return; }
  await navigator.clipboard.writeText(ca);
  b.textContent = "copied";
  setTimeout(() => (b.textContent = "copy"), 1300);
});

// ---- the flog log: counters, ledger, pile, rings ----
function short(sig) { return sig.slice(0, 4) + "…" + sig.slice(-4); }
function renderLog(data) {
  const entries = data.entries || [];
  const fees = entries.reduce((s, e) => s + (+e.fees_sol || 0), 0);
  const bought = entries.reduce((s, e) => s + (+e.bought || 0), 0);
  const locked = entries.reduce((s, e) => s + (+(e.locked ?? e.bought) || 0), 0);
  $("#c-fees").textContent = fmt(fees, fees ? 2 : 0);
  $("#c-bought").textContent = fmt(bought);
  $("#c-locked").textContent = data.supply ? fmt((locked / data.supply) * 100, 2) : fmt(locked);
  $("#c-locked-pct").textContent = data.supply ? "% of supply" : "$FLOG";
  $("#c-logs").textContent = fmt(entries.length);
  // proof: dev lock + the pile, as a share of supply
  $("#proof-total-v").textContent = `${fmt(((CONFIG.devLocked + locked) / (+data.supply || 1e9)) * 100, 2)}%`;

  if (entries.length) {
    const tb = $("#log-body");
    tb.innerHTML = "";
    entries.slice().reverse().forEach((e) => {
      const i = entries.indexOf(e) + 1;
      const proof = [
        e.claim_tx && `<a href="${CONFIG.explorer}${e.claim_tx}" target="_blank" rel="noopener">claim ${short(e.claim_tx)}</a>`,
        e.buy_tx && `<a href="${CONFIG.explorer}${e.buy_tx}" target="_blank" rel="noopener">buy ${short(e.buy_tx)}</a>`,
        e.lock_tx && `<a href="${CONFIG.explorer}${e.lock_tx}" target="_blank" rel="noopener">lock ${short(e.lock_tx)}</a>`,
        (e.lock_url || e.escrow) && `<a href="${e.lock_url || CONFIG.account + e.escrow}" target="_blank" rel="noopener">view lock</a>`,
      ].filter(Boolean).join(" · ");
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${String(i).padStart(3, "0")}</td><td>${e.date || ""}</td><td>${fmt(e.fees_sol || 0, 3)} SOL</td><td>${fmt(e.bought || 0)}</td><td>${e.locked_until || ""}</td><td>${proof}</td>`;
      if (e.lock_tx || e.lock_url || e.escrow) tr.className = "locked-row";
      tb.appendChild(tr);
    });
  }

  // the pile in the 3d forest (js/pile3d.js); the static page uses the rings svg
  if (typeof renderPile === "function") renderPile(entries);
  if (entries.length) {
    $("#pile-cap").textContent = `${entries.length} log${entries.length === 1 ? "" : "s"} on the pile. none of them are going anywhere.`;
  }
  renderRings(entries);
  renderMachine(data);
}

// ---- live machine status (pill in the clearing + proof cards + the 3d sawmill) ----
let machine = null;
function renderMachine(data) {
  machine = data;
  if (data.fee_wallet) {
    $("#proof-wallet-v").textContent = short(data.fee_wallet);
    $("#proof-wallet").href = CONFIG.account + data.fee_wallet;
  }
  if (CONFIG.keeper) $("#proof-bot").href = CONFIG.keeper.replace(/\/$/, "") + "/health";
  if (data.min_buy_sol && data.flog_mint) {
    const pend = +data.pending_sol || 0, goal = +data.min_buy_sol;
    $("#nextlog").hidden = false;
    $("#nl-val").textContent = `${fmt(pend, 3)} / ${fmt(goal, 0)} SOL`;
    $("#nl-fill").style.width = `${Math.min(100, (pend / goal) * 100)}%`;
    const cost = data.lock_cost_sol ? ` each lock costs about ${fmt(data.lock_cost_sol, 2)} SOL${data.lock_fee_pct ? ` + ${data.lock_fee_pct}% of the tokens` : ""} on Streamflow, so the sawmill batches.` : "";
    const wait = data.max_wait_hours ? ` if it takes longer than ${data.max_wait_hours}h, it locks anyway once there's ${fmt(data.min_buy_sol_after_wait || 1, 1)} SOL.` : "";
    $("#nl-note").textContent = `claimed fees stack up here until there's enough to buy and lock in one go.${cost}${wait}`;
  }
  if (typeof updateSawmill === "function") updateSawmill(data);
  tickMachine();
}
function tickMachine() {
  const d = machine;
  const pill = $("#keeper-pill"), txt = $("#keeper-text"), bot = $("#proof-bot-v");
  if (!d || !d.fee_wallet) return;
  if (!d.flog_mint) {
    pill.dataset.state = "idle";
    txt.textContent = "the machine is built. it starts the moment the coin launches.";
    bot.textContent = "built, waiting for launch";
    return;
  }
  const last = Date.parse(d.last_run || 0), next = Date.parse(d.next_run || 0), interval = (d.interval_sec || 300) * 1000;
  const stale = !last || Date.now() - last > Math.max(3 * interval, 600000);
  if (stale) {
    pill.dataset.state = "down";
    txt.textContent = "the machine is offline. fees wait safely in pump.fun until it's back.";
    bot.textContent = "offline";
    return;
  }
  const s = Math.max(0, Math.round((next - Date.now()) / 1000));
  const pend = +d.pending_sol > 0 ? ` · ${fmt(d.pending_sol, 3)} SOL waiting to buy` : "";
  pill.dataset.state = "live";
  txt.textContent = s ? `machine online · next claim in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}${pend}` : `machine online · claiming now${pend}`;
  bot.textContent = "online";
}
setInterval(tickMachine, 1000);

async function loadLog() {
  if (CONFIG.keeper) {
    try {
      const r = await fetch(CONFIG.keeper.replace(/\/$/, "") + "/log", { cache: "no-store" });
      if (r.ok) return renderLog(await r.json());
    } catch {}
    // keeper unreachable: keep the last good data on screen, but say so
    if (machine) {
      $("#keeper-pill").dataset.state = "down";
      $("#keeper-text").textContent = "can't reach the machine right now. fees wait safely in pump.fun.";
      machine = { ...machine, last_run: null };
      return;
    }
  }
  try {
    const r = await fetch("log.json", { cache: "no-store" });
    if (r.ok) return renderLog(await r.json());
  } catch {}
  renderLog({ entries: [] });
}
loadLog();
if (CONFIG.keeper) setInterval(loadLog, 60000);

// ---- media: data/media.json (base) + data/media-new.json (optional, newer assets) ----
async function getJSON(url) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
function mergeMedia(...parts) {
  const out = { sightings: [], memes: [], cutouts: [], videos: [], model: null };
  for (const p of parts) {
    if (!p) continue;
    for (const k of ["sightings", "memes", "cutouts", "videos"]) {
      for (const item of p[k] || []) {
        if (!item || !item.id || !item.file) continue;
        const at = out[k].findIndex((x) => x.id === item.id);
        if (at >= 0) out[k][at] = { ...out[k][at], ...item }; else out[k].push(item);
      }
    }
    if (p.model) out.model = p.model;
  }
  return out;
}
// the overlays (tapes, found photos, memes) and the 3d world read this
(async () => {
  const [base, fresh] = await Promise.all([getJSON("data/media.json"), getJSON("data/media-new.json")]);
  const media = mergeMedia(base, fresh);
  window.FLOG_MEDIA = media;
  window.dispatchEvent(new CustomEvent("flog:media", { detail: media }));
})();
