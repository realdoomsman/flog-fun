// shared page effects: knock sound, ambient sound, scroll reveal, parallax, mobile nav, tagline rotator.
// loaded first; everything here is global so the other scripts can call knock().

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- knock on wood (synthesised, no audio files) ----
let actx;
function audio() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function knock(times = 2, pitch = 1) {
  const ac = audio();
  for (let k = 0; k < times; k++) {
    const t = ac.currentTime + k * 0.13;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(260 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    const len = Math.floor(ac.sampleRate * 0.03);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1400 * pitch;
    bp.Q.value = 1.2;
    const ng = ac.createGain();
    ng.gain.value = 0.5;
    noise.connect(bp).connect(ng).connect(ac.destination);
    osc.connect(g).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.14);
    noise.start(t);
  }
}

// ---- ambient: forest wind + birds + VHS hum. off by default, only starts on click ----
const ambient = (() => {
  let out = null, birdTimer = 0;
  function noiseBuffer(ac, secs, brown) {
    const len = ac.sampleRate * secs, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  function loop(ac, buf) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  function bird() {
    if (!out) return;
    const ac = out.ac, t = ac.currentTime, n = 2 + Math.floor(Math.random() * 3), f = 2200 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + i * (0.11 + Math.random() * 0.05);
      o.type = "sine";
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * (1.25 + Math.random() * 0.3), s + 0.06);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.035, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      o.connect(g).connect(out.master);
      o.start(s); o.stop(s + 0.1);
    }
    birdTimer = setTimeout(bird, 2500 + Math.random() * 7000);
  }
  function start() {
    const ac = audio();
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, ac.currentTime);
    master.gain.exponentialRampToValueAtTime(0.9, ac.currentTime + 1.5);
    master.connect(ac.destination);
    // wind: brown noise through a slowly swaying lowpass
    const wind = loop(ac, noiseBuffer(ac, 4, true));
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    const lfo = ac.createOscillator(), lfoG = ac.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 260; lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    const wg = ac.createGain(); wg.gain.value = 0.5;
    wind.connect(lp).connect(wg).connect(master);
    // leaves: quiet highpassed hiss
    const hiss = loop(ac, noiseBuffer(ac, 2, false));
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5200;
    const hg = ac.createGain(); hg.gain.value = 0.012;
    hiss.connect(hp).connect(hg).connect(master);
    // tape hum: 60 hz + a little 120/180
    const hums = [60, 120, 180].map((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; g.gain.value = [0.03, 0.012, 0.005][i];
      o.connect(g).connect(master); o.start();
      return o;
    });
    out = { ac, master, nodes: [wind, hiss, lfo, ...hums] };
    birdTimer = setTimeout(bird, 1200);
  }
  function stop() {
    if (!out) return;
    const { ac, master, nodes } = out;
    clearTimeout(birdTimer);
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.6);
    setTimeout(() => { nodes.forEach((n) => n.stop()); master.disconnect(); }, 700);
    out = null;
  }
  return { toggle() { out ? stop() : start(); return !!out; } };
})();

document.addEventListener("DOMContentLoaded", () => {
  // ambient sound toggle (off until the visitor asks)
  const snd = $("#snd");
  snd?.addEventListener("click", () => {
    const on = ambient.toggle();
    snd.setAttribute("aria-pressed", on);
    snd.classList.toggle("on", on);
    $("#snd-t").textContent = on ? "sound on" : "sound off";
  });
  initReveal(document);
});

// ---- scroll reveal (also used for content rendered later) ----
let revealIO;
function initReveal(root) {
  const els = $$("[data-reveal]:not(.in)", root);
  if (REDUCED || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
  revealIO = revealIO || new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    revealIO.unobserve(e.target);
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  // stagger siblings that reveal together
  els.forEach((el) => {
    const sib = el.parentElement ? [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal")) : [];
    el.style.setProperty("--d", `${Math.min(sib.indexOf(el), 8) * 70}ms`);
    revealIO.observe(el);
  });
}


// ---- small shared helpers ----
const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
function downloadCanvas(cv, name) {
  return new Promise((res) => {
    try {
      cv.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        res(true);
      }, "image/png");
    } catch {
      // canvas export is blocked when the page is opened straight from disk (file://)
      alert("download needs the site to be hosted (or run: python -m http.server in site/).");
      res(false);
    }
  });
}
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function digicamDate(d = new Date()) {
  return `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getDate()).padStart(2, "0")}`;
}
// orange digicam date stamp, bottom right
function drawStamp(ctx, W, H, text) {
  const size = Math.round(Math.min(W, H) * 0.06);
  ctx.save();
  ctx.font = `${size}px VT323, monospace`;
  ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(255,120,20,.9)"; ctx.shadowBlur = size * 0.22;
  ctx.fillStyle = "#ff7a14";
  ctx.fillText(text, W - size * 0.72, H - size * 0.72);
  ctx.restore();
}

// ---- lazy-init + pause helpers for heavy widgets ----
const IS_SMALL = matchMedia("(max-width: 700px), (pointer: coarse)").matches;
// run cb once, the first time el comes near the viewport
function whenVisible(el, cb, margin = "300px") {
  if (!el) return;
  if (!("IntersectionObserver" in window)) return cb();
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); cb(); }
  }, { rootMargin: margin });
  io.observe(el);
}
// call onEnter / onLeave whenever el enters / leaves the viewport (use to pause animation loops)
function onScreen(el, onEnter, onLeave) {
  if (!el) return;
  new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? onEnter() : onLeave()))).observe(el);
}
// load a script once (CDN libs), resolves when ready
const _scripts = {};
function loadScript(src) {
  return (_scripts[src] = _scripts[src] || new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  }));
}
