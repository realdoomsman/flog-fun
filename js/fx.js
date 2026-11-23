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
  // sound toggle
  const snd = $("#snd");
  snd.addEventListener("click", () => {
    const on = ambient.toggle();
    snd.setAttribute("aria-pressed", on);
    snd.classList.toggle("on", on);
    $("#snd-t").textContent = on ? "sound on" : "sound off";
  });

  // mobile nav
  const burger = $("#burger"), nav = $("#nav");
  const setNav = (open) => { document.body.classList.toggle("nav-open", open); burger.setAttribute("aria-expanded", open); };
  burger.addEventListener("click", () => setNav(!document.body.classList.contains("nav-open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });

  // nav highlight for the section on screen
  const navLinks = new Map($$("#nav a").map((a) => [a.getAttribute("href").slice(1), a]));
  const navIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.classList.remove("on"));
    navLinks.get(e.target.id)?.classList.add("on");
  }), { rootMargin: "-45% 0px -50% 0px" });
  navLinks.forEach((_, id) => { const s = document.getElementById(id); if (s) navIO.observe(s); });

  // header goes solid after the hero
  const top = $(".top");
  const onScroll = () => top.classList.toggle("scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // tagline rotator in the hero
  const TAGS = ["logs don't sell.", "fees in. logs up.", "wooden hands > diamond hands.", "don't trust the frog. check the log.", "you can't sell if you're wood.", "the pile doesn't sell.", "knock on wood."];
  const rot = $("#rot");
  if (rot && !REDUCED) {
    let i = 0;
    const type = async (txt) => {
      for (let n = rot.textContent.length; n >= 0; n--) { rot.textContent = rot.textContent.slice(0, n); await new Promise((r) => setTimeout(r, 22)); }
      for (let n = 1; n <= txt.length; n++) { rot.textContent = txt.slice(0, n); await new Promise((r) => setTimeout(r, 45)); }
    };
    setInterval(() => { i = (i + 1) % TAGS.length; type(TAGS[i]); }, 3800);
  }

  initReveal(document);
  initParallax();
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

// ---- subtle parallax for [data-parallax] (hero video) ----
function initParallax() {
  const els = $$("[data-parallax]");
  if (REDUCED || !els.length) return;
  let queued = false;
  const run = () => {
    queued = false;
    const y = scrollY;
    els.forEach((el) => { if (y < innerHeight * 1.2) el.style.transform = `translate3d(0, ${y * +el.dataset.parallax}px, 0) scale(1.04)`; });
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(run); } }, { passive: true });
  run();
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
