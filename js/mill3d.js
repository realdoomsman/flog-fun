// the sawmill, in the world: a three.js machine at the sawmill anchor, driven by the keeper's /log poll.
// fees fall into the hopper, ride the belt into the saw and roll out as logs toward the pile.
// nothing is faked: before launch the belt stays empty and a chalk sign says so. coins only ride the
// belt when the hopper is really full, or when a real new log shows up in the flog log.

function updateSawmill(data) { __flogMill3d.update(data); }

var __flogMill3d = (() => {
  const STATIC = document.documentElement.classList.contains("static");
  let data = null, mode = "pre", frac = 0, entriesN = null, cutsQueued = 0, claimDrops = 0;
  let api = null; // set once the world is built

  function computeMode() {
    const d = data;
    if (!d || !d.flog_mint) return "pre";
    const last = Date.parse(d.last_run || 0), interval = (+d.interval_sec || 300) * 1000;
    if (!last || Date.now() - last > Math.max(3 * interval, 600000)) return "off";
    return frac >= 1 ? "full" : "run";
  }

  function update(d) {
    if (STATIC || !d || typeof d !== "object") return;
    const prev = data;
    data = d;
    const goal = +d.min_buy_sol || 0, pend = +d.pending_sol || 0;
    frac = d.flog_mint && goal > 0 ? Math.max(0, pend / goal) : 0;
    const n = Array.isArray(d.entries) ? d.entries.length : null;
    // only react to real changes between two polls we actually saw
    if (prev && d.flog_mint && api) {
      if (n != null && entriesN != null && n > entriesN) cutsQueued = Math.min(3, cutsQueued + n - entriesN);
      const pp = +prev.pending_sol || 0;
      if (goal && pend > pp + 1e-9) claimDrops = Math.min(8, claimDrops + Math.max(1, Math.min(6, Math.ceil(((pend - pp) / goal) * 14))));
    }
    if (n != null) entriesN = n;
    mode = computeMode();
    if (api) api.refresh();
  }

  if (!STATIC) {
    const go = () => {
      if (window.FLOG_WORLD) build(window.FLOG_WORLD);
      else addEventListener("flog:world-ready", (e) => build(e.detail || window.FLOG_WORLD), { once: true });
    };
    if (document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
  }

  function build(W) {
    if (api || !W || !W.THREE) return;
    const T = W.THREE, small = !!(W.isSmall || W.quality === "low");
    const TAU = Math.PI * 2;
    const ANCHOR = new T.Vector3(7, 0, -165);
    const BELT_Y = 0.98, BELT_X1 = -2.7, BELT_X2 = 4.3, SAW_R = 1.0, SAW_Y = 1.7, HOP_X = 3.6;
    const COIN_R = small ? 0.11 : 0.09, COIN_H = 0.035, LOG_R = 0.17, LOG_L = 0.72;

    // machine local frame: +z faces the path (world -X), flow runs toward local -x (world -Z, toward the pile)
    const root = new T.Group();
    root.name = "sawmill";
    root.position.copy(ANCHOR);
    root.rotation.y = -Math.PI / 2;
    root.scale.setScalar(1.15);
    W.addToBeat("sawmill", root);
    const clickables = [];

    // ---------- textures + materials ----------
    function canvasTex(w, h, draw, srgb = true) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const t = new T.CanvasTexture(c);
      if (srgb) t.colorSpace = T.SRGBColorSpace;
      t.anisotropy = small ? 1 : 4;
      return t;
    }
    function redraw(t, draw) { const c = t.image; draw(c.getContext("2d"), c.width, c.height); t.needsUpdate = true; }
    function fileTex(name, rx, ry) {
      const url = `textures/${name}.webp`;
      const t = W.loadTexture ? W.loadTexture(url) : new T.TextureLoader().load(url);
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(rx, ry);
      return t;
    }
    const metalTex = fileTex("metal", 1, 1);
    const paint = new T.MeshStandardMaterial({ color: 0x8fa676, map: metalTex, roughness: 0.62, metalness: 0.35 });
    const iron = new T.MeshStandardMaterial({ color: 0x2c2e27, roughness: 0.55, metalness: 0.5 });
    const brass = new T.MeshStandardMaterial({ color: 0xc9b27a, roughness: 0.35, metalness: 0.6 });
    const deckMat = new T.MeshStandardMaterial({ color: 0x9a7a5c, map: fileTex("planks", 4, 1.6), roughness: 0.9 });
    const stripeTex = canvasTex(256, 32, (c, w, h) => {
      c.fillStyle = "#e3b324"; c.fillRect(0, 0, w, h); c.fillStyle = "#16120c";
      for (let x = -h; x < w + h; x += 32) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.lineTo(x + h + 16, 0); c.lineTo(x + 16, h); c.fill(); }
    });
    stripeTex.wrapS = T.RepeatWrapping;
    const stripeMat = new T.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 });
    const treadTex = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = "#1a1714"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#3a332b"; c.fillRect(0, 0, 10, h);
      c.fillStyle = "rgba(255,255,255,.05)"; for (let i = 0; i < 60; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    });
    treadTex.wrapS = treadTex.wrapT = T.RepeatWrapping;
    treadTex.repeat.set((BELT_X2 - BELT_X1) / 0.22, 1);
    const beltMat = new T.MeshStandardMaterial({ map: treadTex, roughness: 0.95 });

    const coinFaceTex = canvasTex(128, 128, (c, w) => {
      const r = w / 2, g = c.createLinearGradient(0, 0, w, w);
      g.addColorStop(0, "#a45cff"); g.addColorStop(0.55, "#4d8fd6"); g.addColorStop(1, "#19e3a0");
      c.fillStyle = g; c.fillRect(0, 0, w, w);
      c.strokeStyle = "rgba(20,8,40,.5)"; c.lineWidth = 10; c.beginPath(); c.arc(r, r, r - 5, 0, TAU); c.stroke();
      c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 9; c.beginPath(); c.arc(r, r, r * 0.58, 0, TAU); c.stroke();
      c.fillStyle = "rgba(255,255,255,.92)"; c.beginPath(); c.arc(r, r, r * 0.2, 0, TAU); c.fill();
    });
    const coinMats = [
      new T.MeshStandardMaterial({ color: 0x3b2470, roughness: 0.4, metalness: 0.5 }),
      new T.MeshStandardMaterial({ map: coinFaceTex, roughness: 0.35, metalness: 0.25, emissive: 0xffffff, emissiveMap: coinFaceTex, emissiveIntensity: 0.45 }),
    ];
    const coinGeo = new T.CylinderGeometry(COIN_R, COIN_R, COIN_H, small ? 14 : 22);
    const coinMatArr = [coinMats[0], coinMats[1], coinMats[1]];

    const wood = window.__flogWood;
    const logEndTex = wood ? wood.ringTexture(T, { size: 256, seed: 5, rings: 6 }) : null;
    const barkTex = wood ? wood.barkTexture(T, { w: 256, h: 256, seed: 3 }) : null;
    if (barkTex) barkTex.repeat.set(2, 1);
    const logMats = [
      new T.MeshStandardMaterial({ color: barkTex ? 0xffffff : 0x3b2415, map: barkTex, roughness: 0.95 }),
      new T.MeshStandardMaterial({ color: logEndTex ? 0xffffff : 0xe0b77a, map: logEndTex, roughness: 0.8 }),
    ];
    const logGeo = new T.CylinderGeometry(LOG_R, LOG_R, LOG_L, small ? 12 : 20).rotateX(Math.PI / 2);
    const logMatArr = [logMats[0], logMats[1], logMats[1]];

    // ---------- helpers ----------
    const up = new T.Vector3(0, 1, 0);
    function add(mesh, parent = root, click = false) { parent.add(mesh); if (click) clickables.push(mesh); return mesh; }
    function box(w, h, d, mat, x, y, z, click) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(m, root, click); }
    function strut(a, b, r, mat, click) {
      const dir = new T.Vector3().subVectors(b, a), len = dir.length();
      const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 8), mat);
      m.position.copy(a).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(up, dir.normalize());
      return add(m, root, click);
    }
    const V = (x, y, z) => new T.Vector3(x, y, z);
    function plate(w, h, tex, x, y, z, ry = 0) {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tex, roughness: 0.75, transparent: true }));
      m.position.set(x, y, z); m.rotation.y = ry;
      return add(m);
    }
    function gearGeo(n, r, depth, holes) {
      const s = new T.Shape(), ro = r + 0.045, ri = r - 0.04;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, w = (TAU / n) * 0.22;
        const pts = [[a - w * 1.6, ri], [a - w, ro], [a + w, ro], [a + w * 1.6, ri]];
        pts.forEach(([aa, rr], j) => (i === 0 && j === 0 ? s.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : s.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr)));
      }
      s.closePath();
      const hole = (cx, cy, rr) => { const p = new T.Path(); p.absarc(cx, cy, rr, 0, TAU, true); s.holes.push(p); };
      hole(0, 0, r * 0.12);
      if (holes) for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; hole(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.17); }
      return new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
    }
    const fontsReady = document.fonts ? Promise.all(["40px VT323", "40px 'Special Elite'", "60px 'Reenie Beanie'", "40px Caveat"].map((f) => document.fonts.load(f).catch(() => {}))) : Promise.resolve();

    // ---------- deck + floor ----------
    box(11.5, 0.12, 4.2, deckMat, -0.6, 0.06, 0, true);

    // ---------- conveyor ----------
    const beltLen = BELT_X2 - BELT_X1, beltCx = (BELT_X1 + BELT_X2) / 2;
    box(beltLen, 0.05, 0.9, beltMat, beltCx, BELT_Y - 0.025, 0, true);
    for (const z of [0.48, -0.48]) {
      box(beltLen + 0.12, 0.16, 0.05, paint, beltCx, BELT_Y - 0.1, z);
      box(beltLen * 0.3, 0.035, 0.012, stripeMat, BELT_X2 - beltLen * 0.2, BELT_Y - 0.06, z + Math.sign(z) * 0.032);
    }
    for (const x of [BELT_X1 + 0.2, BELT_X1 + beltLen * 0.36, BELT_X1 + beltLen * 0.64, BELT_X2 - 0.2])
      for (const z of [0.44, -0.44]) box(0.08, BELT_Y - 0.2, 0.08, iron, x, (BELT_Y - 0.08) / 2, z);
    // end drums
    for (const x of [BELT_X1, BELT_X2]) {
      const d = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.9, 16).rotateX(Math.PI / 2), beltMat);
      d.position.set(x, BELT_Y - 0.075, 0); add(d);
    }
    // roller hubs on the front rail (they spin with the belt)
    const hubXs = [];
    for (let x = BELT_X1 + 0.1; x <= BELT_X2 - 0.05; x += 0.5) hubXs.push(x);
    const hubGeo = new T.BoxGeometry(0.11, 0.022, 0.02);
    const hubs = new T.InstancedMesh(hubGeo, brass, hubXs.length);
    add(hubs);
    const hubBolts = new T.InstancedMesh(new T.CylinderGeometry(0.04, 0.04, 0.02, 10).rotateX(Math.PI / 2), iron, hubXs.length);
    const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(1, 1, 1), tmpP = new T.Vector3(), zAxis = new T.Vector3(0, 0, 1);
    hubXs.forEach((x, i) => { tmpM.makeTranslation(x, BELT_Y - 0.1, 0.515); hubBolts.setMatrixAt(i, tmpM); });
    add(hubBolts);
    function setHubs(a) {
      tmpQ.setFromAxisAngle(zAxis, a);
      hubXs.forEach((x, i) => { tmpP.set(x, BELT_Y - 0.1, 0.53); tmpM.compose(tmpP, tmpQ, tmpS); hubs.setMatrixAt(i, tmpM); });
      hubs.instanceMatrix.needsUpdate = true;
    }

    // ---------- hopper (glass front so you can see the fees) ----------
    const HT = 2.7, HB = 1.75, HWT = 0.62, HWB = 0.15, NECK = 1.45;
    function quad(a, b, c, d, mat) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
      g.setAttribute("uv", new T.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
      g.computeVertexNormals();
      return add(new T.Mesh(g, mat), root, true);
    }
    const hx = HOP_X;
    const TL = (sx, sz) => [hx + sx * HWT, HT, sz * HWT], BL = (sx, sz) => [hx + sx * HWB, HB, sz * HWB];
    const hopInner = new T.MeshStandardMaterial({ color: 0x55664a, map: metalTex, roughness: 0.7, metalness: 0.3, side: T.DoubleSide });
    quad(TL(-1, -1), TL(1, -1), BL(1, -1), BL(-1, -1), hopInner); // back
    quad(TL(-1, 1), TL(-1, -1), BL(-1, -1), BL(-1, 1), hopInner); // downstream side
    quad(TL(1, -1), TL(1, 1), BL(1, 1), BL(1, -1), hopInner); // upstream side
    const glass = new T.MeshStandardMaterial({ color: 0xcfe8e0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide });
    quad(TL(1, 1), TL(-1, 1), BL(-1, 1), BL(1, 1), glass);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strut(V(...TL(sx, sz)), V(...BL(sx, sz)), 0.025, paint);
    for (const sz of [-1, 1]) strut(V(...TL(-1, sz)), V(...TL(1, sz)), 0.03, paint);
    for (const sx of [-1, 1]) strut(V(...TL(sx, -1)), V(...TL(sx, 1)), 0.03, paint);
    box(HWB * 2 + 0.06, HB - NECK, HWB * 2 + 0.06, paint, hx, (HB + NECK) / 2, 0, true);
    box(HWB * 2 + 0.07, 0.05, 0.01, stripeMat, hx, NECK + 0.05, HWB + 0.035);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strut(V(hx + sx * 0.52, 0.12, sz * 0.52), V(hx + sx * HWT * 0.75, (HT + HB) / 2, sz * HWT * 0.75), 0.035, iron);
    // stencil plate + full line
    const feesTex = canvasTex(256, 96, () => {});
    const drawFees = () => redraw(feesTex, (c, w, h) => {
      c.fillStyle = "#e6d9bb"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#5a4a32"; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = "#1d150d"; c.font = "62px 'Special Elite', monospace"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("fees", w / 2, h / 2 + 4);
    });
    drawFees();
    plate(0.5, 0.19, feesTex, hx, HT + 0.07, HWT + 0.04);
    const fullTex = canvasTex(512, 64, () => {});
    const drawFull = () => redraw(fullTex, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.setLineDash([18, 14]); c.strokeStyle = "rgba(255,122,20,.95)"; c.lineWidth = 5;
      c.beginPath(); c.moveTo(8, h - 8); c.lineTo(w - 8, h - 8); c.stroke();
      const goal = data && data.flog_mint && +data.min_buy_sol;
      c.fillStyle = "#ff7a14"; c.font = "40px VT323, monospace"; c.textAlign = "right"; c.textBaseline = "alphabetic";
      c.fillText(goal ? `full = ${fmt(goal, 0)} SOL` : "full", w - 14, h - 18);
    });
    drawFull();
    { const fy = HT - 0.1, hw = HWB + (HWT - HWB) * ((fy - HB) / (HT - HB)); plate(hw * 2 - 0.06, (hw * 2 - 0.06) / 8, fullTex, hx, fy + 0.02, hw + 0.01); }

    // coins inside: deterministic jumble, filled bottom-up
    const slots = [];
    {
      let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const sp = COIN_R * 2.15;
      for (let y = HB + 0.04, layer = 0; y < HT - 0.08; y += COIN_H * 1.7, layer++) {
        const hw = HWB + (HWT - HWB) * ((y - HB) / (HT - HB)) - COIN_R - 0.02;
        const off = layer % 2 ? sp / 2 : 0;
        for (let x = -hw + off; x <= hw + 1e-6; x += sp)
          for (let z = -hw + off; z <= hw + 1e-6; z += sp) {
            if (R() < 0.22) continue;
            slots.push({ x: hx + x + (R() - 0.5) * 0.04, y: y + (R() - 0.5) * 0.02, z: z + (R() - 0.5) * 0.04, rx: (R() - 0.5) * 0.7, rz: (R() - 0.5) * 0.7, ry: R() * TAU });
          }
      }
    }
    const coins = new T.InstancedMesh(coinGeo, coinMatArr, slots.length);
    {
      const e = new T.Euler();
      slots.forEach((s, i) => { e.set(s.rx, s.ry, s.rz); tmpQ.setFromEuler(e); tmpP.set(s.x, s.y, s.z); tmpM.compose(tmpP, tmpQ, tmpS); coins.setMatrixAt(i, tmpM); });
    }
    coins.count = 0;
    add(coins);
    let shownFrac = 0;
    const coinCount = () => {
      let n = Math.round(Math.min(1, Math.max(0, shownFrac)) * slots.length);
      if (!n && frac > 0) n = 1;
      return n;
    };

    // feed pipe from pump.fun
    {
      const curve = new T.CatmullRomCurve3([V(7.5, 3.9, -1.2), V(5.4, 3.75, -0.5), V(4.1, 3.55, 0), V(hx, 3.15, 0), V(hx, 2.88, 0)]);
      add(new T.Mesh(new T.TubeGeometry(curve, small ? 24 : 48, 0.11, 10, false), paint));
      const lbl = canvasTex(512, 96, () => {});
      redrawLater(lbl, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        c.fillStyle = "#e6d9bb"; c.fillRect(0, 10, w, h - 20);
        c.fillStyle = "#1d150d"; c.font = "54px VT323, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("from pump.fun →", w / 2, h / 2 + 2);
      });
      plate(0.9, 0.17, lbl, hx + 1.4, 3.38, 0.0, 0).rotation.set(0, 0, -0.06);
    }
    function redrawLater(t, fn) { redraw(t, fn); fontsReady.then(() => redraw(t, fn)); }

    // ---------- the saw ----------
    const bladeGroup = new T.Group();
    bladeGroup.position.set(0, SAW_Y, 0);
    root.add(bladeGroup);
    const bladeTex = canvasTex(512, 512, (c, w) => {
      const r = w / 2, g = c.createLinearGradient(0, 0, w, w);
      g.addColorStop(0, "#eef1f2"); g.addColorStop(0.45, "#9aa1a6"); g.addColorStop(0.55, "#cdd2d5"); g.addColorStop(1, "#727a80");
      c.fillStyle = g; c.fillRect(0, 0, w, w);
      c.strokeStyle = "rgba(255,255,255,.2)"; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(r, r, r * (0.25 + i * 0.05), 0, TAU); c.stroke(); }
      c.strokeStyle = "#2b3033"; c.lineWidth = 7; c.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        c.beginPath(); c.moveTo(r + Math.cos(a) * r * 0.86, r + Math.sin(a) * r * 0.86); c.lineTo(r + Math.cos(a + 0.05) * r * 0.66, r + Math.sin(a + 0.05) * r * 0.66); c.stroke();
      }
      c.save(); c.translate(r, r); c.rotate(-0.5);
      c.fillStyle = "rgba(40,30,20,.6)"; c.font = "34px 'Special Elite', monospace"; c.textAlign = "center";
      c.fillText("FLOG · NO HANDS", 0, -r * 0.45);
      c.restore();
      c.fillStyle = "#e8342b"; c.beginPath(); c.arc(r + r * 0.42, r + r * 0.3, 12, 0, TAU); c.fill();
    });
    bladeTex.repeat.set(1 / (2 * SAW_R), 1 / (2 * SAW_R));
    bladeTex.offset.set(0.5, 0.5);
    const bladeShape = new T.Shape();
    {
      const n = small ? 30 : 40, ro = SAW_R, ri = SAW_R - 0.08;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, st = TAU / n;
        const p = [[a, ri], [a + st * 0.62, ro], [a + st * 0.72, ro - 0.02]];
        p.forEach(([aa, rr], j) => (i === 0 && j === 0 ? bladeShape.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : bladeShape.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr)));
      }
      bladeShape.closePath();
      const h = new T.Path(); h.absarc(0, 0, 0.05, 0, TAU, true); bladeShape.holes.push(h);
    }
    const bladeGeo = new T.ExtrudeGeometry(bladeShape, { depth: 0.022, bevelEnabled: false, curveSegments: 4 });
    bladeGeo.translate(0, 0, -0.011);
    const blade = new T.Mesh(bladeGeo, new T.MeshStandardMaterial({ color: 0xc4c9cc, map: bladeTex, roughness: 0.45, metalness: 0.5 }));
    bladeGroup.add(blade);
    clickables.push(blade);
    const blurTex = canvasTex(256, 256, (c, w) => {
      const r = w / 2, g = c.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, "rgba(220,225,228,0)"); g.addColorStop(0.45, "rgba(220,225,228,0)"); g.addColorStop(0.8, "rgba(220,225,228,.16)");
      g.addColorStop(0.92, "rgba(235,238,240,.42)"); g.addColorStop(0.99, "rgba(200,205,208,.3)"); g.addColorStop(1, "rgba(200,205,208,0)");
      c.fillStyle = g; c.fillRect(0, 0, w, w);
    });
    const blur = new T.Mesh(new T.CircleGeometry(SAW_R * 1.0, 48), new T.MeshBasicMaterial({ map: blurTex, transparent: true, opacity: 0, depthWrite: false }));
    blur.position.z = 0.016;
    bladeGroup.add(blur);
    const arbor = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.09, 18).rotateX(Math.PI / 2), iron);
    bladeGroup.add(arbor);
    const nut = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.12, 6).rotateX(Math.PI / 2), brass);
    bladeGroup.add(nut);
    // hood over the top of the blade
    {
      const hood = new T.Mesh(new T.CylinderGeometry(SAW_R + 0.1, SAW_R + 0.1, 0.16, 40, 1, true, Math.PI - 1.15, 2.3).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: 0x8fa676, map: metalTex, roughness: 0.6, metalness: 0.35, side: T.DoubleSide }));
      hood.position.set(0, SAW_Y, 0); add(hood, root, true);
      const rim = new T.Mesh(new T.RingGeometry(SAW_R + 0.02, SAW_R + 0.1, 40, 1, Math.PI / 2 - 1.15, 2.3), stripeMat);
      rim.position.set(0, SAW_Y, 0.082); add(rim);
    }
    // gantry
    const GX = 1.4, GZ = -0.62, GTOP = 3.45;
    for (const x of [-GX, GX]) { box(0.2, GTOP, 0.2, paint, x, GTOP / 2, GZ, true); box(0.42, 0.06, 0.42, iron, x, 0.15, GZ); }
    box(GX * 2 + 0.5, 0.42, 0.24, paint, 0, GTOP - 0.15, GZ, true);
    box(GX * 2 + 0.5, 0.07, 0.01, stripeMat, 0, GTOP - 0.4, GZ + 0.125);
    box(0.18, GTOP - 0.36 - SAW_Y, 0.16, paint, 0, (GTOP - 0.36 + SAW_Y) / 2, -0.26);
    box(0.18, 0.18, 0.5, paint, 0, SAW_Y, -0.2);
    {
      const t = canvasTex(1024, 128, () => {});
      redrawLater(t, (c, w, h) => {
        c.fillStyle = "#d9cba7"; c.fillRect(0, 0, w, h);
        c.strokeStyle = "#5a4a32"; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
        c.fillStyle = "#1d150d"; c.font = "84px 'Special Elite', monospace"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("FLOG SAWMILL CO.", w / 2, h / 2 + 6);
        c.fillStyle = "#7a6a52"; for (const x of [26, w - 26]) { c.beginPath(); c.arc(x, h / 2, 9, 0, TAU); c.fill(); }
      });
      plate(2.4, 0.3, t, 0, GTOP - 0.15, GZ + 0.125);
    }
    // work lamp hanging from the beam
    // hung forward at the exit end of the beam so it lights the blade without covering the maker's plate from either camera stop
    const LAMP = V(-1.65, 2.95, 0.8);
    strut(V(LAMP.x, GTOP - 0.36, GZ + 0.1), V(LAMP.x, LAMP.y + 0.14, LAMP.z), 0.008, iron);
    {
      const shade = new T.Mesh(new T.ConeGeometry(0.22, 0.2, 18, 1, true), new T.MeshStandardMaterial({ color: 0x3f5d3a, roughness: 0.5, metalness: 0.4, side: T.DoubleSide }));
      shade.position.set(LAMP.x, LAMP.y + 0.05, LAMP.z); add(shade);
      const bulb = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), new T.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.set(LAMP.x, LAMP.y - 0.04, LAMP.z); add(bulb);
    }
    const LAMP_I = small ? 10 : 16;
    const lamp = new T.PointLight(0xffb36b, LAMP_I, 16, 1.5);
    lamp.position.set(LAMP.x, LAMP.y - 0.12, LAMP.z);
    root.add(lamp);

    // gears on the side, under the belt
    const gm = 0.042, nA = 16, nB = 10, rA = (gm * nA) / 2, rB = (gm * nB) / 2;
    const gA = new T.Mesh(gearGeo(nA, rA, 0.07, true), new T.MeshStandardMaterial({ color: 0x9aa082, roughness: 0.5, metalness: 0.5 }));
    const gB = new T.Mesh(gearGeo(nB, rB, 0.07, false), new T.MeshStandardMaterial({ color: 0x6f745f, roughness: 0.5, metalness: 0.5 }));
    const GA = V(-1.95, 0.5, 0.56), gAng = -0.55;
    gA.position.copy(GA);
    gB.position.set(GA.x + Math.cos(gAng) * (rA + rB), GA.y + Math.sin(gAng) * (rA + rB), GA.z);
    add(gA, root, true); add(gB, root, true);
    box(0.95, 0.5, 0.04, iron, GA.x + 0.18, GA.y - 0.08, GA.z - 0.05);
    for (const g of [gA, gB]) { const cap = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.12, 10).rotateX(Math.PI / 2), brass); cap.position.copy(g.position).add(V(0, 0, 0.06)); add(cap); }

    // gauge + odometer on a control post
    const CP = V(2.3, 0, 0.78);
    strut(V(CP.x, 0.12, CP.z - 0.06), V(CP.x, 1.36, CP.z - 0.06), 0.045, iron);
    strut(V(CP.x, 1.7, CP.z - 0.06), V(CP.x, 1.95, CP.z - 0.06), 0.03, iron);
    const gaugeTex = canvasTex(256, 256, () => {});
    const drawGauge = () => redraw(gaugeTex, (c, w) => {
      const r = w / 2;
      c.fillStyle = "#6d6650"; c.fillRect(0, 0, w, w);
      c.fillStyle = "#efe6cd"; c.beginPath(); c.arc(r, r, r - 14, 0, TAU); c.fill();
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      c.strokeStyle = "#e8342b"; c.lineWidth = 14; c.beginPath(); c.arc(r, r, r - 32, a0 + (a1 - a0) * 0.85, a1); c.stroke();
      c.strokeStyle = "#1d150d";
      for (let i = 0; i <= 20; i++) {
        const a = a0 + ((a1 - a0) * i) / 20, l = i % 5 ? 10 : 22;
        c.lineWidth = i % 5 ? 2 : 4;
        c.beginPath(); c.moveTo(r + Math.cos(a) * (r - 20), r + Math.sin(a) * (r - 20)); c.lineTo(r + Math.cos(a) * (r - 20 - l), r + Math.sin(a) * (r - 20 - l)); c.stroke();
      }
      c.fillStyle = "#1d150d"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = "38px VT323, monospace";
      const goal = data && data.flog_mint && +data.min_buy_sol ? fmt(+data.min_buy_sol, 0) : "–";
      // labels sit just inside the sweep so the needle at rest doesn't cover them
      c.fillText("0", r + Math.cos(a0 + 0.32) * (r - 58), r + Math.sin(a0 + 0.32) * (r - 58));
      c.fillText(goal, r + Math.cos(a1 - 0.32) * (r - 58), r + Math.sin(a1 - 0.32) * (r - 58));
      c.font = "34px 'Special Elite', monospace"; c.fillText("SOL", r, r + 62);
      c.fillStyle = "#7a6a52"; c.font = "30px VT323, monospace"; c.fillText("hopper", r, r - 50);
    });
    drawGauge();
    const gaugeFace = new T.Mesh(new T.CircleGeometry(0.24, 32), new T.MeshStandardMaterial({ map: gaugeTex, roughness: 0.5 }));
    gaugeFace.position.set(CP.x, 2.07, CP.z + 0.03); add(gaugeFace, root, true);
    const bezel = new T.Mesh(new T.TorusGeometry(0.245, 0.025, 8, 32), brass);
    bezel.position.copy(gaugeFace.position); add(bezel);
    const needle = new T.Mesh(new T.BoxGeometry(0.18, 0.014, 0.01).translate(0.07, 0, 0), new T.MeshBasicMaterial({ color: 0xe8342b }));
    needle.position.set(CP.x, 2.07, CP.z + 0.045); add(needle);
    const odoTex = canvasTex(512, 256, () => {});
    const odoMesh = new T.Mesh(new T.BoxGeometry(0.84, 0.42, 0.08), [iron, iron, iron, iron, new T.MeshBasicMaterial({ map: odoTex }), iron]);
    odoMesh.position.set(CP.x, 1.56, CP.z); add(odoMesh, root, true);
    let odoKey = "";
    function readout() {
      if (mode === "pre") return ["next claim", "--:--", "not running yet"];
      if (mode === "off") return ["machine", " off ", "fees wait in pump.fun"];
      const goal = +data.min_buy_sol || 0, pend = +data.pending_sol || 0;
      const line = `${fmt(pend, 3)} / ${fmt(goal, 0)} SOL in`;
      const s = Math.round((Date.parse(data.next_run || 0) - Date.now()) / 1000);
      if (!data.next_run || !isFinite(s)) return ["next claim", "--:--", line];
      if (s <= 0) return ["next claim", " now ", line];
      return ["next claim", `${Math.min(99, Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`.padStart(5, " "), line];
    }
    function drawOdo(force) {
      const [label, digits, line] = readout(), key = label + digits + line + mode;
      if (key === odoKey && !force) return;
      odoKey = key;
      redraw(odoTex, (c, w, h) => {
        c.fillStyle = "#1b1a15"; c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(239,232,214,.75)"; c.font = "40px VT323, monospace"; c.textAlign = "left"; c.textBaseline = "alphabetic";
        c.fillText(label, 26, 46);
        const lit = mode === "run" || mode === "full";
        c.fillStyle = mode === "off" ? "#e8342b" : lit ? "#63d63a" : "#3b3a30";
        c.beginPath(); c.arc(w - 34, 34, 11, 0, TAU); c.fill();
        const cw = (w - 52) / 5;
        c.font = "124px VT323, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
        for (let i = 0; i < 5; i++) {
          const x = 26 + i * cw;
          c.fillStyle = "#0b0a08"; c.fillRect(x + 3, 62, cw - 6, 120);
          c.fillStyle = lit ? "#ff7a14" : "#8a6a44";
          c.shadowColor = lit ? "rgba(255,122,20,.9)" : "transparent"; c.shadowBlur = lit ? 14 : 0;
          c.fillText(digits[i] || " ", x + cw / 2, 126);
          c.shadowBlur = 0;
          c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(x + 3, 120, cw - 6, 3);
        }
        c.fillStyle = "rgba(239,232,214,.8)"; c.font = "38px VT323, monospace"; c.textAlign = "center"; c.textBaseline = "alphabetic";
        c.fillText(line, w / 2, h - 22);
      });
    }

    // chalk sign on an easel: only when the machine isn't really cutting
    const signTex = canvasTex(512, 300, () => {});
    const sign = new T.Group();
    {
      const board = new T.Mesh(new T.BoxGeometry(1.15, 0.68, 0.04), [deckMat, deckMat, deckMat, deckMat, new T.MeshStandardMaterial({ map: signTex, roughness: 0.95 }), deckMat]);
      board.position.y = 0.78; board.rotation.x = -0.12; sign.add(board); clickables.push(board);
      const legM = new T.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.9 });
      for (const [x, z, rz, rx] of [[-0.6, -0.06, 0.1, -0.12], [0.6, -0.06, -0.1, -0.12], [0, -0.3, 0, 0.35]]) {
        const l = new T.Mesh(new T.BoxGeometry(0.05, 1.2, 0.04), legM);
        l.position.set(x, 0.6, z); l.rotation.set(rx, 0, rz); sign.add(l);
      }
    }
    // beside the hopper, clear of the blade so a real cut is never hidden behind it
    sign.position.set(hx - 0.65, 0.1, 1.5);
    sign.rotation.y = 0.12;
    root.add(sign);
    function signText() {
      if (mode === "pre") return ["waiting for the coin", "the belt is empty on purpose"];
      if (mode === "off") return ["machine offline", "fees wait in pump.fun"];
      if (mode === "full") return ["hopper full", "the next run cuts a log"];
      return null;
    }
    function drawSign() {
      const s = signText();
      sign.visible = !!s;
      if (!s) return;
      redraw(signTex, (c, w, h) => {
        c.fillStyle = "#6b4426"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#1f2a22"; c.fillRect(16, 16, w - 32, h - 32);
        c.fillStyle = "rgba(255,255,255,.05)"; c.fillRect(30, 90, w - 80, 30);
        c.fillStyle = "rgba(244,240,228,.94)"; c.textAlign = "center"; c.textBaseline = "alphabetic";
        let fs = 96; c.font = `${fs}px 'Reenie Beanie', Caveat, cursive`;
        while (c.measureText(s[0]).width > w - 90 && fs > 40) c.font = `${(fs -= 4)}px 'Reenie Beanie', Caveat, cursive`;
        c.fillText(s[0], w / 2, h * 0.5);
        c.fillStyle = "rgba(244,240,228,.72)"; c.font = "46px Caveat, cursive";
        c.fillText(s[1], w / 2, h * 0.8);
      });
    }

    // exit ramp + "to the pile" arrow
    const R0 = V(BELT_X1 - 0.05, BELT_Y - 0.04, 0), R1 = V(-5.7, 0.16, 0);
    {
      const dx = R1.x - R0.x, dy = R1.y - R0.y, len = Math.hypot(dx, dy);
      const ramp = new T.Mesh(new T.BoxGeometry(len, 0.05, 0.85), deckMat);
      ramp.position.set((R0.x + R1.x) / 2, (R0.y + R1.y) / 2 - 0.025, 0);
      ramp.rotation.z = Math.atan2(dy, dx) + Math.PI;
      add(ramp, root, true);
      for (const z of [0.44, -0.44]) { const rail = ramp.clone(); rail.geometry = new T.BoxGeometry(len, 0.12, 0.04); rail.material = paint; rail.position.z = z; rail.position.y += 0.05; add(rail); }
      strut(V(-3.6, 0.12, 0.38), V(-3.6, 0.72, 0.38), 0.04, iron); strut(V(-3.6, 0.12, -0.38), V(-3.6, 0.72, -0.38), 0.04, iron);
      const t = canvasTex(512, 128, () => {});
      redrawLater(t, (c, w, h) => {
        // points left as seen from the path (local -x, toward the pile)
        c.fillStyle = "#c98a4b"; c.beginPath(); c.moveTo(w, 20); c.lineTo(90, 20); c.lineTo(90, 0); c.lineTo(0, h / 2); c.lineTo(90, h); c.lineTo(90, h - 20); c.lineTo(w, h - 20); c.closePath(); c.fill();
        c.fillStyle = "#1d150d"; c.font = "66px 'Special Elite', monospace"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("to the pile", (w + 60) / 2, h / 2 + 4);
      });
      plate(1.3, 0.32, t, -6.2, 1.25, 0.9);
      strut(V(-6.2, 0.1, 0.86), V(-6.2, 1.1, 0.86), 0.035, new T.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.9 }));
    }

    // ---------- moving parts ----------
    const items = [], drops = [];
    function coinMesh() { const m = new T.Mesh(coinGeo, coinMatArr); m.scale.setScalar(1.5); root.add(m); return m; }
    function spawnCoin() {
      const m = coinMesh();
      m.position.set(hx, NECK - COIN_H, 0);
      items.push({ kind: "coin", m, vy: 0, ph: "drop", t: 0, r: COIN_R, sp: 0 });
    }
    // sawdust
    const PN = small ? 70 : 220;
    const pPos = new Float32Array(PN * 3).fill(-50), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
    const pGeo = new T.BufferGeometry();
    pGeo.setAttribute("position", new T.BufferAttribute(pPos, 3));
    const dust = new T.Points(pGeo, new T.PointsMaterial({ color: 0xe9c48c, size: small ? 0.05 : 0.035, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }));
    dust.frustumCulled = false;
    root.add(dust);
    let pHead = 0;
    function puff(x, y, z, vx, vy, vz, life) {
      const i = pHead; pHead = (pHead + 1) % PN;
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
      pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz; pLife[i] = life;
    }
    function spray(k) {
      for (let i = 0; i < k; i++) puff(0.05, BELT_Y + 0.02, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 1.8, 0.8 + Math.random() * 1.8, (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.8);
    }

    let v = 0, beltPos = 0, angA = 0, angSaw = 0.3, wSaw = 0, burst = 0, shake = 0, load = 0, needleA = 0, needleV = 0;
    let feedT = 0, claimT = 0, secT = 0, lampFlick = 0;

    function hit() {
      try { knock(1, 0.7); } catch {}
      burst = 1; shake = Math.max(shake, 1);
      spray(small ? 18 : 40);
    }
    clickables.forEach((m) => { m.userData.onClick = hit; W.raycastTargets.push(m); });

    function refresh() {
      drawFees(); drawFull(); drawGauge(); drawSign(); drawOdo(true);
    }
    fontsReady.then(refresh);
    refresh();

    const camDist = () => W.camera.position.distanceTo(ANCHOR);
    W.onFrame((dt) => {
      if (document.hidden) return;
      // skip all work when the camera is far from the mill
      if (root.parent?.userData.culled || camDist() > 70) return;
      dt = Math.min(dt, 0.05);
      secT += dt;
      if (secT > 1) {
        secT = 0;
        const m = computeMode();
        if (m !== mode) { mode = m; drawSign(); }
        drawOdo(false);
      }
      // motor: belt speed in m/s
      const target = mode === "off" ? 0 : mode === "pre" ? 0.05 : mode === "full" ? 0.55 : 0.22;
      const vt = Math.max(target, items.length ? 0.5 : 0) + burst * 1.1;
      v += (vt - v) * Math.min(1, dt * 2);
      burst = Math.max(0, burst - dt * 0.9);
      beltPos += v * dt;
      treadTex.offset.x = (beltPos / 0.22) % 1;
      setHubs(beltPos / 0.07);
      // gears: A turns off the belt drive, B meshes with it
      const wA = v / 0.12;
      angA += wA * dt;
      gA.rotation.z = angA;
      gB.rotation.z = (-angA * nA) / nB + Math.PI / nB;
      // saw
      wSaw = (v * 15 + 0.2 * (mode !== "off")) * (1 - load * 0.2);
      angSaw += wSaw * dt;
      blade.rotation.z = -angSaw; nut.rotation.z = -angSaw;
      blur.material.opacity = Math.min(0.4, Math.max(0, (wSaw - 6) / 14));
      load = Math.max(0, load - dt * 3);

      // feeding: only when the hopper is really full, or a real new log showed up in the flog log
      feedT -= dt;
      const busy = items.some((it) => it.kind === "coin");
      if (feedT <= 0 && !busy && mode !== "pre" && mode !== "off") {
        if (cutsQueued > 0) { cutsQueued--; spawnCoin(); feedT = 1.5; }
        else if (mode === "full") { spawnCoin(); feedT = 2.5; }
      }
      // real claims: coins drop from the pump.fun pipe into the hopper
      claimT -= dt;
      if (claimDrops > 0 && claimT <= 0) {
        claimDrops--; claimT = 0.3;
        const m = coinMesh(); m.position.set(hx + (Math.random() - 0.5) * 0.1, 2.85, (Math.random() - 0.5) * 0.1);
        drops.push({ m, vy: 0 });
      }
      const n = coinCount();
      const pileTop = n ? slots[Math.min(n, slots.length) - 1].y + 0.04 : HB + 0.05;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.vy += 9.8 * dt; d.m.position.y -= d.vy * dt; d.m.rotation.x += dt * 9;
        if (d.m.position.y <= pileTop) { root.remove(d.m); drops.splice(i, 1); }
      }
      shownFrac += (Math.min(frac, 1) - shownFrac) * Math.min(1, dt * 1.2);
      coins.count = coinCount();

      // items along the line
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i], p = it.m.position;
        if (it.ph === "drop") {
          it.vy += 9.8 * dt; p.y -= it.vy * dt; it.m.rotation.x += dt * 6;
          if (p.y <= BELT_Y + COIN_H / 2) { p.y = BELT_Y + COIN_H / 2; it.m.rotation.x = 0; it.ph = "belt"; shake = Math.max(shake, 0.3); }
        } else if (it.ph === "belt") {
          p.x -= v * dt;
          if (it.kind === "log") it.m.rotation.z += (v * dt) / LOG_R;
          if (it.kind === "coin" && p.x <= 0.14) { it.ph = "cut"; it.t = 0; shake = Math.max(shake, 1.2); }
          if (it.kind === "log" && p.x <= BELT_X1) { it.ph = "ramp"; it.sp = v; }
        } else if (it.ph === "cut") {
          it.t += dt; p.x -= v * 0.15 * dt; load = 1; shake = Math.max(shake, 0.7);
          if (Math.random() < dt * 50) spray(1);
          if (it.t > 0.8) {
            root.remove(it.m);
            it.kind = "log"; it.m = new T.Mesh(logGeo, logMatArr); it.m.position.set(p.x - 0.05, BELT_Y + LOG_R, 0);
            it.m.scale.setScalar(0.01); it.m.rotation.z = Math.random() * TAU; root.add(it.m);
            it.ph = "grow"; it.t = 0;
          }
        } else if (it.ph === "grow") {
          it.t += dt; const s = Math.min(1, it.t / 0.3); it.m.scale.setScalar(0.3 + 0.7 * s * s * (3 - 2 * s));
          p.x -= v * 0.5 * dt;
          if (s >= 1) { it.m.scale.setScalar(1); it.ph = "belt"; }
        } else if (it.ph === "ramp") {
          const slope = (R0.y - R1.y) / (R0.x - R1.x);
          it.sp = Math.min(3.2, it.sp + 9.8 * Math.sin(Math.atan(slope)) * dt);
          const dx = it.sp * dt * Math.cos(Math.atan(slope));
          p.x -= dx; p.y = R0.y + (p.x - R0.x) * slope + LOG_R;
          it.m.rotation.z += (it.sp * dt) / LOG_R;
          if (p.x <= R1.x) { it.ph = "roll"; p.y = 0.12 + LOG_R; }
        } else if (it.ph === "roll") {
          it.sp = Math.max(0, it.sp - 1.1 * dt);
          p.x -= it.sp * dt; it.m.rotation.z += (it.sp * dt) / LOG_R;
          // off the end of the deck: drop to the ground
          if (p.x < -6.35) p.y = Math.max(LOG_R, p.y - dt * 1.5);
          if (it.sp <= 0.05 || p.x < -9) { it.ph = "fade"; it.t = 0; }
        } else if (it.ph === "fade") {
          it.t += dt; it.m.scale.setScalar(Math.max(0.01, 1 - it.t / 0.6));
          if (it.t > 0.6) { root.remove(it.m); items.splice(i, 1); }
        }
      }

      // sawdust
      for (let i = 0; i < PN; i++) {
        if (pLife[i] <= 0) continue;
        pLife[i] -= dt;
        const j = i * 3;
        pVel[j + 1] -= 9.8 * dt;
        pPos[j] += pVel[j] * dt; pPos[j + 1] += pVel[j + 1] * dt; pPos[j + 2] += pVel[j + 2] * dt;
        if (pPos[j + 1] < 0.13) { pPos[j + 1] = 0.13; pVel[j] *= 0.3; pVel[j + 1] = 0; pVel[j + 2] *= 0.3; }
        if (pLife[i] <= 0) pPos[j + 1] = -50;
      }
      pGeo.attributes.position.needsUpdate = true;

      // gauge needle: damped spring with a little motor buzz
      const nt = Math.min(frac, 1.08) + (mode === "run" || mode === "full" ? Math.sin(performance.now() / 90) * 0.004 : 0);
      needleV += ((nt - needleA) * 40 - needleV * 7) * dt;
      needleA += needleV * dt;
      needle.rotation.z = -(Math.PI * 0.75 + Math.PI * 1.5 * Math.max(-0.02, Math.min(1.08, needleA)));

      // lamp: steady, dips a hair when the saw bites
      lampFlick += dt;
      lamp.intensity = LAMP_I * (1 - load * 0.08 + (load ? Math.sin(lampFlick * 60) * 0.03 : 0));

      // shake when the saw bites
      shake = Math.max(0, shake - dt * 4);
      root.position.set(ANCHOR.x + (Math.random() - 0.5) * shake * 0.012, (Math.random() - 0.5) * shake * 0.006, ANCHOR.z + (Math.random() - 0.5) * shake * 0.012);
    });

    api = { refresh };
    // a poll may have landed before the world was ready
    mode = computeMode();
    refresh();
  }

  return { update };
})();
