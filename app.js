// ---------------------------------------------------------------
// edit when live. buy/chart links fill in from the CA automatically.
// ---------------------------------------------------------------
const CONFIG = {
  ca: "CGJUUXmWgHaCp3ZVfX6rQJKQbNvLj7gXp3mBbUtJpump",
  links: {
    buy: "",       // default: https://pump.fun/coin/<ca>
    chart: "",     // default: https://dexscreener.com/solana/<ca>
    x: "https://x.com/flogdotfun",
  },
  explorer: "https://solscan.io/tx/",
  account: "https://solscan.io/account/",
  keeper: "https://keeper-production-f49f8214.up.railway.app",   // keeper base URL (serves /log and /health)
};
// the flog log comes from the keeper's /log; log.json is the fallback (see README.md)
// sightings, memes, tapes, cutouts and the 3D model come from data/media.json + data/media-new.json (see README.md)

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

// ---- camcorder clock in the hero (visitor's own time) ----
function tick() {
  const d = new Date();
  $("#osd-date").textContent = `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} ${d.getFullYear()}`;
  const h = d.getHours();
  $("#osd-time").textContent = `${(h % 12) || 12}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
tick();
setInterval(tick, 1000);

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
      tb.appendChild(tr);
    });
  }

  // pile: one log end per entry, stacked as a pyramid
  const pile = $("#pile");
  pile.innerHTML = "";
  pile.parentElement.querySelector(".pile-ground")?.remove();
  const shown = Math.min(entries.length, 66);
  let base = 0;
  while ((base * (base + 1)) / 2 < shown) base++;
  let left = shown;
  for (let w = base; w > 0 && left > 0; w--) {
    const row = document.createElement("div");
    row.className = "pile-row";
    const n = Math.min(w, left);
    for (let k = 0; k < n; k++) {
      const l = document.createElement("div");
      l.className = "log-end";
      l.style.animationDelay = `${(shown - left + k) * 40}ms`;
      row.appendChild(l);
    }
    left -= n;
    pile.appendChild(row);
  }
  const ground = document.createElement("div");
  ground.className = "pile-ground";
  pile.parentElement.appendChild(ground);
  if (entries.length) {
    $("#pile-cap").textContent = `${entries.length} log${entries.length === 1 ? "" : "s"} on the pile` + (entries.length > shown ? ` (showing ${shown})` : "") + ". none of them are going anywhere.";
  }
  renderRings(entries);
  renderMachine(data);
}
// knock on any log in the pile
$("#pile").addEventListener("click", (e) => {
  const l = e.target.closest(".log-end");
  if (!l) return;
  knock(1, 0.8 + Math.random() * 0.5);
  l.classList.remove("knocked"); void l.offsetWidth; l.classList.add("knocked");
});

// ---- live machine status (pill in the hero + proof cards) ----
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
// clean (no-stamp) version of a sighting, used by the meme maker and the sticker studio
const cleanOf = (s) => s.clean || s.file.replace("img/sightings/", "img/clean/");

// ---- galleries + lightbox ----
const lb = { list: [], i: 0 };
function openLightbox(list, i) {
  lb.list = list; lb.i = i;
  const it = list[i];
  $("#lb-img").src = it.src;
  $("#lb-img").alt = it.cap;
  $("#lb-cap").textContent = it.cap;
  $("#lb-dl").href = it.src;
  $("#lb-dl").download = it.name;
  $("#lb-prev").hidden = $("#lb-next").hidden = list.length < 2;
  $("#lightbox").hidden = false;
}
const lbStep = (d) => openLightbox(lb.list, (lb.i + d + lb.list.length) % lb.list.length);
const lbClose = () => ($("#lightbox").hidden = true);
$("#lb-close").addEventListener("click", lbClose);
$("#lb-prev").addEventListener("click", () => lbStep(-1));
$("#lb-next").addEventListener("click", () => lbStep(1));
$("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") lbClose(); });
document.addEventListener("keydown", (e) => {
  if ($("#lightbox").hidden) return;
  if (e.key === "Escape") lbClose();
  else if (e.key === "ArrowLeft") lbStep(-1);
  else if (e.key === "ArrowRight") lbStep(1);
});

// a grid that shows `page` cards at a time with a "more" button
function pagedGrid(grid, moreBtn, items, page, make) {
  let shown = 0;
  const more = () => {
    const frag = document.createDocumentFragment();
    items.slice(shown, shown + page).forEach((it, k) => frag.appendChild(make(it, shown + k)));
    shown = Math.min(items.length, shown + page);
    grid.appendChild(frag);
    initReveal(grid);
    moreBtn.hidden = shown >= items.length;
  };
  moreBtn.addEventListener("click", more);
  more();
}

function renderSightings(list) {
  const lbList = list.map((s) => ({ src: s.file, cap: `${s.place}, ${s.time}: ${s.note}`, name: `flog-${s.id}.jpg` }));
  pagedGrid($("#grid"), $("#grid-more"), list, 12, (s, i) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "card";
    c.setAttribute("data-reveal", "");
    c.innerHTML = `<img loading="lazy" src="${esc(s.file)}" alt="flog sighting: ${esc(s.place)}" width="720" height="720"><span class="meta"><b>#${String(i + 1).padStart(3, "0")} · ${esc(s.place)} · ${esc(s.time)}</b>${esc(s.note)}</span>`;
    c.addEventListener("click", () => openLightbox(lbList, i));
    return c;
  });
}
function renderMemes(list) {
  const lbList = list.map((m) => ({ src: m.file, cap: m.caption, name: `flog-meme-${m.id}.jpg` }));
  pagedGrid($("#memes-grid"), $("#memes-more"), list, 12, (m, i) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "card";
    c.setAttribute("data-reveal", "");
    c.innerHTML = `<img loading="lazy" src="${esc(m.file)}" alt="flog meme: ${esc(m.caption)}">`;
    c.addEventListener("click", () => openLightbox(lbList, i));
    return c;
  });
}

// ---- tapes: lazy-load, play when on screen ----
const tapeIO = new IntersectionObserver((es) => es.forEach((e) => {
  const v = e.target;
  if (e.isIntersecting) {
    if (!v.src) v.src = v.dataset.src;
    if (!v.closest(".paused")) v.play().catch(() => {});
  } else v.pause();
}), { threshold: 0.4 });
function renderTapes(list) {
  const grid = $("#tape-grid");
  list.forEach((t, i) => {
    const f = document.createElement("figure");
    f.className = `tape ${t.aspect === "16:9" ? "wide" : "square"}`;
    f.setAttribute("data-reveal", "");
    // the tapes carry their own camcorder OSD, so the only overlay is a pause card when you tap one
    f.innerHTML = `<div class="tape-screen"><video data-src="${esc(t.file)}" poster="${esc(t.poster || "")}" muted loop playsinline preload="none" aria-label="${esc(t.title)}"></video><span class="tape-pause">PAUSE ❚❚</span></div><figcaption><span class="tape-no">TAPE ${String(i + 1).padStart(2, "0")}</span><b>${esc(t.title)}</b> ${esc(t.caption)}</figcaption>`;
    const v = f.querySelector("video");
    tapeIO.observe(v);
    f.addEventListener("click", () => {
      if (v.paused) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); f.classList.remove("paused"); }
      else { v.pause(); f.classList.add("paused"); }
    });
    grid.appendChild(f);
  });
  initReveal(grid);
}

// ---- meme maker ----
const CAPTION_BANK = [
  "doctor: it's stage 4 lignification\nme: is that bullish",
  "diamond hands vs wooden hands",
  "flog when someone says bonfire",
  "the beaver is not your friend",
  "me explaining to my wife why i'm turning into a log",
  "every 2 SOL another log hits the pile. the pile doesn't sell.",
  "flog at the sawmill. 3am. cutting logs. no hands.",
  "petrified holder, est. 2026",
  "flog tried to swim. he just floated.",
  "count the rings",
  "it's not a bag. it's a log.",
  "flog at therapy: \"i can't feel my hands\"\n\"they're wood\"\n\"oh\"",
  "you can't sell if you're wood",
  "don't trust the frog. check the log.",
  "the frogs asked for a king. they got a log. best king they ever had.",
  "five little speckled frogs sat on a speckled log. four jumped in. one stayed.",
  "in britain \"to flog\" means to sell. flog has never flogged.",
  "paper is wood that gave up halfway",
  "vote log",
];
function initMaker(sightings) {
  const cv = $("#mk-canvas");
  const ctx = cv.getContext("2d");
  const thumbs = $("#mk-thumbs");
  let current = (sightings.find((s) => s.id === "27_woodpile") || sightings[0])?.id;
  const byId = Object.fromEntries(sightings.map((s) => [s.id, s]));
  const cache = {};
  const load = (id) => cache[id] || (cache[id] = loadImg(cleanOf(byId[id])).catch(() => loadImg(byId[id].file)));
  function wrap(text, maxW) {
    const out = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const w of para.split(/\s+/)) {
        const t = line ? line + " " + w : w;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  async function draw() {
    if (!current) return;
    const im = await load(current);
    const S = 1080, style = $("#mk-style").value, text = $("#mk-text").value.trim();
    if (style === "top" && text) {
      ctx.font = "50px Arial, Helvetica, sans-serif";
      const lines = wrap(text, S - 90);
      const bar = 50 + 62 * lines.length + 30;
      cv.width = S; cv.height = S + bar;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S, bar);
      ctx.font = "50px Arial, Helvetica, sans-serif";
      ctx.fillStyle = "#0f0f0f"; ctx.textBaseline = "top"; ctx.textAlign = "left";
      lines.forEach((l, i) => ctx.fillText(l, 45, 46 + i * 62));
      ctx.drawImage(im, 0, bar, S, S);
      return;
    }
    cv.width = S; cv.height = S;
    ctx.drawImage(im, 0, 0, S, S);
    if (style === "stamp") {
      drawStamp(ctx, S, S, (text || digicamDate()).slice(0, 40));
      return;
    }
    if (!text) return;
    const [top, bot = ""] = text.toUpperCase().split("|");
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.lineJoin = "round"; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    for (const [t, isTop] of [[top.trim(), true], [bot.trim(), false]]) {
      if (!t) continue;
      let size = 104, lines;
      do { ctx.font = `${size}px Impact, "Arial Black", sans-serif`; lines = wrap(t, S - 70); size -= 6; } while (lines.length > 2 && size > 60);
      size += 6;
      const lh = size * 1.08;
      const y0 = isTop ? 26 : S - 34 - lh * lines.length;
      ctx.lineWidth = Math.max(8, size / 7);
      lines.forEach((l, i) => { ctx.strokeText(l, S / 2, y0 + i * lh); ctx.fillText(l, S / 2, y0 + i * lh); });
    }
  }
  sightings.forEach((s) => {
    const t = document.createElement("img");
    t.src = cleanOf(s);
    t.onerror = () => { if (!t.src.endsWith(s.file)) t.src = s.file; };
    t.alt = s.place;
    t.loading = "lazy";
    t.width = t.height = 90;
    t.addEventListener("click", () => {
      current = s.id;
      thumbs.querySelectorAll("img").forEach((x) => x.classList.toggle("on", x === t));
      draw();
    });
    if (s.id === current) t.classList.add("on");
    thumbs.appendChild(t);
  });
  $("#mk-text").addEventListener("input", draw);
  $("#mk-style").addEventListener("change", draw);
  $("#mk-random").addEventListener("click", () => {
    const all = thumbs.querySelectorAll("img");
    all[Math.floor(Math.random() * all.length)]?.click();
  });
  $("#mk-cap").addEventListener("click", () => {
    const cur = $("#mk-text").value;
    let next = cur;
    while (next === cur) next = CAPTION_BANK[Math.floor(Math.random() * CAPTION_BANK.length)];
    $("#mk-text").value = next;
    draw();
  });
  $("#mk-dl").addEventListener("click", () => { knock(1); downloadCanvas(cv, `flog-meme-${Date.now()}.png`); });
  document.fonts.ready.then(draw);
}

// ---- log-ify your pfp: your image inside a fresh-cut log end, leaf on top ----
(() => {
  const cv = $("#lg-canvas");
  const ctx = cv.getContext("2d");
  const S = cv.width, C = S / 2, R = S * 0.47;
  const BARK = {
    oak: { base: "#3b2415", dark: "#1e1109", fleck: "#5a3a22" },
    birch: { base: "#e9e4d8", dark: "#2b2622", fleck: "#c9c2b2" },
    burnt: { base: "#1a1310", dark: "#070504", fleck: "#ff7a1a" },
  };
  let img = new Image();
  img.onload = draw;
  img.src = "img/pfp.png";

  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
  function draw() {
    if (!img.width) return;
    const b = BARK[$("#lg-bark").value];
    const rand = rng(7);
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = "#0f1610";
    ctx.fillRect(0, 0, S, S);
    // bark rim with radial cracks
    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.fillStyle = b.base; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < 260; i++) {
      const a = rand() * Math.PI * 2, r0 = R * (0.86 + rand() * 0.06), r1 = R * (0.97 + rand() * 0.05);
      ctx.strokeStyle = rand() < 0.7 ? b.dark : b.fleck;
      ctx.lineWidth = 1 + rand() * 4;
      ctx.beginPath(); ctx.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); ctx.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
    // sapwood + growth rings band
    const inner = R * 0.84, photo = R * 0.74;
    ctx.beginPath(); ctx.arc(C, C, inner, 0, Math.PI * 2); ctx.fillStyle = "#efcf98"; ctx.fill();
    for (let r = photo; r < inner; r += 5 + rand() * 4) {
      ctx.beginPath(); ctx.arc(C + (rand() - 0.5) * 3, C + (rand() - 0.5) * 3, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150, 92, 40, ${0.35 + rand() * 0.4})`; ctx.lineWidth = 1 + rand() * 2; ctx.stroke();
    }
    // the photo, cover-fit into the heartwood
    ctx.save(); ctx.beginPath(); ctx.arc(C, C, photo, 0, Math.PI * 2); ctx.clip();
    const k = Math.max((photo * 2) / img.width, (photo * 2) / img.height);
    ctx.drawImage(img, C - (img.width * k) / 2, C - (img.height * k) / 2, img.width * k, img.height * k);
    // faint wood grain over the photo
    for (let r = 20; r < photo; r += 26) {
      ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.strokeStyle = "rgba(120, 70, 25, 0.10)"; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(C, C, photo, 0, Math.PI * 2); ctx.strokeStyle = "rgba(110, 62, 22, .8)"; ctx.lineWidth = 6; ctx.stroke();
    // twig + leaf at the top right of the rim
    const tx = C + Math.cos(-0.75) * R * 0.93, ty = C + Math.sin(-0.75) * R * 0.93;
    ctx.strokeStyle = "#3b2415"; ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 8, ty - 45, tx + 30, ty - 75); ctx.stroke();
    ctx.save(); ctx.translate(tx + 30, ty - 75); ctx.rotate(-0.6);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(35, -48, 105, -44, 130, 0); ctx.bezierCurveTo(105, 40, 35, 40, 0, 0);
    ctx.fillStyle = "#4fbf26"; ctx.fill(); ctx.strokeStyle = "#2f7d12"; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(114, 0); ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    // $FLOG tag
    if ($("#lg-tag").checked) {
      ctx.font = "84px VT323, monospace";
      const t = "$FLOG", w = ctx.measureText(t).width + 60, h = 96, x = C - w / 2, y = S - h - 18;
      ctx.fillStyle = "#c98a4b"; ctx.strokeStyle = "#3b2415"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 48); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1d150d"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, C, y + h / 2 + 4);
    }
  }
  function load(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => { img = next; draw(); URL.revokeObjectURL(url); };
    next.src = url;
  }
  $("#lg-file").addEventListener("change", (e) => load(e.target.files[0]));
  const drop = $("#lg-drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); load(e.dataTransfer.files[0]); });
  $("#lg-bark").addEventListener("change", draw);
  $("#lg-tag").addEventListener("change", draw);
  $("#lg-dl").addEventListener("click", () => { knock(1); downloadCanvas(cv, "flog-pfp.png"); });
  document.fonts.ready.then(draw);
})();

// ---- boot everything that depends on media ----
(async () => {
  const [base, fresh] = await Promise.all([getJSON("data/media.json"), getJSON("data/media-new.json")]);
  const media = mergeMedia(base, fresh);
  window.FLOG_MEDIA = media;
  renderTapes(media.videos);
  renderSightings(media.sightings);
  renderMemes(media.memes);
  initMaker(media.sightings);
  initSpecimen(media);
  window.FLOG_STUDIO = initStudio(media);
  initQuiz(media);
})();
