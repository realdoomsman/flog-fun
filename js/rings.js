// "count the rings": a tree cross-section with one ring per lock in the flog log,
// plus the forest milestone track. renderRings(entries) is called by renderLog in app.js.

const MILESTONES = [
  { at: 1, name: "a stick" },
  { at: 10, name: "a stack" },
  { at: 25, name: "a cabin" },
  { at: 50, name: "a dam" },
  { at: 100, name: "a forest" },
  { at: 500, name: "old growth" },
];

const ringsState = { n: -1, seen: false };

function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

// a slightly wobbly closed ring, deterministic per index so re-renders don't jump
function ringPath(r, k) {
  const rand = seeded(k * 7919 + 13);
  const p1 = rand() * 6.28, p2 = rand() * 6.28, a1 = 0.012 + rand() * 0.014, a2 = 0.006 + rand() * 0.01;
  const ox = (rand() - 0.5) * 2.4, oy = (rand() - 0.5) * 2.4;
  let d = "";
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const rr = r * (1 + a1 * Math.sin(3 * a + p1) + a2 * Math.sin(7 * a + p2));
    const x = 200 + ox + Math.cos(a) * rr, y = 200 + oy + Math.sin(a) * rr;
    d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d + "Z";
}

function xsecBase() {
  const rand = seeded(42);
  let cracks = "";
  for (let i = 0; i < 140; i++) {
    const a = rand() * Math.PI * 2, r0 = 172 + rand() * 6, r1 = 186 + rand() * 8;
    cracks += `<path d="M${(200 + Math.cos(a) * r0).toFixed(1)} ${(200 + Math.sin(a) * r0).toFixed(1)}L${(200 + Math.cos(a) * r1).toFixed(1)} ${(200 + Math.sin(a) * r1).toFixed(1)}" stroke="${rand() < 0.7 ? "#1e1109" : "#5a3a22"}" stroke-width="${(1 + rand() * 2.5).toFixed(1)}"/>`;
  }
  let grain = "";
  for (let r = 10, k = 0; r < 168; r += 3 + rand() * 3, k++) grain += `<path class="grain-ring" d="${ringPath(r, 900 + k)}"/>`;
  return `
    <defs>
      <radialGradient id="xs-face" cx="48%" cy="52%" r="60%">
        <stop offset="0" stop-color="#f6dcae"/><stop offset=".65" stop-color="#ebc88f"/><stop offset="1" stop-color="#c99556"/>
      </radialGradient>
      <radialGradient id="xs-shade" cx="50%" cy="50%" r="50%">
        <stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/>
      </radialGradient>
    </defs>
    <circle cx="200" cy="200" r="194" fill="#3b2415"/>
    <g>${cracks}</g>
    <circle cx="200" cy="200" r="172" fill="url(#xs-face)"/>
    <g>${grain}</g>
    <circle cx="200" cy="200" r="172" fill="url(#xs-shade)"/>
    <circle cx="200" cy="200" r="172" fill="none" stroke="#7a4a22" stroke-width="3"/>
    <g id="xs-rings"></g>
    <circle class="pith" cx="200" cy="200" r="5"/>`;
}

function renderRings(entries) {
  const svg = $("#xsec");
  if (!svg) return;
  const n = entries.length;
  if (!svg.dataset.built) {
    svg.innerHTML = xsecBase();
    svg.dataset.built = "1";
    new IntersectionObserver((es, io) => {
      if (es.some((e) => e.isIntersecting)) { svg.classList.add("go"); ringsState.seen = true; io.disconnect(); }
    }, { threshold: 0.3 }).observe(svg);
  }
  if (n !== ringsState.n) {
    const prev = Math.max(0, ringsState.n);
    const g = $("#xs-rings");
    g.innerHTML = "";
    // lock rings grow outward from the pith: oldest lock innermost, like a real tree
    const gap = n ? Math.min(13, 160 / n) : 0;
    entries.forEach((e, i) => {
      const k = i + 1, r = 8 + gap * k;
      const d = ringPath(r, k);
      const fresh = k > prev || !ringsState.seen;
      const a = document.createElementNS("http://www.w3.org/2000/svg", "a");
      const url = e.lock_url || (e.escrow ? CONFIG.account + e.escrow : "");
      if (url) { a.setAttribute("href", url); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
      a.dataset.tip = `ring ${k}${e.date ? " · " + e.date : ""} · ${fmt(e.bought || 0)} $FLOG${e.locked_until ? " · locked until " + e.locked_until : ""}`;
      a.innerHTML = `<path class="ring${k === n ? " newest" : ""}${fresh ? "" : " done"}" d="${d}" pathLength="1" style="--delay:${fresh ? (k - prev - 1) * Math.min(90, 1800 / n) : 0}ms"/><path class="ring-hit" d="${d}"/>`;
      g.appendChild(a);
    });
    ringsState.n = n;
    $("#ring-n").textContent = fmt(n);
    $("#ring-l").textContent = n
      ? `ring${n === 1 ? "" : "s"}. ${n === 1 ? "one lock" : fmt(n) + " locks"} on the pile. none of them come off for 70 years.`
      : "rings. the first one grows with the first lock.";
  }
  renderForest(n);
}

function renderForest(n) {
  const lis = $$("#milestones li");
  let cur = -1;
  MILESTONES.forEach((m, i) => { if (n >= m.at) cur = i; });
  lis.forEach((li, i) => {
    li.classList.toggle("reached", i <= cur);
    li.classList.toggle("current", i === cur);
    li.classList.toggle("next", i === cur + 1);
  });
  const step = 100 / (MILESTONES.length - 1);
  let fill = 0;
  if (cur >= MILESTONES.length - 1) fill = 100;
  else if (cur >= 0) {
    const a = MILESTONES[cur].at, b = MILESTONES[cur + 1].at;
    fill = cur * step + ((n - a) / (b - a)) * step;
  }
  $("#ms-fill").style.width = `${fill}%`;
  const next = MILESTONES[cur + 1];
  $("#forest-cap").textContent =
    cur < 0 ? "no logs yet. next milestone: a stick, at 1 log."
    : !next ? `${fmt(n)} logs. old growth. the beaver has given up.`
    : `${fmt(n)} log${n === 1 ? "" : "s"} on the pile. that's ${MILESTONES[cur].name}. next: ${next.name} at ${next.at} (${next.at - n} to go).`;
}

// hover tooltips for rings
document.addEventListener("DOMContentLoaded", () => {
  const svg = $("#xsec"), tip = $("#ring-tip"), wrap = svg?.parentElement;
  if (!svg) return;
  svg.addEventListener("pointermove", (e) => {
    const a = e.target.closest("a[data-tip]");
    if (!a) { tip.hidden = true; svg.querySelector(".hl")?.classList.remove("hl"); return; }
    const box = wrap.getBoundingClientRect();
    tip.textContent = a.dataset.tip;
    tip.hidden = false;
    tip.style.left = `${Math.min(e.clientX - box.left + 14, box.width - tip.offsetWidth - 4)}px`;
    tip.style.top = `${e.clientY - box.top + 14}px`;
    const p = a.querySelector(".ring");
    if (!p.classList.contains("hl")) { svg.querySelector(".hl")?.classList.remove("hl"); p.classList.add("hl"); }
  });
  svg.addEventListener("pointerleave", () => { tip.hidden = true; svg.querySelector(".hl")?.classList.remove("hl"); });
  svg.addEventListener("click", (e) => { if (e.target.closest("a")) knock(1, 1.3); else { knock(2); svg.classList.remove("thunk"); void svg.offsetWidth; svg.classList.add("thunk"); } });
});
