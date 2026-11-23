// ---------------------------------------------------------------
// edit when live. buy/chart links fill in from the CA automatically.
// ---------------------------------------------------------------
const CONFIG = {
  ca: "",
  links: {
    buy: "",       // default: https://pump.fun/coin/<ca>
    chart: "",     // default: https://dexscreener.com/solana/<ca>
    x: "https://x.com",
  },
  explorer: "https://solscan.io/tx/",
  account: "https://solscan.io/account/",
  keeper: "https://keeper-production-f49f8214.up.railway.app",   // keeper base URL (serves /log and /health)
};
// the flog log comes from the keeper's /log; log.json is the fallback (see README.md)

const SIGHTINGS = [
  ["01_stairs", "church stairwell", "4:51pm", "coming downstairs to log the buyback"],
  ["02_pines", "pine forest", "6:02am", "visiting family"],
  ["03_hospital", "hospital, room 2", "11:40am", "doctor says he's 50% log"],
  ["04_bathroom", "basement bathroom", "3:00am", "just dropped another log"],
  ["05_street_night", "cobblestone street", "1:17am", "walking home from claiming fees"],
  ["06_cinema", "cinema hall", "9:30pm", "watching the buyback like a movie"],
  ["07_vault", "bank vault", "unknown", "checking on the locked logs"],
  ["08_metro", "metro platform", "7:48am", "on his way to buy back more flog"],
  ["09_daycare", "daycare", "5:59pm", "can't leave. he's a log."],
  ["10_phone_shop", "phone shop", "2:12pm", "new phone to watch buybacks live"],
  ["11_hotel", "hotel room 404", "check-in", "locked for 365 nights"],
  ["12_rooftop", "rooftop", "8:20pm", "waiting for the next fee claim"],
  ["13_snow", "snowy woods", "unknown", "still not selling. logs don't sell."],
  ["14_empty_room", "empty apartment", "the day after", "dev left. flog stayed."],
  ["15_cafe", "cafe", "minute 47", "paid in creator fees"],
  ["16_parking", "parking garage, level 3", "4:12am", "just standing there. like a log."],
  ["17_school_dance", "school hall", "7:30pm", "stiff as a log"],
  ["18_abandoned", "abandoned building", "unknown", "found where the paperhands went"],
  ["19_news", "tv studio", "live", "breaking news: another buyback"],
  ["20_pool", "indoor pool", "3:15pm", "logs float. so does the chart."],
  ["21_army", "farm road", "dawn", "the logs are stacking up"],
  ["22_door", "your building", "right now", "knock knock. (on wood)"],
  ["23_alley", "italy", "noon", "went to italy. still locked."],
  ["24_lake", "the lake", "dusk", "standing on it. logs float."],
  ["25_misty_hill", "the hill", "6:40am", "no roadmap. just buybacks."],
  ["26_giant", "the horizon", "at 1b", "flog at 1b"],
  ["27_woodpile", "the pile", "every day", "one more log on the pile"],
  ["28_carry", "the woods", "fee day", "carrying today's buyback"],
  ["29_sit_log", "the hill", "after the claim", "resting on a coworker"],
  ["30_parking_pile", "parking garage, level 3", "5:02am", "he brought friends"],
];

const $ = (s) => document.querySelector(s);
const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

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

// ---- knock on wood (synthesised, no audio files) ----
let actx;
function knock(times = 2) {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  for (let k = 0; k < times; k++) {
    const t = actx.currentTime + k * 0.13;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    const len = Math.floor(actx.sampleRate * 0.03);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const noise = actx.createBufferSource();
    noise.buffer = buf;
    const bp = actx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400;
    bp.Q.value = 1.2;
    const ng = actx.createGain();
    ng.gain.value = 0.5;
    noise.connect(bp).connect(ng).connect(actx.destination);
    osc.connect(g).connect(actx.destination);
    osc.start(t); osc.stop(t + 0.14);
    noise.start(t);
  }
}
const spec = $("#specimen");
spec.addEventListener("click", () => {
  knock();
  spec.classList.remove("knock");
  void spec.offsetWidth;
  spec.classList.add("knock");
});

// ---- camcorder clock in the hero (visitor's own time) ----
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function tick() {
  const d = new Date();
  $("#osd-date").textContent = `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} ${d.getFullYear()}`;
  const h = d.getHours();
  $("#osd-time").textContent = `${(h % 12) || 12}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
tick();
setInterval(tick, 1000);

// ---- the flog log: counters, ledger, pile ----
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
  renderMachine(data);
}

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
    const cost = data.lock_cost_sol ? ` each lock costs about ${fmt(data.lock_cost_sol, 2)} SOL${data.lock_fee_pct ? ` + ${data.lock_fee_pct}% of the tokens` : ""} on Streamflow, so the bot batches.` : "";
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

// ---- tapes: play when on screen ----
const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())), { threshold: 0.4 });
document.querySelectorAll(".tape video").forEach((v) => io.observe(v));

// ---- galleries + lightbox ----
function openLightbox(src, cap, file) {
  $("#lb-img").src = src;
  $("#lb-cap").textContent = cap;
  $("#lb-dl").href = src;
  $("#lb-dl").download = file;
  $("#lightbox").hidden = false;
}
$("#lb-close").addEventListener("click", () => ($("#lightbox").hidden = true));
$("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") e.target.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#lightbox").hidden = true; });

SIGHTINGS.forEach(([id, place, time, note], i) => {
  const c = document.createElement("div");
  c.className = "card";
  c.innerHTML = `<img loading="lazy" src="img/sightings/${id}.jpg" alt="flog sighting: ${place}"><div class="meta"><b>#${String(i + 1).padStart(3, "0")} · ${place} · ${time}</b>${note}</div>`;
  c.addEventListener("click", () => openLightbox(`img/sightings/${id}.jpg`, `${place}, ${time}: ${note}`, `flog-${id}.jpg`));
  $("#grid").appendChild(c);

  const m = document.createElement("div");
  m.className = "card";
  m.innerHTML = `<img loading="lazy" src="img/memes/${id}.jpg" alt="flog meme: ${note}">`;
  m.addEventListener("click", () => openLightbox(`img/memes/${id}.jpg`, note, `flog-meme-${id}.jpg`));
  $("#memes-grid").appendChild(m);
});

// ---- meme maker ----
(() => {
  const cv = $("#mk-canvas");
  const ctx = cv.getContext("2d");
  const thumbs = $("#mk-thumbs");
  let current = SIGHTINGS[26][0];
  const cache = {};
  const load = (id) => cache[id] ? Promise.resolve(cache[id]) : new Promise((res) => {
    const im = new Image();
    im.onload = () => res((cache[id] = im));
    im.src = `img/clean/${id}.jpg`;
  });
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
      ctx.font = "64px VT323, monospace";
      ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      const d = new Date();
      const t = text || `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getDate()).padStart(2, "0")}`;
      ctx.shadowColor = "rgba(255,120,20,.9)"; ctx.shadowBlur = 14;
      ctx.fillStyle = "#ff7a14";
      ctx.fillText(t.slice(0, 40), S - 46, S - 46);
      ctx.shadowBlur = 0;
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
  SIGHTINGS.forEach(([id]) => {
    const t = document.createElement("img");
    t.src = `img/clean/${id}.jpg`;
    t.alt = id;
    t.loading = "lazy";
    t.addEventListener("click", () => {
      current = id;
      thumbs.querySelectorAll("img").forEach((x) => x.classList.toggle("on", x === t));
      draw();
    });
    if (id === current) t.classList.add("on");
    thumbs.appendChild(t);
  });
  $("#mk-text").addEventListener("input", draw);
  $("#mk-style").addEventListener("change", draw);
  $("#mk-random").addEventListener("click", () => {
    const i = Math.floor(Math.random() * SIGHTINGS.length);
    thumbs.querySelectorAll("img")[i].click();
  });
  $("#mk-dl").addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = `flog-meme-${Date.now()}.png`;
    try {
      a.href = cv.toDataURL("image/png");
    } catch {
      // canvas export is blocked when the page is opened straight from disk (file://)
      alert("download needs the site to be hosted (or run: npx serve site).");
      return;
    }
    a.click();
  });
  document.fonts.ready.then(draw);
})();

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
  $("#lg-dl").addEventListener("click", () => {
    knock(1);
    const a = document.createElement("a");
    a.download = "flog-pfp.png";
    try { a.href = cv.toDataURL("image/png"); } catch { alert("download needs the site to be hosted."); return; }
    a.click();
  });
  document.fonts.ready.then(draw);
})();
