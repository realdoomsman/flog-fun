// ---------------------------------------------------------------
// edit when live. buy/chart links fill in from the CA automatically.
// ---------------------------------------------------------------
const CONFIG = {
  ca: "",
  links: {
    buy: "",       // default: https://pump.fun/coin/<ca>
    chart: "",     // default: https://dexscreener.com/solana/<ca>
    x: "https://x.com",
    telegram: "https://t.me",
  },
  explorer: "https://solscan.io/tx/",
};
// buybacks + locks live in log.json (see README.md)

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
      ].filter(Boolean).join(" · ");
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${String(i).padStart(3, "0")}</td><td>${e.date || ""}</td><td>${fmt(e.fees_sol || 0, 3)} SOL</td><td>${fmt(e.bought || 0)}</td><td>${e.locked_until || ""}</td><td>${proof}</td>`;
      tb.appendChild(tr);
    });
  }

  // pile: one log end per entry, stacked as a pyramid
  const pile = $("#pile");
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
}
fetch("log.json", { cache: "no-store" })
  .then((r) => r.json())
  .then(renderLog)
  .catch(() => renderLog({ entries: [] }));

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
