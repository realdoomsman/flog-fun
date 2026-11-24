// the vhs layer: a once-per-session "tape goes in" boot, the camcorder osd that sits over the whole
// journey (rec, sp, date, tape counter, beat titles), and the crt/vhs post-process shader for the 3d world.
// public: window.FLOG_VHS_FRAG, window.FLOG_VHS_VERT (strings), vhsGlitch(power), vhsGlitchLevel().

// ---- post-process shader for WorldCore (three.js ShaderPass style: varying vUv from the vertex shader) ----
// uniforms: tDiffuse sampler2D, uTime float (s), uRes vec2 (drawing-buffer px), uAmount 0..1 (0 = passthrough), uGlitch 0..1
window.FLOG_VHS_VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
window.FLOG_VHS_FRAG = `uniform sampler2D tDiffuse;
uniform float uTime;
uniform vec2 uRes;
uniform float uAmount;
uniform float uGlitch;
varying vec2 vUv;
float vhsHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  float a = clamp(uAmount, 0.0, 1.0), g = clamp(uGlitch, 0.0, 1.0);
  // barrel curvature (vUv.y = 0 at the bottom)
  vec2 c = vUv * 2.0 - 1.0;
  c.x *= 1.0 + c.y * c.y * 0.045 * a;
  c.y *= 1.0 + c.x * c.x * 0.06 * a;
  vec2 uv = c * 0.5 + 0.5;
  float tq = floor(uTime * 20.0);
  float ln = floor(uv.y * uRes.y / 3.0);
  // rolling tracking band, glitch tears
  float band = exp(-pow((uv.y - (1.15 - fract(uTime * 0.055) * 1.3)) * 15.0, 2.0));
  float tear = step(1.0 - g * 0.45, vhsHash(vec2(floor(uv.y * 38.0), tq)));
  float jit = (vhsHash(vec2(ln, tq)) - 0.5) * (0.0007 * a + 0.03 * g * g);
  jit += band * a * 0.003 * sin(uv.y * 220.0 + uTime * 12.0);
  jit += tear * (vhsHash(vec2(tq, floor(uv.y * 38.0))) - 0.5) * 0.09 * g;
  uv.x += jit;
  // chroma offset
  float ca = (0.0011 + 0.0025 * band) * a + 0.012 * g;
  vec3 col = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
  // bloom-ish lift from a cheap 4-tap blur of the bright parts
  vec2 px = 3.0 / uRes;
  vec3 b = texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb
         + texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb;
  col += max(b * 0.25 - 0.45, 0.0) * 0.6 * a;
  col = col * (1.0 + 0.07 * a) + 0.012 * a;
  // grain + tear static
  float n = vhsHash(vUv * uRes + fract(uTime * 7.13) * 91.0);
  col += (n - 0.5) * (0.055 * a + 0.3 * g + 0.12 * band * a);
  col = mix(col, vec3(n), tear * g * 0.55);
  // scanlines, flicker
  col *= 1.0 - a * 0.16 * (0.5 + 0.5 * sin(vUv.y * uRes.y * 2.0944));
  col *= 1.0 + a * 0.014 * sin(uTime * 113.0);
  // vignette + dark tube edge
  float vg = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
  col *= mix(1.0, pow(clamp(vg * 16.0, 0.0, 1.0), 0.25), a);
  float edge = smoothstep(0.0, 0.004, uv.x) * smoothstep(0.0, 0.004, 1.0 - uv.x) * smoothstep(0.0, 0.006, uv.y) * smoothstep(0.0, 0.006, 1.0 - uv.y);
  col *= mix(1.0, edge, a);
  gl_FragColor = vec4(col, 1.0);
}`;

const vhsCore = (() => {
  const root = document.documentElement;
  const isStatic = () => root.classList.contains("static");
  const calm = () => REDUCED || isStatic();
  const pad = (n) => String(n).padStart(2, "0");
  const TAPE_SECONDS = 420; // whole journey = 0:07:00 of tape
  let glitchAt = -1e9, glitchPow = 0;

  function glitch(power = 1) {
    glitchAt = performance.now();
    glitchPow = Math.max(0, Math.min(1, power));
    layer.burst();
  }
  function glitchLevel() {
    if (calm()) return 0;
    const k = (performance.now() - glitchAt) / 420;
    return k >= 1 ? 0 : glitchPow * (1 - k) * (1 - k);
  }

  // ---------- noise frames shared by boot + layer ----------
  function noiseFrames(ctx, w, h, count, alpha) {
    return Array.from({ length: count }, () => {
      const img = ctx.createImageData(w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = alpha;
      }
      return img;
    });
  }

  // ---------- boot intro ----------
  function boot() {
    let seen = true;
    try { seen = !!sessionStorage.getItem("flog-booted"); if (!seen && !calm()) sessionStorage.setItem("flog-booted", "1"); } catch (e) { seen = true; }
    if (seen || calm()) { root.classList.remove("vhs-booting"); return false; }

    const el = document.createElement("div");
    el.className = "vhs-boot";
    el.innerHTML = `
      <div class="boot-stage" aria-hidden="true">
        <div class="boot-deck">
          <span class="boot-slot"><span class="boot-mouth"><span class="boot-tape"><span class="boot-win"><i></i><i></i></span><span class="boot-label">flog &middot; tape 00</span></span></span></span>
          <span class="boot-vfd"><b class="boot-count">0000</b><b class="boot-play">PLAY &#9654;</b></span>
          <span class="boot-silk">sp &middot; hq &middot; solid wood</span>
        </div>
      </div>
      <div class="boot-flash" aria-hidden="true"></div>
      <canvas class="boot-static" aria-hidden="true"></canvas>
      <button class="boot-skip" type="button">skip</button>`;
    document.body.appendChild(el);
    root.classList.remove("vhs-booting");

    const count = el.querySelector(".boot-count");
    const cv = el.querySelector(".boot-static");
    const ctx = cv.getContext("2d");
    const w = Math.min(420, Math.ceil(innerWidth / 3)), h = Math.max(2, Math.round(w * innerHeight / innerWidth));
    cv.width = w; cv.height = h;
    // per-pixel dissolve thresholds, banded by row so it clears like a tape locking on
    const thr = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = Math.random();
      for (let x = 0; x < w; x++) thr[y * w + x] = (Math.random() * 0.62 + row * 0.38) * 255;
    }
    const img = ctx.createImageData(w, h), d = img.data;

    const T_SPIN = 1000, T_STATIC = 1600, T_DISSOLVE = 1900, T_END = 2550;
    const t0 = performance.now();
    let raf = 0, done = false, phase = 0;
    const step = (now) => {
      const t = now - t0;
      if (t > T_SPIN && t < T_STATIC) {
        const k = (t - T_SPIN) / (T_STATIC - T_SPIN);
        count.textContent = k < 0.75 ? String((Math.random() * 10000) | 0).padStart(4, "0") : "0:00:00";
      }
      if (t >= T_STATIC - 80 && phase === 0) { phase = 1; el.classList.add("boot-tv"); }
      if (t >= T_STATIC) {
        const p = Math.max(0, Math.min(1, (t - T_DISSOLVE) / (T_END - T_DISSOLVE - 100)));
        const cut = p * p * 255, roll = (t * 0.06) % h;
        for (let i = 0, j = 0; i < thr.length; i++, j += 4) {
          const y = (i / w) | 0, bar = Math.abs(y - roll) < h * 0.05 ? 50 : 0;
          const v = Math.min(255, ((Math.random() * 235) | 0) + bar);
          d[j] = d[j + 1] = d[j + 2] = v;
          d[j + 3] = thr[i] >= cut ? 255 : 0;
        }
        ctx.putImageData(img, 0, 0);
      }
      if (t >= T_END) return finish(false);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const evs = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    const skip = () => finish(true);
    function finish(fast) {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      evs.forEach((e) => window.removeEventListener(e, skip, true));
      el.classList.add(fast ? "boot-out" : "boot-end");
      setTimeout(() => { el.remove(); layer.bootDone(); }, fast ? 220 : 60);
    }
    evs.forEach((e) => window.addEventListener(e, skip, { capture: true, passive: true }));
    return true;
  }

  // ---------- persistent camcorder layer ----------
  const layer = (() => {
    let host = null, els = {}, beat = null, titleTimer = 0, burstTimer = 0, loopRaf = 0, lastTick = 0, frames = null, fi = 0, ctx = null, booting = false;

    function build() {
      host = document.getElementById("vhs-layer");
      if (!host) return false;
      host.setAttribute("aria-hidden", "true");
      host.classList.toggle("vhs-booting-now", booting);
      host.innerHTML = `
        <canvas class="vhs-noise"></canvas>
        <div class="vhs-band"></div>
        <div class="vhs-scan"></div>
        <div class="vhs-osd">
          <span class="vhs-rec"><i></i>REC</span>
          <span class="vhs-sp">SP</span>
          <span class="vhs-title"><b class="vhs-ch">CH 01</b> &middot; <span class="vhs-name"></span></span>
          <span class="vhs-date"><span class="vhs-day"></span> <span class="vhs-time"></span></span>
          <span class="vhs-count">0:00:00</span>
        </div>`;
      els = {
        cv: host.querySelector(".vhs-noise"), osd: host.querySelector(".vhs-osd"),
        title: host.querySelector(".vhs-title"), ch: host.querySelector(".vhs-ch"), name: host.querySelector(".vhs-name"),
        day: host.querySelector(".vhs-day"), time: host.querySelector(".vhs-time"), count: host.querySelector(".vhs-count"),
      };
      // low-res noise, scaled up by css; a handful of precomputed frames cycled at ~15fps
      const w = IS_SMALL ? 120 : 240, h = Math.max(2, Math.round(w * innerHeight / Math.max(1, innerWidth)));
      els.cv.width = w; els.cv.height = h;
      ctx = els.cv.getContext("2d");
      frames = noiseFrames(ctx, w, h, calm() ? 1 : 6, 255);
      ctx.putImageData(frames[0], 0, 0);
      applyMode();
      clock();
      setInterval(() => { if (!document.hidden) clock(); }, 1000);
      window.addEventListener("flog:scroll", (e) => onScroll(e.detail || window.FLOG_SCROLL));
      document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
      new MutationObserver(applyMode).observe(root, { attributes: true, attributeFilter: ["class"] });
      if (window.FLOG_SCROLL) onScroll(window.FLOG_SCROLL, true);
      return true;
    }

    function applyMode() {
      if (!host) return;
      host.classList.toggle("vhs-calm", calm());
      if (calm()) { stop(); if (ctx && frames) ctx.putImageData(frames[0], 0, 0); } else start();
    }

    function clock() {
      const d = new Date(), h = d.getHours();
      const mon = (typeof MON !== "undefined" ? MON : ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])[d.getMonth()];
      els.day.textContent = `${mon} ${pad(d.getDate())} ${d.getFullYear()}`;
      els.time.textContent = `${h % 12 || 12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${h < 12 ? "AM" : "PM"}`;
    }

    function onScroll(s, initial) {
      if (!s) return;
      const sec = Math.round(Math.max(0, Math.min(1, s.progress || 0)) * TAPE_SECONDS);
      els.count.textContent = `${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
      if (s.beat && s.beat !== beat) {
        const first = beat === null;
        beat = s.beat;
        const beats = Array.isArray(s.beats) ? s.beats : [];
        const i = beats.findIndex((b) => b.id === beat);
        const node = (beats[i] && beats[i].el) || document.getElementById(beat);
        els.ch.textContent = `CH ${pad((i >= 0 ? i : 0) + 1)}`;
        els.name.textContent = (node && node.dataset && node.dataset.title) || beat;
        if (!booting) showTitle();
        if (!first && !initial) glitch(0.8);
      }
    }

    function showTitle() {
      els.title.classList.add("on");
      clearTimeout(titleTimer);
      titleTimer = setTimeout(() => els.title.classList.remove("on"), 2100);
    }

    function burst() {
      if (!host || calm()) return;
      host.classList.remove("vhs-burst"); void host.offsetWidth; host.classList.add("vhs-burst");
      clearTimeout(burstTimer);
      burstTimer = setTimeout(() => host.classList.remove("vhs-burst"), 420);
      start();
    }

    function tick(now) {
      loopRaf = 0;
      if (document.hidden || calm()) return;
      if (now - lastTick >= 66) {
        lastTick = now;
        fi = (fi + 1 + ((Math.random() * 3) | 0)) % frames.length;
        ctx.putImageData(frames[fi], 0, 0);
        const g = glitchLevel();
        if (g > 0) {
          // tear bars during a burst
          const w = els.cv.width, h = els.cv.height;
          for (let k = 0; k < 5; k++) {
            ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${0.5 * g})` : `rgba(0,0,0,${0.6 * g})`;
            ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * h * 0.05);
          }
        }
      }
      loopRaf = requestAnimationFrame(tick);
    }
    function start() { if (host && !loopRaf && !document.hidden && !calm()) loopRaf = requestAnimationFrame(tick); }
    function stop() { if (loopRaf) cancelAnimationFrame(loopRaf); loopRaf = 0; }

    return {
      build,
      burst,
      setBooting(v) { booting = v; if (host) host.classList.toggle("vhs-booting-now", v); },
      bootDone() { booting = false; if (host) { host.classList.remove("vhs-booting-now"); if (beat) showTitle(); } },
    };
  })();

  const booted = boot();
  layer.setBooting(booted);
  layer.build();

  return { glitch, glitchLevel };
})();

function vhsGlitch(power) { vhsCore.glitch(power == null ? 1 : power); }
function vhsGlitchLevel() { return vhsCore.glitchLevel(); }
