// the 3d journey: a moonlit night forest you walk through by scrolling (three.js, loaded lazily).
// classic defer script. three comes from the import map ("three", "three/addons/").
// public: window.FLOG_WORLD (see the journey contract) + 'flog:world-ready' on window.
// if webgl can't start: <html> gets .static (not .webgl) and 'flog:static' fires on window.

(() => {
  "use strict";
  const HTMLEL = document.documentElement;
  if (HTMLEL.classList.contains("static")) return;

  // paths resolve against the site root (this file lives in js/), so a harness page elsewhere works too
  const SCRIPT_SRC = document.currentScript && document.currentScript.src;
  const BASE = new URL("../", SCRIPT_SRC || location.href);
  const OPTS = window.FLOG_WORLD_OPTS || {};
  const siteUrl = (p) => new URL(p, BASE).href;
  const SMALL = typeof IS_SMALL !== "undefined" ? IS_SMALL : matchMedia("(max-width: 700px), (pointer: coarse)").matches;
  const QUALITY = OPTS.quality || (SMALL ? "low" : "high");
  const LOW = QUALITY === "low";
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  // ---- world layout (contract anchors) ----
  const BEATS = ["tape", "forest", "flog", "lignification", "sawmill", "pile", "log", "proof", "end"];
  const CLEARINGS = [
    { x: 0, z: -85, r: 10, fog: 0.019 },   // flog
    { x: 7, z: -165, r: 12, fog: 0.02 },   // sawmill
    { x: -6, z: -205, r: 11, fog: 0.02 },  // pile
    { x: 0, z: -226, r: 6, fog: 0.022 },   // under the rings disc (line of sight)
    { x: 0, z: -252, r: 9, fog: 0.02 },    // ledger log
    { x: 0, z: -268, r: 7, fog: 0.022 },   // proof
    { x: 0, z: -298, r: 14, fog: 0.011 },  // end clearing, open sky
  ];
  // camera path keys: eye position + what to look at (null = look ahead along the path)
  // on small screens the sawmill/pile views pull back so the machines fit a portrait frame
  const PB = SMALL ? 3.5 : 0;
  const KEYS = [
    [[0, 1.6, 12], null],                          // 0  tape: forest edge
    [[0.4, 1.6, 1], null],                         // 1  into the trees
    [[-1.1, 1.65, -22], null],                     // 2
    [[1.0, 1.6, -46], null],                       // 3
    [[0, 1.6, -66], null],                         // 4  clearing ahead
    [[0, 1.36, -79.8], [0, 0.78, -85]],            // 5  flog
    [[-3.6, 1.6, -88], null],                      // 6  around him
    [[-1.2, 1.6, -100], null],                     // 7  lignification corridor
    [[1.0, 1.65, -118], null],                     // 8
    [[0, 1.6, -138], null],                        // 9
    [[-1.6 - PB, 1.7, -157.5], [7, 2.4, -161]],    // 10 sawmill, feed end (look right)
    [[-1.8 - PB, 1.7, -166], [7, 2.2, -170]],      // 11 sawmill, exit end (pan along the machine)
    [[-0.6, 1.7, -183], null],                     // 12
    [[1.5 + PB * 0.8, 1.7, -199], [-6, 2.2, -205]], // 13 pile (look left)
    [[0, 1.6, -217], [0, 7.4, -228]],              // 14 rings disc (look up)
    [[0, 3.0, -242.5], [0, 1.6, -252]],            // 15 ledger log
    [[0, 5.0, -252], null],                        // 16 over the log
    [[0, 1.8, -263], null],                        // 17 proof
    [[0, 1.7, -276], null],                        // 18
    [[0, 1.65, -288], null],                       // 19 end clearing
    [[0, 1.7, -296], [-10, 9, -336]],              // 20 open sky, toward the moon
  ];
  // beat local (0..1) -> path index; pairs with the same index are dwell points
  const BEAT_PATH = {
    tape: [[0, 0], [0.3, 0], [1, 1]],
    forest: [[0, 1], [1, 4]],
    flog: [[0, 4], [0.4, 5], [0.78, 5], [1, 6]],
    lignification: [[0, 6], [1, 9]],
    sawmill: [[0, 9], [0.32, 10], [0.8, 11], [1, 12]],
    pile: [[0, 12], [0.3, 13], [0.55, 13], [0.75, 14], [0.92, 14], [1, 14.4]],
    log: [[0, 14.4], [0.35, 15], [0.85, 15], [1, 15.6]],
    proof: [[0, 15.6], [0.4, 17], [1, 18]],
    end: [[0, 18], [0.6, 20], [1, 20]],
  };
  const CARVE_ZONES = { forest: [-7, -63], lignification: [-99, -136] };
  const CARVE_FALLBACK = {
    forest: ["logs don't sell.", "he kept sitting.", "wooden hands > diamond hands."],
    lignification: ["vote log.", "count the rings.", "don't trust the frog. check the log."],
  };

  // ---- small math helpers ----
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (t) => t * t * (3 - 2 * t);
  function rng32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }

  const GLSL_NOISE = `
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h21(i), h21(i+vec2(1.,0.)), f.x), mix(h21(i+vec2(0.,1.)), h21(i+vec2(1.,1.)), f.x), f.y); }
    float fbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a*vn(p); p *= 2.03; a *= 0.5; } return s; }`;

  // ---- static fallback ----
  function goStatic(why) {
    HTMLEL.classList.remove("webgl");
    HTMLEL.classList.add("static");
    const cv = document.getElementById("world");
    if (cv) cv.style.display = "none";
    window.dispatchEvent(new CustomEvent("flog:static", { detail: { reason: why } }));
  }

  // ---- boot: after load + idle ----
  function boot() {
    const go = () => { start().catch((e) => { console.error("[world3d]", e); goStatic("error"); }); };
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 200);
  }
  if (document.readyState === "complete") boot();
  else addEventListener("load", boot, { once: true });

  async function start() {
    if (HTMLEL.classList.contains("static") || window.FLOG_WORLD) return;
    let canvas = document.getElementById("world");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "world";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:0;display:block";
      document.body.prepend(canvas);
    }
    // probe the context ourselves so a failure never reaches three's console.error
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: "high-performance" });
    if (!gl) { goStatic("no-webgl2"); return; }

    const THREE = await import("three");
    if (HTMLEL.classList.contains("static")) return; // user switched to the plain page meanwhile
    build(THREE, canvas, gl);
  }

  function build(THREE, canvas, gl) {
    const V3 = THREE.Vector3;
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, powerPreference: "high-performance" });
    const DPR = LOW ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(DPR);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    const FOG_COLOR = new THREE.Color(0x0e1727);
    scene.background = FOG_COLOR.clone();
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.034);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
    const clock = new THREE.Clock();
    const MOON_DIR = new V3(-0.28, 0.34, -1).normalize();

    // ---- path ----
    const curve = new THREE.CatmullRomCurve3(KEYS.map((k) => new V3(...k[0])), false, "centripetal");
    const LAST = KEYS.length - 1;
    const LOOKS = KEYS.map((k) => (k[1] ? new V3(...k[1]) : null));
    // pathX(z): lateral centre of the path at depth z (dense table from the curve)
    const PZ0 = 30, PZ1 = -360, PSTEP = 0.5, PN = Math.round((PZ0 - PZ1) / PSTEP) + 1;
    const pathXs = new Float32Array(PN);
    {
      const samples = curve.getPoints(1600);
      let j = 0;
      for (let k = 0; k < PN; k++) {
        const z = PZ0 - k * PSTEP;
        while (j < samples.length - 2 && samples[j + 1].z > z) j++;
        const a = samples[j], b = samples[j + 1];
        if (z >= samples[0].z) pathXs[k] = samples[0].x;
        else if (z <= samples[samples.length - 1].z) pathXs[k] = samples[samples.length - 1].x;
        else pathXs[k] = lerp(a.x, b.x, clamp01((a.z - z) / Math.max(1e-6, a.z - b.z)));
      }
    }
    function pathX(z) {
      const f = (PZ0 - z) / PSTEP;
      if (f <= 0) return pathXs[0];
      if (f >= PN - 1) return pathXs[PN - 1];
      const i = Math.floor(f);
      return lerp(pathXs[i], pathXs[i + 1], f - i);
    }
    function groundHeight(x, z) {
      const dx = Math.abs(x - pathX(z));
      let amp = smooth(3, 24, dx), flat = 1;
      for (const c of CLEARINGS) {
        const d = Math.hypot(x - c.x, z - c.z);
        amp *= smooth(c.r + 1, c.r + 12, d);
        flat *= smooth(c.r - 1, c.r + 2, d);
      }
      const big = (fbm(x * 0.035 + 3.1, z * 0.035 - 1.7) - 0.45) * 7;
      const micro = (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.08 * flat;
      return big * amp + micro;
    }

    // ---- lights ----
    const hemi = new THREE.HemisphereLight(0x4a6494, 0x1a140e, 1.9);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xaec4ff, 2.2);
    moon.position.copy(MOON_DIR).multiplyScalar(100);
    scene.add(moon, moon.target);

    // ---- canvas texture helpers ----
    function canvasTex(w, h, draw, srgb = true) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(LOW ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
      return t;
    }
    const softDot = canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });

    // ---- sky dome: gradient, stars, moon ----
    const skyU = {
      uHorizon: { value: FOG_COLOR.clone() },
      uZenith: { value: new THREE.Color(0x02040a) },
      uMoonDir: { value: MOON_DIR.clone() },
      uTime: { value: 0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(420, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uHorizon, uZenith, uMoonDir; uniform float uTime; varying vec3 vDir;
          float hs(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          void main(){
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, h));
            float m = max(dot(d, uMoonDir), 0.0);
            col += vec3(0.25, 0.32, 0.5) * (pow(m, 18.0) * 0.12 + pow(m, 160.0) * 0.35);
            // moon disc with soft maria
            float disc = smoothstep(0.99955, 0.99968, m);
            float maria = 0.82 + 0.18 * sin(d.x * 900.0 + d.y * 600.0) * sin(d.z * 700.0 - d.y * 500.0);
            col = mix(col, vec3(2.6, 2.7, 3.0) * maria, disc);
            // stars
            vec3 cell = floor(d * 260.0);
            float s = hs(cell);
            float tw = 0.6 + 0.4 * sin(uTime * (1.5 + s * 3.0) + s * 40.0);
            float star = step(0.9965, s) * smoothstep(0.08, 0.35, h) * (1.0 - smoothstep(0.98, 0.999, m));
            vec3 fc = fract(d * 260.0) - 0.5;
            col += vec3(0.9, 0.95, 1.1) * star * tw * smoothstep(0.32, 0.0, length(fc)) * 1.6;
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    scene.add(sky);

    // ---- ground ----
    const groundTex = canvasTex(512, 512, (g, w) => {
      const r = rng32(7);
      g.fillStyle = "#1b1611"; g.fillRect(0, 0, w, w);
      for (let i = 0; i < 260; i++) { // soil + moss blotches (wrapped so it tiles)
        const x = r() * w, y = r() * w, rad = 8 + r() * 40, moss = r() < 0.45;
        g.fillStyle = moss ? `rgba(${40 + r() * 20},${58 + r() * 25},${30 + r() * 12},${0.12 + r() * 0.2})` : `rgba(${12 + r() * 20},${10 + r() * 14},${8 + r() * 8},${0.2 + r() * 0.25})`;
        for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) { g.beginPath(); g.arc(x + ox, y + oy, rad, 0, TAU); g.fill(); }
      }
      g.lineCap = "round";
      for (let i = 0; i < 2600; i++) { // pine needles
        const x = r() * w, y = r() * w, a = r() * TAU, l = 4 + r() * 9;
        g.strokeStyle = `rgba(${70 + r() * 50},${45 + r() * 30},${25 + r() * 15},${0.35 + r() * 0.45})`;
        g.lineWidth = 0.7 + r() * 0.8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.4})`; g.fillRect(r() * w, r() * w, 1 + r() * 2, 1 + r() * 2); }
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(240 / 5, 440 / 5);
    {
      const GW = 240, GL = 440, sx = LOW ? 70 : 120, sz = LOW ? 150 : 260;
      const geo = new THREE.PlaneGeometry(GW, GL, sx, sz);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0, -150);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, groundHeight(x, z));
        const dx = Math.abs(x - pathX(z));
        const moss = smooth(0.45, 0.7, fbm(x * 0.07 + 11, z * 0.07 - 4));
        const trod = 1 - smooth(0.6, 1.9, dx);
        const tone = 0.85 + 0.3 * vnoise(x * 0.15, z * 0.15);
        let r = tone, gg = tone, b = tone;
        r = lerp(r, tone * 0.75, moss); gg = lerp(gg, tone * 1.15, moss); b = lerp(b, tone * 0.7, moss);
        r = lerp(r, 1.35, trod); gg = lerp(gg, 1.22, trod); b = lerp(b, 1.08, trod);
        col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: groundTex, vertexColors: true }));
      ground.name = "ground";
      scene.add(ground);
    }

    // ---- trees ----
    const windU = { value: 0 };
    function windMaterial(opts) {
      const m = new THREE.MeshLambertMaterial(opts);
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uWind = windU;
        sh.vertexShader = "uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 wIp = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          #else
            vec3 wIp = vec3(modelMatrix[3][0], 0.0, modelMatrix[3][2]);
          #endif
          float wPh = wIp.x * 0.21 + wIp.z * 0.13;
          float wH = max(position.y - 2.5, 0.0) / 10.0; wH *= wH;
          transformed.x += (sin(uWind * 0.9 + wPh) * 0.6 + sin(uWind * 2.3 + wPh * 1.7) * 0.22) * wH * 0.35;
          transformed.z += cos(uWind * 0.7 + wPh) * wH * 0.14;`);
      };
      m.customProgramCacheKey = () => "flog-wind";
      return m;
    }
    const treeMat = windMaterial({ vertexColors: true });

    function mergeGeos(list) {
      const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
      let n = 0; parts.forEach((g) => (n += g.attributes.position.count));
      const P = new Float32Array(n * 3), C = new Float32Array(n * 3);
      let o = 0;
      for (const g of parts) { P.set(g.attributes.position.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.BufferAttribute(P, 3));
      out.setAttribute("color", new THREE.BufferAttribute(C, 3));
      out.computeVertexNormals();
      return out;
    }
    function paint(g, c0, c1, y0, y1) {
      const p = g.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const t = clamp01((p.getY(i) - y0) / (y1 - y0));
        for (let k = 0; k < 3; k++) c[i * 3 + k] = lerp(c0[k], c1[k], t);
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      return g;
    }
    function jitter(g, amt, droop, keepTop) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (keepTop !== undefined && y >= keepTop - 1e-4) continue;
        const h = hash2(Math.round(x * 997) + Math.round(y * 131), Math.round(z * 997));
        const rr = Math.hypot(x, z);
        if (rr > 1e-4) { const s = 1 + (h - 0.5) * amt; p.setX(i, x * s); p.setZ(i, z * s); }
        if (droop && rr > 0.3) p.setY(i, y - h * droop);
      }
    }
    const PINE_H = 12;
    function pineGeo(seed, opt) {
      const r = rng32(seed), parts = [];
      const trunk = new THREE.CylinderGeometry(0.1, 0.3, PINE_H * 0.95, LOW ? 5 : 7, 1, true);
      trunk.translate(0, PINE_H * 0.475, 0);
      parts.push(paint(trunk.toNonIndexed(), [0.16, 0.12, 0.09], [0.1, 0.08, 0.065], 0, PINE_H));
      const n = opt.cones;
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1);
        const rad = lerp(opt.maxR, 0.45, f) * (0.88 + r() * 0.24);
        const h = lerp(3.5, 1.7, f);
        const y = lerp(opt.base, PINE_H - 1.7, f);
        const g = new THREE.ConeGeometry(rad, h, opt.radial, 1, false).toNonIndexed();
        g.rotateY(r() * TAU);
        jitter(g, 0.32, 0.45, h / 2);
        g.translate(0, y + h / 2, 0);
        const dark = [0.07, 0.11, 0.09].map((v) => v * (0.85 + r() * 0.3));
        const lite = [0.17, 0.26, 0.21].map((v) => v * (0.85 + r() * 0.3));
        parts.push(paint(g, dark, lite, y - 0.3, y + h));
      }
      return mergeGeos(parts);
    }
    function deadGeo(seed) {
      const r = rng32(seed), parts = [];
      const trunk = new THREE.CylinderGeometry(0.06, 0.28, PINE_H, 6, 1, true);
      trunk.translate(0, PINE_H / 2, 0);
      parts.push(paint(trunk.toNonIndexed(), [0.2, 0.19, 0.18], [0.27, 0.26, 0.25], 0, PINE_H));
      for (let k = 0; k < 7; k++) {
        const len = 1.1 + r() * 1.8;
        const b = new THREE.CylinderGeometry(0.015, 0.06, len, 4, 1, true);
        b.translate(0, len / 2, 0);
        b.rotateZ(-(0.7 + r() * 0.5));
        b.rotateY(r() * TAU);
        b.translate(0, 3.5 + k * 1.1 + r() * 0.6, 0);
        parts.push(paint(b.toNonIndexed(), [0.21, 0.2, 0.19], [0.26, 0.25, 0.24], 0, PINE_H));
      }
      return mergeGeos(parts);
    }
    const radial = LOW ? 6 : 8, cones = LOW ? 5 : 7;
    const TREE_GEOS = [
      pineGeo(11, { cones, radial, maxR: 2.5, base: 3.2 }),
      pineGeo(23, { cones: cones + 1, radial, maxR: 2.1, base: 3.8 }),
      pineGeo(37, { cones: cones - 1, radial, maxR: 2.9, base: 3.4 }),
      deadGeo(5),
    ];

    // carved trunk spots (decided first so the forest leaves them room)
    const carveSpots = [];
    {
      for (const beat of ["forest", "lignification"]) {
        let texts = [...document.querySelectorAll(`#${beat} [data-carve], [data-beat="${beat}"] [data-carve]`)]
          .map((el) => (el.dataset.carve || el.textContent || "").trim().toLowerCase())
          .filter(Boolean);
        texts = [...new Set(texts)];
        if (!texts.length) texts = CARVE_FALLBACK[beat];
        const [z0, z1] = CARVE_ZONES[beat];
        texts.forEach((text, k) => {
          const z = lerp(z0, z1, (k + 0.5) / texts.length);
          const side = (k + (beat === "forest" ? 0 : 1)) % 2 ? -1 : 1;
          const x = pathX(z) + side * (SMALL ? 2.05 : 2.35);
          carveSpots.push({ text, beat, x, z, side });
        });
      }
    }

    // scatter: denser away from the path, never in the clearings
    const chunks = new Map(); // chunk index -> arrays of matrices per variant
    {
      const r = rng32(1337);
      const N = LOW ? 600 : 1800, MAXDX = LOW ? 30 : 56;
      const grid = new Set();
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(), up = new V3(0, 1, 0);
      const col = new THREE.Color();
      let placed = 0, tries = 0;
      while (placed < N && tries < N * 60) {
        tries++;
        const z = 24 - r() * 366;
        const side = r() < 0.5 ? -1 : 1;
        const dx = 2.9 + r() * (MAXDX - 2.9);
        const x = pathX(z) + side * dx;
        if (r() > 0.45 + 0.55 * smooth(3, 16, dx)) continue;
        if (z > 3 && r() > 0.12 + 0.6 * smooth(6, 30, dx) * smooth(14, 4, z)) continue; // meadow before the edge
        let bad = false;
        for (const c of CLEARINGS) if (Math.hypot(x - c.x, z - c.z) < c.r + 2.2) { bad = true; break; }
        // leave a window toward the moon from the end clearing
        if (!bad && z < -300) { const ez = z + 298, d = Math.hypot(x, ez); if (d < 75 && (x * -0.27 + ez * -0.963) / d > 0.93) bad = true; }
        if (!bad) for (const c of carveSpots) if (Math.hypot(x - c.x, z - c.z) < 2.6) { bad = true; break; }
        if (bad) continue;
        const key = Math.round(x / 1.7) + "," + Math.round(z / 1.7);
        if (grid.has(key)) continue;
        grid.add(key);
        const dead = r() < 0.08;
        const v = dead ? 3 : Math.floor(r() * 3);
        // near the path the crowns sit higher so they never cover the camera
        const h = (dx < 7 ? 11 : 8.5) + r() * 9;
        const k = h / PINE_H, w = k * (0.85 + r() * 0.3);
        p.set(x, groundHeight(x, z) - 0.15, z);
        q.setFromAxisAngle(up, r() * TAU);
        s.set(w, k, w);
        m4.compose(p, q, s);
        const ci = Math.floor((24 - z) / 40);
        if (!chunks.has(ci)) chunks.set(ci, { z: 24 - (ci + 0.5) * 40, lists: [[], [], [], []], cols: [[], [], [], []] });
        const ch = chunks.get(ci);
        ch.lists[v].push(m4.clone());
        const b = 0.72 + r() * 0.5;
        col.setRGB(b * (0.95 + r() * 0.1), b, b * (0.95 + r() * 0.12));
        ch.cols[v].push(col.clone());
        placed++;
      }
    }
    const treeChunks = [];
    for (const ch of chunks.values()) {
      const g = new THREE.Group();
      g.userData.z = ch.z;
      ch.lists.forEach((list, v) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(TREE_GEOS[v], treeMat, list.length);
        list.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, ch.cols[v][i]); });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        g.add(im);
      });
      scene.add(g);
      treeChunks.push(g);
    }

    // ---- carved trunks ----
    const barkTex = canvasTex(256, 512, (g, w, h) => {
      const r = rng32(99);
      g.fillStyle = "#2b211a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { // bark plates
        const x = r() * w, y = r() * h, pw = 14 + r() * 30, ph = 30 + r() * 70, c = 30 + r() * 30;
        g.fillStyle = `rgba(${c + 8},${c},${c - 8},${0.5 + r() * 0.4})`;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) g.fillRect(x + ox, y + oy, pw, ph);
      }
      g.strokeStyle = "rgba(8,5,3,.85)";
      for (let i = 0; i < 46; i++) { // furrows
        let x = r() * w; g.lineWidth = 1.5 + r() * 3; g.beginPath(); g.moveTo(x, 0);
        for (let y = 0; y <= h; y += 16) { x += (r() - 0.5) * 7; g.lineTo(x, y); }
        g.stroke();
      }
    });
    barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
    barkTex.repeat.set(3, 9);
    const barkMat = new THREE.MeshLambertMaterial({ map: barkTex, color: 0xb8ab9c });
    const carvePanels = [];
    let carveFont = "cursive";

    function layoutLines(g, text, W, H) {
      const words = text.split(/\s+/);
      for (let size = 190; size >= 56; size -= 6) {
        g.font = `700 ${size}px ${carveFont}`;
        const lines = [];
        let cur = "";
        for (const wd of words) {
          const t = cur ? cur + " " + wd : wd;
          if (g.measureText(t).width > W * 0.86 && cur) { lines.push(cur); cur = wd; } else cur = t;
        }
        if (cur) lines.push(cur);
        const widest = Math.max(...lines.map((l) => g.measureText(l).width));
        if (lines.length <= 3 && widest <= W * 0.88 && lines.length * size * 0.98 <= H * 0.8) return { lines, size };
      }
      g.font = `700 56px ${carveFont}`;
      return { lines: [text], size: 56 };
    }
    function carveTextures(text, seed) {
      const r = rng32(seed);
      const W = 1024, H = 512;
      const base = document.createElement("canvas"); base.width = W; base.height = H;
      const glow = document.createElement("canvas"); glow.width = W; glow.height = H;
      const g = base.getContext("2d"), e = glow.getContext("2d");
      // the blaze: an axed patch of pale wood
      const pts = [];
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU;
        const rr = 1 - r() * 0.07;
        pts.push([W / 2 + Math.cos(a) * W * 0.47 * rr, H / 2 + Math.sin(a) * H * 0.45 * (0.92 + r() * 0.08)]);
      }
      const blaze = (ctx) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#9a7a55"); gr.addColorStop(1, "#6f5236");
      blaze(g); g.fillStyle = gr; g.fill();
      g.save(); blaze(g); g.clip();
      for (let i = 0; i < 110; i++) { // vertical grain
        let x = r() * W; g.strokeStyle = `rgba(50,30,14,${0.12 + r() * 0.22})`; g.lineWidth = 1 + r() * 3;
        g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= H; y += 24) { x += (r() - 0.5) * 5; g.lineTo(x, y); } g.stroke();
      }
      g.restore();
      blaze(g); g.lineWidth = 16; g.strokeStyle = "rgba(20,13,8,.95)"; g.stroke();
      blaze(g); g.lineWidth = 5; g.strokeStyle = "rgba(175,140,100,.4)"; g.stroke();

      // glyph layout with per-letter knife jitter (same jitter for every pass)
      g.textAlign = "center"; g.textBaseline = "middle";
      const { lines, size } = layoutLines(g, text, W, H);
      const glyphs = [];
      const lh = size * 0.98, top = H / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((line, li) => {
        const lw = g.measureText(line).width;
        let x = W / 2 - lw / 2;
        for (const ch of line) {
          const cw = g.measureText(ch).width;
          glyphs.push({ ch, x: x + cw / 2, y: top + li * lh + (r() - 0.5) * size * 0.06, rot: (r() - 0.5) * 0.12 });
          x += cw;
        }
      });
      const drawGlyphs = (ctx, k, ox, oy, mode) => {
        for (const gl of glyphs) {
          if (gl.ch === " ") continue;
          ctx.save(); ctx.translate((gl.x + ox) * k, (gl.y + oy) * k); ctx.rotate(gl.rot);
          if (mode === "stroke") ctx.strokeText(gl.ch, 0, 0); else ctx.fillText(gl.ch, 0, 0);
          ctx.restore();
        }
      };
      // scorch halo, cut lip, char
      g.save(); g.shadowColor = "rgba(15,6,1,.95)"; g.shadowBlur = 22; g.fillStyle = "rgba(40,18,6,.8)"; drawGlyphs(g, 1, 0, 0); g.restore();
      g.fillStyle = "rgba(215,175,120,.4)"; drawGlyphs(g, 1, 3, 4);
      g.fillStyle = "#140904"; drawGlyphs(g, 1, 0, 0);
      g.globalCompositeOperation = "source-atop";
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "120,90,60"},${0.15 + r() * 0.25})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
      g.globalCompositeOperation = "source-over";

      // emissive: faint warm wood + ember edges around dark char
      e.fillStyle = "#000"; e.fillRect(0, 0, W, H);
      blaze(e); e.fillStyle = "rgba(16,9,4,1)"; e.fill();
      e.textAlign = "center"; e.textBaseline = "middle"; e.font = g.font;
      e.save(); e.shadowColor = "#ff5a10"; e.shadowBlur = 24; e.strokeStyle = "#ff7a26"; e.lineWidth = 10; drawGlyphs(e, 1, 0, 0, "stroke"); e.restore();
      e.strokeStyle = "#ffd590"; e.lineWidth = 3.5; drawGlyphs(e, 1, 0, 0, "stroke");
      e.fillStyle = "rgba(40,8,0,.9)"; drawGlyphs(e, 1, 0, 0);
      const map = new THREE.CanvasTexture(base), emap = new THREE.CanvasTexture(glow);
      map.colorSpace = emap.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = emap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return { map, emap };
    }
    const carveGroup = new THREE.Group();
    scene.add(carveGroup);
    function buildCarves() {
      const TR0 = 0.76, TR1 = 0.42, TH = 18;
      const trunkGeo = new THREE.CylinderGeometry(TR1, TR0, TH, 16, 1, true);
      trunkGeo.translate(0, TH / 2, 0);
      carveSpots.forEach((c, i) => {
        const y0 = groundHeight(c.x, c.z) - 0.1;
        const trunk = new THREE.Mesh(trunkGeo, barkMat);
        trunk.position.set(c.x, y0, c.z);
        trunk.rotation.y = i * 1.7;
        const crown = new THREE.Mesh(TREE_GEOS[i % 3], treeMat);
        crown.position.set(c.x, y0, c.z);
        crown.scale.setScalar(1.35);
        // the panel faces a point on the path a few metres before the trunk
        const vz = c.z + (SMALL ? 9 : 6.5), vx = pathX(vz);
        const ty = 1.72, rr = lerp(TR0, TR1, ty / TH) + 0.012;
        const { map, emap } = carveTextures(c.text, 4242 + i * 17);
        const mat = new THREE.MeshLambertMaterial({
          map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 1,
          transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
        });
        const arc = 1.5 / rr;
        const panel = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.75, 24, 1, true, -arc / 2, arc), mat);
        panel.position.set(c.x, y0 + ty, c.z);
        panel.rotation.y = Math.atan2(vx - c.x, vz - c.z);
        panel.userData.phase = i * 2.3;
        carvePanels.push(panel);
        carveGroup.add(trunk, crown, panel);
      });
    }

    // ---- drifting ground fog: two camera-following noise sheets + a few soft banks ----
    const fogSheets = [];
    const fogSheetMat = (alpha, scale, speed) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new V3() }, uAlpha: { value: alpha }, uColor: { value: new THREE.Color(0x3b4a66) }, uScale: { value: scale }, uSpeed: { value: speed } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime, uAlpha, uScale, uSpeed; uniform vec3 uCam, uColor; varying vec3 vW; ${GLSL_NOISE}
        void main(){
          vec2 p = vW.xz * uScale + vec2(uTime * 0.013, uTime * 0.021) * uSpeed;
          float n = fbm3(p + fbm3(p * 0.7 + uTime * 0.01) * 1.6);
          n = smoothstep(0.32, 0.8, n);
          float d = length(vW.xz - uCam.xz);
          float a = n * uAlpha * smoothstep(58.0, 14.0, d) * smoothstep(1.5, 5.0, d);
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    [[0.32, 0.55, 0.05, 1], [1.05, 0.28, 0.035, 1.6]].forEach(([y, a, sc, sp]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(130, 130).rotateX(-Math.PI / 2), fogSheetMat(a, sc, sp));
      m.position.y = y;
      m.frustumCulled = false;
      m.renderOrder = 2;
      scene.add(m);
      fogSheets.push(m);
    });
    const fogBanks = [];
    {
      const r = rng32(512), n = LOW ? 12 : 30;
      for (let i = 0; i < n; i++) {
        const z = 8 - r() * 310, side = r() < 0.5 ? -1 : 1;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: 0x8193b8, transparent: true, opacity: 0.05 + r() * 0.06, depthWrite: false, fog: true }));
        const hgt = 2.6 + r() * 2;
        sp.scale.set(hgt * (4 + r() * 3), hgt, 1);
        const fx = pathX(z) + side * (3 + r() * 12);
        sp.position.set(fx, groundHeight(fx, z) + hgt * 0.5 + 0.15, z);
        sp.userData = { x: sp.position.x, ph: r() * TAU };
        sp.renderOrder = 3;
        scene.add(sp);
        fogBanks.push(sp);
      }
    }

    // ---- fireflies + dust motes ----
    const fogU = { value: 0.034 };
    const prU = { value: renderer.getPixelRatio() };
    const fireflies = (() => {
      const r = rng32(808), n = LOW ? 260 : 900;
      const pos = new Float32Array(n * 3), ph = new Float32Array(n), sp = new Float32Array(n);
      const hot = [CLEARINGS[0], CLEARINGS[1], CLEARINGS[2], CLEARINGS[4], CLEARINGS[6]];
      for (let i = 0; i < n; i++) {
        let x, z;
        if (r() < 0.58) { const c = hot[Math.floor(r() * hot.length)]; const a = r() * TAU, d = Math.sqrt(r()) * (c.r + 4); x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d; }
        else { z = 6 - r() * 300; x = pathX(z) + (r() < 0.5 ? -1 : 1) * (1.8 + r() * 13); }
        pos[i * 3] = x; pos[i * 3 + 1] = groundHeight(x, z) + 0.25 + r() * r() * 3.4; pos[i * 3 + 2] = z;
        ph[i] = r() * 100; sp[i] = 0.4 + r() * 0.9;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
      g.setAttribute("aSp", new THREE.BufferAttribute(sp, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uTime: { value: 0 }, uFog: fogU, uPR: prU, uSize: { value: LOW ? 34 : 40 } },
        vertexShader: `attribute float aPh, aSp; uniform float uTime, uFog, uPR, uSize; varying float vA;
          void main(){
            float t = uTime * aSp;
            vec3 p = position + vec3(sin(t + aPh) * 0.7, sin(t * 1.3 + aPh * 2.0) * 0.35, cos(t * 0.8 + aPh) * 0.7);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float fl = pow(0.5 + 0.5 * sin(uTime * (1.4 + aSp * 2.2) + aPh * 7.0), 3.0);
            float d = -mv.z;
            vA = (0.15 + 0.85 * fl) * exp(-pow(uFog * d * 0.85, 2.0)) * smoothstep(0.3, 1.5, d);
            gl_PointSize = uSize * uPR * (0.55 + 0.45 * fl) / max(d, 0.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `varying float vA;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a + smoothstep(0.12, 0.0, d);
            gl_FragColor = vec4(vec3(1.0, 0.82, 0.38) * 2.4 * a * vA, 1.0); }`,
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      pts.renderOrder = 4;
      scene.add(pts);
      return m;
    })();
    const dust = (() => {
      const r = rng32(303), n = LOW ? 120 : 380;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = r() * 18; pos[i * 3 + 1] = r() * 6; pos[i * 3 + 2] = r() * 18; }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uTime: { value: 0 }, uCam: { value: new V3() }, uPR: prU },
        vertexShader: `uniform float uTime, uPR; uniform vec3 uCam; varying float vA;
          void main(){
            vec3 box = vec3(18.0, 6.0, 18.0);
            vec3 p = position + vec3(sin(uTime * 0.2 + position.z) * 0.6, uTime * 0.05 + sin(uTime * 0.3 + position.x), cos(uTime * 0.17 + position.y) * 0.6);
            p = mod(p - uCam + box * 0.5, box) - box * 0.5 + uCam;
            p.y = max(p.y, 0.1);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float d = -mv.z;
            vA = smoothstep(9.0, 3.0, d) * smoothstep(0.4, 1.2, d);
            gl_PointSize = 2.4 * uPR * (6.0 / max(d, 0.5));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.55, 0.62, 0.8) * smoothstep(0.5, 0.1, d) * vA * 0.45, 1.0); }`,
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      pts.renderOrder = 4;
      scene.add(pts);
      return m;
    })();

    // ---- flog in the clearing ----
    const FLOG_AT = new V3(0, 0, -85), FLOG_H = 1.3;
    const flogRoot = new THREE.Group();
    flogRoot.name = "flog-root";
    flogRoot.position.copy(FLOG_AT);
    const flogBody = new THREE.Group(); // turns toward the pointer, hops
    flogRoot.add(flogBody);
    scene.add(flogRoot);
    const flogLight = new THREE.PointLight(0xffb27a, 9, 9, 2);
    flogLight.position.set(1.5, 1.9, -81.6);
    scene.add(flogLight);
    {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: softDot, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
      sh.position.y = 0.015;
      sh.renderOrder = 1;
      flogRoot.add(sh);
    }
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 8).translate(0, 0.7, 0), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.name = "flog-hit";
    flogRoot.add(proxy);
    // dust puff when he lands
    const puff = (() => {
      const n = 26, dir = new Float32Array(n * 3), r = rng32(77);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + r() * 0.3; const s = 0.6 + r() * 0.5; dir[i * 3] = Math.cos(a) * s; dir[i * 3 + 1] = 0.1 + r() * 0.35; dir[i * 3 + 2] = Math.sin(a) * s; }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(dir, 3));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uP: { value: 1 }, uPR: prU },
        vertexShader: `uniform float uP, uPR; varying float vA;
          void main(){ float e = 1.0 - pow(1.0 - uP, 3.0); vec3 p = position * vec3(e * 0.9, e * 0.8, e * 0.9); p.y += 0.05;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = (1.0 - uP) * 0.5; gl_PointSize = (30.0 + 60.0 * uP) * uPR / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.42, 0.37, 0.31), smoothstep(0.5, 0.0, d) * vA); }`,
      });
      const pts = new THREE.Points(g, m);
      pts.visible = false;
      pts.frustumCulled = false;
      flogRoot.add(pts);
      return { pts, m };
    })();
    let hopT = -1, flogHover = false;
    function hop() {
      if (typeof knock === "function") { try { knock(2); } catch (e) { /* audio blocked */ } }
      if (hopT < 0 || hopT > 0.55) hopT = 0;
    }
    proxy.userData.onClick = hop;
    proxy.userData.onHover = (on) => { flogHover = on; };

    function setupFlogModel(obj) {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new V3()), ctr = box.getCenter(new V3());
      const k = FLOG_H / Math.max(size.y, 1e-3);
      obj.scale.multiplyScalar(k);
      obj.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; } });
      flogBody.add(obj);
    }
    async function loadFlog() {
      const glbUrl = OPTS.glb ? new URL(OPTS.glb, location.href).href : siteUrl("3d/flog.glb");
      try {
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const gltf = await new GLTFLoader().loadAsync(glbUrl);
        const mesh = gltf.scene.getObjectByName("flog") || gltf.scene;
        mesh.removeFromParent();
        setupFlogModel(mesh);
        W.flogMode = "glb";
      } catch (e) {
        flogBillboard();
        W.flogMode = "billboard";
      }
      renderer.compileAsync(scene, camera).catch(() => {});
    }
    function flogBillboard() {
      const src = OPTS.standing ? new URL(OPTS.standing, location.href).href : siteUrl("img/flog-standing.png");
      const tex = loadTexture(src);
      const hgt = FLOG_H, wid = hgt * (360 / 690);
      const geo = new THREE.PlaneGeometry(wid, hgt).translate(0, hgt / 2, 0);
      // three layers at different depths: a cold moon halo, a drop shadow, the cutout itself
      const halo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: 0x5d76b8, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
      halo.scale.setScalar(1.07); halo.position.set(0, -0.04, -0.16);
      const shadow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
      shadow.position.set(0.05, 0, -0.32); shadow.scale.set(1.03, 0.98, 1);
      const main = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, emissive: 0x241d16, emissiveMap: tex }));
      const board = new THREE.Group();
      board.add(shadow, halo, main);
      board.userData.billboard = true;
      flogBody.add(board);
    }

    // ---- post: one full-screen pass (VHS shader if the vhs layer provides one) ----
    const rtScale = LOW ? 0.85 : 1;
    const rt = new THREE.WebGLRenderTarget(4, 4, LOW
      ? { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, samples: 0 }
      : { type: THREE.HalfFloatType, samples: 4 });
    const postScene = new THREE.Scene();
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postU = {
      tDiffuse: { value: rt.texture }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uAmount: { value: LOW ? 0.85 : 1 }, uGlitch: { value: 0 },
    };
    const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    // the scene target is linear HDR: every tDiffuse read is routed through tone mapping + sRGB first
    const POST_PRE = `// FLOG_POST
      vec4 flogScene(sampler2D s, vec2 uv){ vec4 c = texture2D(s, uv); c.rgb = toneMapping(c.rgb); return linearToOutputTexel(vec4(c.rgb, 1.0)); }
    `;
    const OWN_FRAG = `uniform sampler2D tDiffuse; uniform float uTime, uAmount, uGlitch; uniform vec2 uRes; varying vec2 vUv;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        uv.x += (hh(vec2(floor(uv.y * 70.0), floor(uTime * 24.0))) - 0.5) * 0.03 * uGlitch;
        float ca = 0.0012 * (1.0 + 5.0 * uGlitch);
        vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
        vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float vig = smoothstep(1.05, 0.25, length(q) * 1.15);
        c *= mix(1.0, vig, 0.55 * uAmount);
        c += (hh(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5) * 0.045 * uAmount;
        gl_FragColor = vec4(c, 1.0);
      }`;
    function wrapFrag(src) {
      const out = src.replace(/\btexture(?:2D)?\s*\(\s*tDiffuse\s*,/g, "flogScene(tDiffuse,");
      return out === src ? null : POST_PRE + out;
    }
    const postMat = (frag) => new THREE.ShaderMaterial({ uniforms: postU, vertexShader: POST_VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat(wrapFrag(OWN_FRAG)));
    postQuad.frustumCulled = false;
    postScene.add(postQuad);
    let vhsSrc = null, vhsBroken = false;
    function syncPost() {
      const src = window.FLOG_VHS_FRAG;
      if (vhsBroken || typeof src !== "string" || src === vhsSrc) return;
      vhsSrc = src;
      const frag = wrapFrag(src);
      if (!frag) { vhsBroken = true; return; }
      postQuad.material.dispose();
      postQuad.material = postMat(frag);
      postQuad.material.userData.vhs = true;
    }
    renderer.debug.onShaderError = (glc, program, vs, fs) => {
      const src = glc.getShaderSource(fs) || "";
      const log = (glc.getShaderInfoLog(fs) || "") + (glc.getProgramInfoLog(program) || "");
      if (src.includes("FLOG_POST") && postQuad.material.userData.vhs) {
        vhsBroken = true;
        console.warn("[world3d] FLOG_VHS_FRAG failed to compile, using the plain grain pass.", log.trim());
        const old = postQuad.material;
        postQuad.material = postMat(wrapFrag(OWN_FRAG));
        setTimeout(() => old.dispose(), 0);
      } else console.error("[world3d] shader error", log.trim());
    };
    syncPost();

    // ---- texture loader ----
    const texCache = new Map();
    const texLoader = new THREE.TextureLoader();
    function loadTexture(u) {
      const abs = new URL(u, BASE).href;
      if (texCache.has(abs)) return texCache.get(abs);
      const t = texLoader.load(abs);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texCache.set(abs, t);
      return t;
    }

    // ---- beat groups + culling ----
    const beatGroups = new Map();
    const BEAT_CENTER = {
      tape: new V3(0, 0, 6), forest: new V3(0, 0, -35), flog: FLOG_AT, lignification: new V3(0, 0, -117),
      sawmill: new V3(7, 0, -165), pile: new V3(-6, 0, -205), log: new V3(0, 0, -252), proof: new V3(0, 0, -268), end: new V3(0, 0, -298),
    };
    function beatGroup(id) {
      let g = beatGroups.get(id);
      if (!g) {
        g = new THREE.Group();
        g.name = "beat:" + id;
        g.userData = { culled: false, box: new THREE.Box3(), boxAt: -1 };
        scene.add(g);
        beatGroups.set(id, g);
      }
      return g;
    }
    function addToBeat(id, obj) {
      const g = beatGroup(id);
      g.add(obj);
      g.userData.boxAt = -1;
      if (g.userData.culled) setCulled(g, true, obj);
      scheduleCompile();
      return obj;
    }
    // culled = meshes off the render layer; lights stay so shaders never recompile mid-scroll
    function setCulled(g, on, root = g) {
      root.traverse((o) => {
        if (o === g || o.isLight) return;
        if (on) { if (o.layers.mask !== 0) { o.userData._mask = o.layers.mask; o.layers.mask = 0; } }
        else if (o.layers.mask === 0) { o.layers.mask = o.userData._mask ?? 1; }
      });
      g.userData.culled = on;
    }
    const tmpBox = new THREE.Box3();
    function cullBeats(t) {
      for (const [id, g] of beatGroups) {
        const u = g.userData;
        if (u.boxAt < 0 || t - u.boxAt > 3) {
          u.box.makeEmpty();
          g.traverse((o) => { if (o.isMesh || o.isPoints || o.isSprite) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmpBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); u.box.union(tmpBox); } });
          if (BEAT_CENTER[id]) u.box.expandByPoint(BEAT_CENTER[id]);
          u.boxAt = t;
        }
        const far = !u.box.isEmpty() && u.box.distanceToPoint(camera.position) > 90;
        if (far !== u.culled) setCulled(g, far);
      }
    }
    let compileTimer = 0;
    function scheduleCompile() {
      clearTimeout(compileTimer);
      compileTimer = setTimeout(() => renderer.compileAsync(scene, camera).catch(() => {}), 600);
    }

    // ---- frame hooks ----
    const frameFns = new Set();
    function onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); }

    // ---- pointer + raycast ----
    const raycastTargets = [];
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2(), pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false, dirty: false };
    let hovered = null, lastInput = performance.now();
    const passTarget = (el) => el === canvas || el === document.body || el === HTMLEL ||
      (el instanceof Element && el.matches("#journey, .beat, .beat-inner"));
    function shownChain(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
    function pick(x, y) {
      if (!raycastTargets.length) return null;
      ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(raycastTargets.filter((o) => o.parent), true);
      for (const h of hits) {
        if (!shownChain(h.object)) continue;
        for (let o = h.object; o; o = o.parent) if (o.userData && (o.userData.onClick || o.userData.onHover)) return { obj: o, hit: h };
      }
      return null;
    }
    function setHover(obj, hit) {
      if (obj === hovered) return;
      if (hovered && hovered.userData.onHover) hovered.userData.onHover(false, null);
      hovered = obj;
      if (obj && obj.userData.onHover) obj.userData.onHover(true, hit);
      HTMLEL.classList.toggle("world-hover", !!(obj && obj.userData.onClick));
    }
    addEventListener("pointermove", (e) => {
      lastInput = performance.now();
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / innerHeight) * 2 + 1;
      pointer.cx = e.clientX; pointer.cy = e.clientY;
      pointer.inside = e.pointerType === "mouse" && passTarget(e.target);
      pointer.dirty = true;
    }, { passive: true });
    addEventListener("pointerleave", () => { pointer.inside = false; pointer.dirty = true; });
    addEventListener("click", (e) => {
      lastInput = performance.now();
      if (e.defaultPrevented || !passTarget(e.target)) return;
      const p = pick(e.clientX, e.clientY);
      if (p && p.obj.userData.onClick) p.obj.userData.onClick(p.hit, e);
    });
    addEventListener("flog:scroll", () => { lastInput = performance.now(); });
    addEventListener("scroll", () => { lastInput = performance.now(); }, { passive: true });

    // ---- scroll -> path ----
    function mapLocal(keys, l) {
      for (let j = 0; j < keys.length - 1; j++) {
        const [a, ia] = keys[j], [b, ib] = keys[j + 1];
        if (l <= b || j === keys.length - 2) return lerp(ia, ib, ease(clamp01((l - a) / Math.max(1e-6, b - a))));
      }
      return keys[keys.length - 1][1];
    }
    function scrollState() {
      const S = window.FLOG_SCROLL;
      if (S && S.beat && BEAT_PATH[S.beat] && typeof S.local === "number") return { id: S.beat, idx: mapLocal(BEAT_PATH[S.beat], clamp01(S.local)) };
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const p = clamp01(S && typeof S.progress === "number" ? S.progress : scrollY / max);
      const f = p * BEATS.length, i = Math.min(BEATS.length - 1, Math.floor(f));
      const id = BEATS[i];
      return { id, idx: mapLocal(BEAT_PATH[id], p >= 1 ? 1 : f - i) };
    }

    // ---- resize ----
    const bufSize = new THREE.Vector2();
    function resize() {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.8 ? 68 : 55;
      camera.updateProjectionMatrix();
      renderer.getDrawingBufferSize(bufSize);
      const rw = Math.max(2, Math.floor(bufSize.x * rtScale)), rh = Math.max(2, Math.floor(bufSize.y * rtScale));
      rt.setSize(rw, rh);
      postU.uRes.value.set(rw, rh);
      prU.value = renderer.getPixelRatio() * rtScale;
    }
    addEventListener("resize", resize);
    resize();

    // ---- camera state ----
    const st0 = scrollState();
    const cam = { idx: st0.idx, vel: 0, beat: st0.id, glitch: 0, fog: 0.04, look: new V3(), bob: 0, mx: 0, my: 0 };
    const tmpP = new V3(), tmpD = new V3(), tmpA = new V3(), tmpB = new V3(), tmpT = new V3();
    function dirAt(i, pos, t, out) {
      const L = LOOKS[Math.max(0, Math.min(LAST, i))];
      if (L) return out.copy(L).sub(pos).normalize();
      curve.getTangent(Math.min(0.999, Math.max(0.001, t)), out);
      out.y -= 0.06;
      return out.normalize();
    }
    function updateCamera(dt, t) {
      const st = scrollState();
      if (st.id !== cam.beat) { cam.beat = st.id; cam.glitch = 1; }
      // critically damped follow: wheel steps glide like a dolly
      const w = 4.2;
      cam.vel += (w * w * (st.idx - cam.idx) - 2 * w * cam.vel) * dt;
      cam.idx += cam.vel * dt;
      cam.idx = Math.max(0, Math.min(LAST, cam.idx));
      const tt = cam.idx / LAST;
      curve.getPoint(tt, tmpP);
      const i = Math.floor(cam.idx), f = cam.idx - i;
      dirAt(i, tmpP, tt, tmpA);
      dirAt(i + 1, tmpP, tt, tmpB);
      tmpD.copy(tmpA).lerp(tmpB, ease(f)).normalize();
      // glance at a carved trunk while walking past it (more on narrow portrait screens)
      for (const c of carveSpots) {
        const ahead = tmpP.z - c.z;
        if (ahead < 1 || ahead > 16) continue;
        const gw = smooth(16, 9, ahead) * smooth(1, 4.5, ahead) * (camera.aspect < 0.8 ? 0.6 : 0.28);
        tmpT.set(c.x - tmpP.x, 1.75 - tmpP.y, c.z - tmpP.z).normalize();
        tmpD.lerp(tmpT, gw).normalize();
      }
      // handheld: breathing, slow drift, a footstep bob while moving
      const speed = Math.min(1, Math.abs(cam.vel) * 6);
      cam.bob += dt * (6 + speed * 5) * speed;
      const ox = (Math.sin(t * 0.83) * 0.6 + Math.sin(t * 1.91 + 1.3) * 0.4) * 0.03 + Math.sin(cam.bob * 0.5) * 0.02 * speed;
      const oy = Math.sin(t * 1.55) * 0.012 + Math.abs(Math.sin(cam.bob)) * 0.03 * speed;
      camera.position.set(tmpP.x + ox, tmpP.y + oy, tmpP.z);
      camera.lookAt(tmpT.copy(camera.position).add(tmpD));
      // mouse-look parallax (a few degrees)
      const k = 1 - Math.exp(-dt * 3.5);
      cam.mx += ((SMALL ? 0 : pointer.x) - cam.mx) * k;
      cam.my += ((SMALL ? 0 : pointer.y) - cam.my) * k;
      camera.rotateY(-cam.mx * 3.2 * DEG + (Math.sin(t * 0.61) * 0.6 + Math.sin(t * 1.37 + 2) * 0.4) * 0.35 * DEG);
      camera.rotateX(cam.my * 2.0 * DEG + Math.sin(t * 0.73 + 1) * 0.25 * DEG);
      camera.rotateZ(Math.sin(t * 0.47) * 0.4 * DEG + Math.sin(cam.bob * 0.5) * 0.3 * DEG * speed);
      return Math.abs(st.idx - cam.idx) < 6e-4 && Math.abs(cam.vel) < 1e-3;
    }
    function updateFog(dt) {
      const p = camera.position;
      let target = p.z > 2 ? lerp(0.034, 0.03, smooth(2, 12, p.z)) : 0.034;
      for (const c of CLEARINGS) {
        const d = Math.hypot(p.x - c.x, p.z - c.z);
        target = lerp(target, c.fog, 1 - smooth(c.r * 0.5, c.r + 10, d));
      }
      cam.fog += (target - cam.fog) * (1 - Math.exp(-dt * 1.6));
      scene.fog.density = cam.fog;
      fogU.value = cam.fog;
    }
    function updateFlog(dt, t) {
      // turn a little toward the pointer, breathe, hop
      const k = 1 - Math.exp(-dt * 3);
      const near = camera.position.distanceTo(FLOG_AT) < 30;
      const ty = near ? pointer.x * 12 * DEG : 0, tp = near ? -pointer.y * 5 * DEG : 0;
      flogBody.rotation.y += (ty - flogBody.rotation.y) * k;
      flogBody.rotation.x += (tp - flogBody.rotation.x) * k;
      let sy = 1 + Math.sin(t * 1.4) * 0.006, sxz = 1, y = 0;
      if (hopT >= 0) {
        hopT += dt;
        const h = hopT;
        if (h < 0.09) { const a = Math.sin((h / 0.09) * Math.PI * 0.5); sy = 1 - 0.16 * a; sxz = 1 + 0.08 * a; }
        else if (h < 0.5) { const a = (h - 0.09) / 0.41; y = 0.36 * Math.sin(a * Math.PI); sy = lerp(1.12, 1.03, a); sxz = 1 / Math.sqrt(sy); }
        else if (h < 0.95) {
          const a = (h - 0.5) / 0.45;
          sy = 1 - 0.14 * Math.exp(-a * 5) * Math.cos(a * 12); sxz = 1 / Math.sqrt(sy);
          if (!puff.pts.visible) puff.pts.visible = true;
        } else hopT = -1;
        if (h >= 0.5 && h < 1.4) puff.m.uniforms.uP.value = clamp01((h - 0.5) / 0.9);
        else if (h > 1.4) puff.pts.visible = false;
      } else if (puff.pts.visible) {
        puff.m.uniforms.uP.value = Math.min(1, puff.m.uniforms.uP.value + dt / 0.9);
        if (puff.m.uniforms.uP.value >= 1) puff.pts.visible = false;
      }
      flogBody.position.y = y;
      flogBody.scale.set(sxz, sy, sxz);
      // billboard fallback: swing toward the camera but keep some angle so the layers parallax
      flogBody.children.forEach((c) => {
        if (!c.userData.billboard) return;
        const a = Math.atan2(camera.position.x - FLOG_AT.x, camera.position.z - FLOG_AT.z);
        c.rotation.y = Math.max(-0.5, Math.min(0.5, a)) * 0.7;
      });
      flogLight.intensity += ((flogHover ? 14 : 9) - flogLight.intensity) * k;
    }

    // ---- the loop ----
    const stats = { frames: 0, cpuMs: 0, frameMs: 0, fps: 0 };
    let raf = 0, lastRender = 0, settled = false, accCpu = 0, accFrame = 0, accN = 0, lastCull = -1, running = false;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const idle = settled && now - lastInput > 1500 && hopT < 0 && cam.glitch <= 0;
      if (idle && now - lastRender < 31) return;
      const t0 = performance.now();
      const gap = lastRender ? now - lastRender : 16.7;
      lastRender = now;
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

      settled = updateCamera(dt, t);
      updateFog(dt);
      syncPost();
      const ext = typeof vhsGlitchLevel === "function" ? vhsGlitchLevel() : 0;
      cam.glitch = Math.max(0, cam.glitch - dt / 0.4);
      postU.uGlitch.value = Math.max(cam.glitch, ext || 0);
      postU.uTime.value = t;
      windU.value = t;
      skyU.uTime.value = t;
      sky.position.copy(camera.position);
      fireflies.uniforms.uTime.value = t;
      dust.uniforms.uTime.value = t;
      dust.uniforms.uCam.value.copy(camera.position);
      fogSheets.forEach((m) => { m.position.x = camera.position.x; m.position.z = camera.position.z; m.material.uniforms.uTime.value = t; m.material.uniforms.uCam.value.copy(camera.position); });
      fogBanks.forEach((s) => { s.position.x = s.userData.x + Math.sin(t * 0.05 + s.userData.ph) * 2.5; });
      for (const g of treeChunks) g.visible = Math.abs(g.userData.z - camera.position.z) < 150;
      carvePanels.forEach((p) => { p.material.emissiveIntensity = 0.85 + 0.25 * Math.sin(t * 2.1 + p.userData.phase) * Math.sin(t * 0.7 + p.userData.phase * 1.3); });
      updateFlog(dt, t);
      if (t - lastCull > 0.25) { cullBeats(t); lastCull = t; }
      if (pointer.dirty || !settled) {
        pointer.dirty = false;
        if (pointer.inside) { const p = pick(pointer.cx, pointer.cy); setHover(p && p.obj, p && p.hit); }
        else setHover(null);
      }
      for (const fn of frameFns) {
        try { fn(dt, t); } catch (e) { frameFns.delete(fn); console.error("[world3d] onFrame callback removed:", e); }
      }

      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);

      accCpu += performance.now() - t0; accFrame += gap; accN++;
      stats.frames++;
      if (accN >= 60) {
        stats.cpuMs = +(accCpu / accN).toFixed(2); stats.frameMs = +(accFrame / accN).toFixed(2); stats.fps = +(1000 / stats.frameMs).toFixed(1);
        accCpu = accFrame = accN = 0;
      }
    }
    function run() { if (running) return; running = true; clock.getDelta(); lastRender = 0; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? run() : stop()));
    canvas.addEventListener("webglcontextlost", stop);
    canvas.addEventListener("webglcontextrestored", () => { if (document.visibilityState === "visible") run(); });

    // ---- public API ----
    const anchors = {
      start: new V3(0, 1.6, 12),
      forest: { z0: 0, z1: -70 },
      flog: { center: FLOG_AT.clone(), r: 10 },
      lignification: { z0: -95, z1: -140 },
      sawmill: { center: new V3(7, 0, -165), r: 12 },
      pile: { center: new V3(-6, 0, -205), r: 11 },
      rings: { center: new V3(0, 7, -228), r: 4.5 },
      log: { center: new V3(0, 0, -252), r: 9 },
      proof: { z0: -262, z1: -275 },
      end: { center: new V3(0, 0, -298), r: 14 },
    };
    const W = {
      THREE, scene, camera, renderer, clock, isSmall: SMALL, quality: QUALITY,
      onFrame, addToBeat, raycastTargets, loadTexture, anchors,
      // extras
      beatGroups, groundHeight, pathX,
      pathPoint: (beat, local) => curve.getPoint(mapLocal(BEAT_PATH[beat] || BEAT_PATH.tape, clamp01(local)) / LAST),
      flog: flogRoot, flogMode: "loading", stats,
    };
    window.FLOG_WORLD = W;
    raycastTargets.push(proxy);

    // fonts for the carvings (own FontFace so it works without the page css), then trunks
    (async () => {
      try {
        const ff = new FontFace("FlogCarve", `url(${siteUrl("fonts/Caveat.woff2")})`, { weight: "400 700" });
        await Promise.race([ff.load(), new Promise((_, rej) => setTimeout(() => rej(new Error("font timeout")), 2500))]);
        document.fonts.add(ff);
        carveFont = '"FlogCarve", cursive';
      } catch (e) { carveFont = "cursive"; }
      buildCarves();
      scheduleCompile();
    })();
    loadFlog();

    if (document.visibilityState === "visible") run();
    renderer.compileAsync(scene, camera).catch(() => {});
    window.dispatchEvent(new CustomEvent("flog:world-ready", { detail: W }));
  }
})();
