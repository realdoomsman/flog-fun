// the pile, the rings and the ledger log, in the world (three.js).
// one real 3D log per keeper entry, stacked oldest-first. no entries = dashed ghost logs, labelled not real.
// the floating cross-section gets one dark ring per lock. the huge fallen log + lantern sits under the DOM ledger.

function renderPile(entries) { __flogPile3d.set(entries); }

// shared procedural wood (also used by js/mill3d.js for its cut logs)
window.__flogWood = window.__flogWood || (() => {
  const TAU = Math.PI * 2;
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function wobble(c, cx, cy, r, k) {
    const rand = seeded(k * 7919 + 13);
    const p1 = rand() * TAU, p2 = rand() * TAU, a1 = 0.012 + rand() * 0.014, a2 = 0.006 + rand() * 0.01;
    const ox = (rand() - 0.5) * r * 0.012, oy = (rand() - 0.5) * r * 0.012;
    c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU, rr = r * (1 + a1 * Math.sin(3 * a + p1) + a2 * Math.sin(7 * a + p2));
      const x = cx + ox + Math.cos(a) * rr, y = cy + oy + Math.sin(a) * rr;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  }
  // a log end: bark rim, face, faint grain, `locks` dark lock rings from the pith out (oldest innermost)
  function drawRings(cv, { seed = 1, rings = 10, locks = 0 } = {}) {
    const c = cv.getContext("2d"), S = cv.width, m = S / 2, R = S / 2, rand = seeded(seed * 131 + 7);
    c.clearRect(0, 0, S, S);
    c.fillStyle = "#2e1c10"; c.fillRect(0, 0, S, S);
    c.beginPath(); c.arc(m, m, R, 0, TAU); c.fillStyle = "#3b2415"; c.fill();
    c.lineCap = "round";
    for (let i = 0; i < 160; i++) {
      const a = rand() * TAU, r0 = R * (0.88 + rand() * 0.03), r1 = R * (0.95 + rand() * 0.05);
      c.strokeStyle = rand() < 0.7 ? "#1e1109" : "#5a3a22"; c.lineWidth = S * (0.002 + rand() * 0.005);
      c.beginPath(); c.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0); c.lineTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1); c.stroke();
    }
    const Rf = R * 0.88;
    const g = c.createRadialGradient(m * 0.97, m * 1.03, 0, m, m, Rf);
    g.addColorStop(0, "#f6dcae"); g.addColorStop(0.65, "#ebc88f"); g.addColorStop(1, "#c99556");
    c.beginPath(); c.arc(m, m, Rf, 0, TAU); c.fillStyle = g; c.fill();
    c.strokeStyle = "rgba(150,92,40,.33)";
    for (let i = 1; i <= rings; i++) { c.lineWidth = S * (0.0015 + rand() * 0.002); wobble(c, m, m, Rf * (i / (rings + 0.6)), seed * 1000 + i); c.stroke(); }
    if (locks > 0) {
      const gap = Math.min(Rf * 0.075, (Rf * 0.9) / locks), w = Math.max(1.2, Math.min(S * 0.01, gap * 0.45));
      for (let k = 1; k <= locks; k++) {
        c.lineWidth = k === locks ? w * 1.5 : w;
        c.strokeStyle = k === locks ? "#3f210d" : "#5a3218";
        wobble(c, m, m, Rf * 0.04 + gap * k, k);
        c.stroke();
      }
    }
    const sh = c.createRadialGradient(m, m, Rf * 0.72, m, m, Rf);
    sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.28)");
    c.beginPath(); c.arc(m, m, Rf, 0, TAU); c.fillStyle = sh; c.fill();
    c.lineWidth = S * 0.006; c.strokeStyle = "#7a4a22"; c.stroke();
    c.beginPath(); c.arc(m, m, S * 0.012, 0, TAU); c.fillStyle = "#6b3f1c"; c.fill();
    c.strokeStyle = "rgba(60,30,10,.6)"; c.lineWidth = S * 0.004;
    const ca = rand() * TAU;
    c.beginPath(); c.moveTo(m + Math.cos(ca) * S * 0.02, m + Math.sin(ca) * S * 0.02); c.lineTo(m + Math.cos(ca + 0.08) * Rf * 0.6, m + Math.sin(ca + 0.08) * Rf * 0.6); c.stroke();
    return cv;
  }
  function tex(T, cv) { const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  function ringTexture(T, opts = {}) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = opts.size || 512;
    return tex(T, drawRings(cv, opts));
  }
  // vertical bark furrows, tileable both ways (u wraps the trunk, v runs along it)
  function barkTexture(T, { w = 512, h = 512, seed = 3 } = {}) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const c = cv.getContext("2d"), rand = seeded(seed * 97 + 5);
    c.fillStyle = "#4e321c"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x0 = rand() * w, amp = 2 + rand() * 6, k = 1 + Math.floor(rand() * 3), ph = rand() * TAU;
      const dark = rand() < 0.6;
      c.strokeStyle = dark ? `rgba(18,10,4,${0.5 + rand() * 0.4})` : `rgba(${110 + rand() * 40 | 0},${72 + rand() * 30 | 0},${40 + rand() * 20 | 0},${0.35 + rand() * 0.3})`;
      c.lineWidth = dark ? 2 + rand() * 5 : 1 + rand() * 3;
      for (const dx of [-w, 0, w]) {
        c.beginPath();
        for (let y = 0; y <= h; y += 8) { const x = x0 + dx + Math.sin((y / h) * TAU * k + ph) * amp; y ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
    }
    for (let i = 0; i < 1400; i++) { c.fillStyle = rand() < 0.5 ? "rgba(0,0,0,.25)" : "rgba(200,150,90,.12)"; c.fillRect(rand() * w, rand() * h, 2, 2); }
    const t = tex(T, cv);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  return { drawRings, ringTexture, barkTexture };
})();

var __flogPile3d = (() => {
  const STATIC = document.documentElement.classList.contains("static");
  let entries = null, api = null;

  function set(list) {
    if (STATIC) return;
    entries = Array.isArray(list) ? list : [];
    if (api) api.sync();
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
    const T = W.THREE, small = !!(W.isSmall || W.quality === "low"), wood = window.__flogWood;
    const TAU = Math.PI * 2;
    const PILE = new T.Vector3(-6, 0, -205), RINGS = new T.Vector3(0, 7.6, -228), LEDGER = new T.Vector3(0, 0, -252);
    const CAP = small ? 50 : 120;
    const fontsReady = document.fonts ? Promise.all(["40px VT323", "40px 'Special Elite'", "40px Caveat", "800 40px Bricolage"].map((f) => document.fonts.load(f).catch(() => {}))) : Promise.resolve();
    function canvasTex(w, h, draw) {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = small ? 1 : 4;
      const paint = () => { draw(c.getContext("2d"), w, h); t.needsUpdate = true; };
      paint(); fontsReady.then(paint);
      t.repaint = paint;
      return t;
    }
    const near = (p, d) => W.camera.position.distanceTo(p) < d;
    const culled = (g) => g.parent?.userData.culled;
    const audioOn = () => typeof actx !== "undefined" && actx && actx.state === "running";

    // =============== the pile ===============
    const pileG = new T.Group(); pileG.name = "pile";
    W.addToBeat("pile", pileG);
    const barkTex = wood.barkTexture(T, { w: small ? 256 : 512, h: small ? 256 : 512, seed: 9 });
    barkTex.repeat.set(2, 1);
    const capTexs = [1, 2, 3].map((s) => wood.ringTexture(T, { size: small ? 256 : 512, seed: s * 17, rings: 7 + s * 2 }));
    const barkMat = new T.MeshStandardMaterial({ map: barkTex, roughness: 0.95 });
    const capMats = capTexs.map((t) => new T.MeshStandardMaterial({ map: t, roughness: 0.8, emissive: 0x2a1a0c, emissiveMap: t, emissiveIntensity: 0.12 }));
    const logGeo = new T.CylinderGeometry(1, 1, 1, small ? 12 : 20, 1, false).rotateZ(Math.PI / 2);
    // three instanced batches so the ring caps vary; each takes every third log
    const batches = capMats.map((cm) => {
      const im = new T.InstancedMesh(logGeo, [barkMat, cm, cm], Math.ceil(CAP / 3));
      im.count = 0; im.frustumCulled = false;
      pileG.add(im);
      return im;
    });
    const proxyGeo = new T.CylinderGeometry(1, 1, 1, 8).rotateZ(Math.PI / 2);
    const proxyMat = new T.MeshBasicMaterial({ visible: false });

    // forest floor under the pile
    {
      const t = canvasTex(small ? 256 : 512, small ? 256 : 512, (c, w) => {
        const m = w / 2, rand = (() => { let s = 77; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
        c.clearRect(0, 0, w, w);
        const g = c.createRadialGradient(m, m, 0, m, m, m);
        g.addColorStop(0, "rgba(28,20,12,1)"); g.addColorStop(0.7, "rgba(30,24,14,.9)"); g.addColorStop(1, "rgba(30,24,14,0)");
        c.fillStyle = g; c.fillRect(0, 0, w, w);
        for (let i = 0; i < 40; i++) { const a = rand() * TAU, r = rand() * m * 0.85; c.fillStyle = `rgba(${60 + rand() * 30 | 0},${90 + rand() * 40 | 0},${30 + rand() * 20 | 0},.5)`; c.beginPath(); c.ellipse(m + Math.cos(a) * r, m + Math.sin(a) * r, 6 + rand() * 20, 4 + rand() * 12, rand() * 3, 0, TAU); c.fill(); }
        c.lineWidth = 1.2;
        for (let i = 0; i < 260; i++) { const a = rand() * TAU, r = rand() * m * 0.9, x = m + Math.cos(a) * r, y = m + Math.sin(a) * r, b = rand() * TAU; c.strokeStyle = rand() < 0.5 ? "rgba(140,96,50,.7)" : "rgba(90,60,30,.7)"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(b) * 9, y + Math.sin(b) * 9); c.stroke(); }
        for (let i = 0; i < 26; i++) { const a = rand() * TAU, r = rand() * m * 0.85; c.fillStyle = ["#7a4a1e", "#a0622a", "#5d6b2a"][i % 3]; c.beginPath(); c.ellipse(m + Math.cos(a) * r, m + Math.sin(a) * r, 7, 3.5, rand() * 3, 0, TAU); c.fill(); }
      });
      const floor = new T.Mesh(new T.CircleGeometry(4.6, 40), new T.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(PILE.x, 0.015, PILE.z);
      pileG.add(floor);
    }

    // work light on a pole beside the pile
    {
      const poleMat = new T.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.9 });
      const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 3.6, 8), poleMat);
      pole.position.set(PILE.x + 2.9, 1.8, PILE.z - 2.6); pileG.add(pole);
      const a = new T.Vector3(PILE.x + 2.9, 3.55, PILE.z - 2.6), b = new T.Vector3(PILE.x + 2.1, 3.5, PILE.z - 1.35);
      const arm = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 6), poleMat);
      arm.position.copy(a).lerp(b, 0.5);
      arm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      pileG.add(arm);
      const drop = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.1, 4), poleMat);
      drop.position.set(b.x, 3.47, b.z); pileG.add(drop);
      const shade = new T.Mesh(new T.ConeGeometry(0.18, 0.16, 16, 1, true), new T.MeshStandardMaterial({ color: 0x3f5d3a, roughness: 0.5, side: T.DoubleSide }));
      shade.position.set(PILE.x + 2.1, 3.36, PILE.z - 1.35); pileG.add(shade);
      const bulb = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), new T.MeshBasicMaterial({ color: 0xffd9a0 }));
      bulb.position.set(PILE.x + 2.1, 3.28, PILE.z - 1.35); pileG.add(bulb);
      const l = new T.PointLight(0xffbd7a, small ? 16 : 26, 14, 1.4);
      l.position.set(PILE.x + 2.1, 3.15, PILE.z - 1.3); pileG.add(l);
    }

    // deterministic heap: slots in the cross-section (z across, y up), sorted so the heap grows from the middle
    const D = 0.5, ROW = D * 0.866;
    const slots = [];
    {
      const b = small ? 10 : 15;
      for (let row = 0; row < b; row++)
        for (let j = 0; j < b - row; j++) slots.push({ z: (j - (b - row - 1) / 2) * D, row });
      slots.sort((a, c) => a.row * ROW + Math.abs(a.z) * 0.5 - (c.row * ROW + Math.abs(c.z) * 0.5));
    }
    const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    const logs = [];
    let dropped = false;
    const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(), tmpP = new T.Vector3(), tmpS = new T.Vector3(), tmpC = new T.Color();

    function makeLog(i) {
      const s = slots[i], r = 0.19 + rnd(i, 1) * 0.05, len = 1.0 + rnd(i, 2) * 0.55;
      const lg = {
        i, r, len,
        x: PILE.x + (rnd(i, 3) - 0.5) * 0.45, z: PILE.z + s.z + (rnd(i, 4) - 0.5) * 0.04,
        ty: s.row ? 0.24 + s.row * ROW + (rnd(i, 5) - 0.5) * 0.02 : r,
        yaw: (rnd(i, 6) - 0.5) * 0.12, roll: rnd(i, 7) * TAU,
        y: 0, vy: 0, ph: "wait", delay: 0, hop: -1, loud: false,
        batch: batches[i % 3], slot: Math.floor(i / 3),
      };
      lg.y = lg.ty;
      tmpC.setHSL(0.07 + rnd(i, 8) * 0.03, 0.25 + rnd(i, 9) * 0.2, 0.62 + rnd(i, 10) * 0.25);
      lg.batch.setColorAt(lg.slot, tmpC);
      lg.batch.instanceColor.needsUpdate = true;
      const px = new T.Mesh(proxyGeo, proxyMat);
      px.position.set(lg.x, lg.ty, lg.z); px.rotation.set(lg.roll, lg.yaw, 0); px.scale.set(lg.len, lg.r, lg.r);
      px.userData.onClick = () => { try { knock(1, 0.75 + Math.random() * 0.6); } catch {} if (lg.ph === "rest") { lg.ph = "hop"; lg.hop = 0; } };
      px.userData.onHover = (on) => (on ? showTag(lg) : hideTag(lg));
      pileG.add(px); W.raycastTargets.push(px);
      lg.px = px;
      return lg;
    }
    function place(lg, hidden) {
      let y = lg.y, roll = lg.roll;
      if (lg.ph === "hop") { const k = lg.hop / 0.42; y = lg.ty + Math.sin(Math.PI * k) * 0.28; roll += Math.sin(Math.PI * k) * 0.5; }
      tmpE.set(roll, lg.yaw, 0); tmpQ.setFromEuler(tmpE);
      tmpP.set(lg.x, y, lg.z);
      if (hidden) tmpS.set(0.0001, 0.0001, 0.0001); else tmpS.set(lg.len, lg.r, lg.r);
      tmpM.compose(tmpP, tmpQ, tmpS);
      lg.batch.setMatrixAt(lg.slot, tmpM);
      lg.batch.instanceMatrix.needsUpdate = true;
    }

    // ghosts: dashed outlines, clearly not real
    const ghostG = new T.Group();
    pileG.add(ghostG);
    {
      const pts = [], seg = 28, len = 1.25, r = 0.22;
      for (const x of [-len / 2, len / 2]) for (let k = 0; k < seg; k++) {
        const a = (k / seg) * TAU, b = ((k + 1) / seg) * TAU;
        pts.push(x, Math.cos(a) * r, Math.sin(a) * r, x, Math.cos(b) * r, Math.sin(b) * r);
      }
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; pts.push(-len / 2, Math.cos(a) * r, Math.sin(a) * r, len / 2, Math.cos(a) * r, Math.sin(a) * r); }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
      const mat = new T.LineDashedMaterial({ color: 0xcfe9b8, dashSize: 0.07, gapSize: 0.06, transparent: true, opacity: 0.55, depthWrite: false });
      for (const [z, y] of [[-0.5, 0.22], [0, 0.22], [0.5, 0.22], [-0.25, 0.65], [0.25, 0.65]]) {
        const l = new T.LineSegments(g, mat); l.computeLineDistances();
        l.position.set(PILE.x, y, PILE.z + z); ghostG.add(l);
      }
      ghostG.userData.mat = mat;
      const t = canvasTex(1024, 320, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        c.fillStyle = "rgba(12,10,8,.55)"; c.fillRect(40, 20, w - 80, h - 40);
        c.setLineDash([16, 12]); c.strokeStyle = "rgba(207,233,184,.75)"; c.lineWidth = 4; c.strokeRect(40, 20, w - 80, h - 40);
        c.fillStyle = "#cfe9b8"; c.textAlign = "center"; c.textBaseline = "middle";
        // shrink each line until it sits inside the dashed box
        const fit = (s, px, fam, y, maxW) => { let f = px; c.font = `${f}px ${fam}`; while (c.measureText(s).width > maxW && f > 20) c.font = `${(f -= 2)}px ${fam}`; c.fillText(s, w / 2, y); };
        fit("future logs (not real yet)", 92, "VT323, monospace", 108, w - 150);
        c.fillStyle = "rgba(239,232,214,.9)";
        fit("the first real log lands after the first ~2 SOL of fees", 58, "Caveat, cursive", 220, w - 150);
      });
      const label = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
      label.scale.set(3.6, 1.125, 1); label.position.set(PILE.x + 0.4, 1.75, PILE.z + 0.3);
      ghostG.add(label);
    }
    // "showing N of M" when the pile is bigger than the cap
    let capInfo = "";
    const capTex = canvasTex(512, 96, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      if (!capInfo) return;
      c.fillStyle = "rgba(12,10,8,.6)"; c.fillRect(0, 10, w, h - 20);
      c.fillStyle = "#ecc994"; c.font = "54px VT323, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(capInfo, w / 2, h / 2 + 2);
    });
    const capSprite = new T.Sprite(new T.SpriteMaterial({ map: capTex, transparent: true, depthWrite: false }));
    capSprite.scale.set(1.8, 0.34, 1); capSprite.visible = false;
    pileG.add(capSprite);

    // hover tag (DOM)
    const tag = document.createElement("div");
    tag.className = "p3-tag"; tag.setAttribute("role", "tooltip"); tag.hidden = true;
    document.body.appendChild(tag);
    let tagFor = null, px0 = 0, py0 = 0;
    addEventListener("pointermove", (e) => { px0 = e.clientX; py0 = e.clientY; if (tagFor) moveTag(); }, { passive: true });
    function moveTag() {
      const w = tag.offsetWidth, h = tag.offsetHeight;
      tag.style.transform = `translate(${Math.min(innerWidth - w - 8, px0 + 16)}px, ${Math.max(8, py0 - h - 14)}px)`;
    }
    const day = (s) => { const v = String(s || ""); return /^\d{4}-\d\d-\d\dT/.test(v) ? v.slice(0, 10) : v; };
    function showTag(lg) {
      const e = entries[lg.i];
      if (!e) return;
      tagFor = lg;
      tag.innerHTML =
        `<b>log ${String(lg.i + 1).padStart(3, "0")}</b>${e.date ? `<span>${esc(day(e.date))}</span>` : ""}` +
        `<i>bought ${fmt(+e.bought || 0)} $FLOG</i>` +
        `<i>${e.locked_until ? `locked until ${esc(day(e.locked_until))}` : "lock pending"}</i>`;
      tag.hidden = false;
      moveTag();
    }
    function hideTag(lg) { if (tagFor === lg || !lg) { tagFor = null; tag.hidden = true; } }

    function sync() {
      const list = entries || [];
      const shown = Math.min(list.length, CAP);
      if (shown < logs.length) {
        // the log only ever grows; if it shrank, rebuild from scratch
        logs.splice(0).forEach((lg) => { pileG.remove(lg.px); const k = W.raycastTargets.indexOf(lg.px); if (k >= 0) W.raycastTargets.splice(k, 1); });
        hideTag();
      }
      let added = 0;
      while (logs.length < shown) {
        const lg = makeLog(logs.length);
        if (dropped) { lg.ph = "fall"; lg.delay = added * 0.35; lg.y = lg.ty + 4 + rnd(lg.i, 11) * 1.5; lg.loud = true; added++; }
        logs.push(lg);
      }
      batches.forEach((b, k) => { b.count = Math.ceil(Math.max(0, logs.length - k) / 3); });
      logs.forEach((lg) => place(lg, lg.ph === "wait" || (lg.ph === "fall" && lg.delay > 0)));
      ghostG.visible = shown === 0;
      capInfo = list.length > CAP ? `showing ${CAP} of ${fmt(list.length)}` : "";
      capSprite.visible = !!capInfo;
      if (capInfo) capSprite.position.set(PILE.x + 1.9, 0.3, PILE.z + 0.6);
      capTex.repaint();
      setRings(list.length);
      if (tagFor) showTag(tagFor);
    }
    function startDrop() {
      dropped = true;
      const n = logs.length, step = Math.min(0.09, 3.2 / Math.max(1, n));
      logs.forEach((lg, k) => { lg.ph = "fall"; lg.delay = 0.15 + k * step; lg.y = lg.ty + 3 + rnd(lg.i, 11) * 2; lg.vy = 0; lg.loud = false; });
    }

    // =============== the rings cross-section ===============
    const ringG = new T.Group(); ringG.name = "rings";
    W.addToBeat("pile", ringG);
    const DISC_R = 4.0;
    const ringCv = document.createElement("canvas");
    ringCv.width = ringCv.height = small ? 1024 : 2048;
    const ringTex = new T.CanvasTexture(ringCv); ringTex.colorSpace = T.SRGBColorSpace; ringTex.anisotropy = small ? 2 : 8;
    const discBark = wood.barkTexture(T, { w: 512, h: 128, seed: 21 }); discBark.repeat.set(6, 1);
    const faceMat = new T.MeshStandardMaterial({ map: ringTex, roughness: 0.85, emissive: 0xffffff, emissiveMap: ringTex, emissiveIntensity: 0.26 });
    const disc = new T.Mesh(new T.CylinderGeometry(DISC_R, DISC_R, 0.5, small ? 64 : 112, 1, false).rotateX(Math.PI / 2), [new T.MeshStandardMaterial({ map: discBark, roughness: 0.95 }), faceMat, faceMat]);
    const bob = new T.Group();
    bob.position.copy(RINGS);
    bob.add(disc);
    ringG.add(bob);
    let ringN = -1, plankText = "";
    const plankTex = canvasTex(1024, 240, (c, w, h) => {
      const rand = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
      c.fillStyle = "#d9a96c"; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(${120 + rand() * 40 | 0},${75 + rand() * 25 | 0},35,${0.12 + rand() * 0.18})`; c.lineWidth = 1 + rand() * 3; const y = rand() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 20, w * 0.6, y + (rand() - 0.5) * 20, w, y + (rand() - 0.5) * 10); c.stroke(); }
      c.strokeStyle = "rgba(60,30,10,.55)"; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
      // carved: a light lip below-right, then the dark cut
      const [big, line1, line2] = plankText.split("|");
      c.textBaseline = "middle"; c.textAlign = "right";
      c.font = "800 190px Bricolage, sans-serif";
      const bx = w * 0.4;
      c.fillStyle = "rgba(255,236,200,.6)"; c.fillText(big || "0", bx + 4, h / 2 + 12);
      c.fillStyle = "#1e0f05"; c.fillText(big || "0", bx, h / 2 + 8);
      c.textAlign = "left"; c.font = "700 70px Bricolage, sans-serif";
      [[line1, h * 0.34], [line2, h * 0.7]].forEach(([s, y]) => {
        c.fillStyle = "rgba(255,236,200,.6)"; c.fillText(s || "", w * 0.45 + 3, y + 3);
        c.fillStyle = "#1e0f05"; c.fillText(s || "", w * 0.45, y);
      });
    });
    {
      const plankMat = new T.MeshStandardMaterial({ color: 0x8a5e34, roughness: 0.9 });
      const plank = new T.Mesh(new T.BoxGeometry(3.4, 0.8, 0.09), [plankMat, plankMat, plankMat, plankMat, new T.MeshStandardMaterial({ map: plankTex, roughness: 0.85, emissive: 0xffffff, emissiveMap: plankTex, emissiveIntensity: 0.5 }), plankMat]);
      plank.position.set(0, -DISC_R - 0.17 - 0.4, 0.1);
      bob.add(plank);
      const chainMat = new T.LineDashedMaterial({ color: 0x9a978a, dashSize: 0.05, gapSize: 0.03 });
      for (const x of [-1, 1]) {
        const g = new T.BufferGeometry().setFromPoints([new T.Vector3(x, -Math.sqrt(DISC_R * DISC_R - 1) + 0.05, 0.1), new T.Vector3(x, -DISC_R - 0.17, 0.1)]);
        const l = new T.Line(g, chainMat); l.computeLineDistances(); bob.add(l);
      }
    }
    function setRings(n) {
      if (n === ringN) return;
      ringN = n;
      wood.drawRings(ringCv, { seed: 4, rings: 26, locks: n });
      ringTex.needsUpdate = true;
      plankText = `${n}|ring${n === 1 ? "" : "s"}.|one per lock.`;
      plankTex.repaint();
    }

    // =============== the ledger log + lantern ===============
    const ledG = new T.Group(); ledG.name = "ledger-log";
    W.addToBeat("log", ledG);
    {
      const bark = wood.barkTexture(T, { w: small ? 256 : 512, h: small ? 256 : 512, seed: 31 });
      bark.repeat.set(3, 5);
      const endTex = wood.ringTexture(T, { size: small ? 512 : 1024, seed: 8, rings: 46 });
      const endMat = new T.MeshStandardMaterial({ map: endTex, roughness: 0.85, emissive: 0x2a1a0c, emissiveMap: endTex, emissiveIntensity: 0.3 });
      const barkM = new T.MeshStandardMaterial({ map: bark, roughness: 0.95 });
      const log = new T.Mesh(new T.CylinderGeometry(1.45, 1.55, 15, small ? 24 : 44, 1, false).rotateZ(Math.PI / 2), [barkM, endMat, endMat]);
      log.position.set(LEDGER.x, 1.3, LEDGER.z);
      log.rotation.x = 0.4;
      ledG.add(log);
      const moss = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial({ color: 0x3f5a22, roughness: 1 }));
      for (const [x, s] of [[-2.5, 0.6], [1.0, 0.45], [5.2, 0.5]]) { const m = moss.clone(); m.scale.set(s, 0.14, s * 0.7); m.position.set(LEDGER.x + x, 2.8, LEDGER.z + 0.2); ledG.add(m); }
    }
    const LANT = new T.Vector3(LEDGER.x + 2.6, 2.84, LEDGER.z + 0.25);
    const flame = new T.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa040, emissiveIntensity: 2, transparent: true, opacity: 0.9 });
    const lantern = new T.PointLight(0xffa04a, small ? 10 : 16, 14, 1.6);
    {
      const iron = new T.MeshStandardMaterial({ color: 0x2c2a24, roughness: 0.6, metalness: 0.5 });
      const g = new T.Group(); g.position.copy(LANT);
      const base = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.05, 12), iron); base.position.y = 0.025; g.add(base);
      const glass = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.26, 12), flame); glass.position.y = 0.18; g.add(glass);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; const p = new T.Mesh(new T.BoxGeometry(0.02, 0.3, 0.02), iron); p.position.set(Math.cos(a) * 0.13, 0.18, Math.sin(a) * 0.13); g.add(p); }
      const roof = new T.Mesh(new T.ConeGeometry(0.17, 0.13, 12), iron); roof.position.y = 0.38; g.add(roof);
      const ring = new T.Mesh(new T.TorusGeometry(0.06, 0.012, 6, 16), iron); ring.position.y = 0.48; g.add(ring);
      ledG.add(g);
      lantern.position.set(LANT.x, LANT.y + 0.25, LANT.z + 0.1);
      ledG.add(lantern);
    }

    // =============== per frame ===============
    let t = 0;
    W.onFrame((dt) => {
      if (document.hidden) return;
      dt = Math.min(dt, 0.05);
      t += dt;
      // the pile
      // the tag belongs to the pile: drop it once the camera has moved on
      if (tagFor && !near(PILE, 22)) hideTag();
      if (!culled(pileG) && near(PILE, 60)) {
        if (!dropped && logs.length && (window.FLOG_SCROLL?.beat === "pile" || near(PILE, 16))) startDrop();
        let dirty = false;
        for (const lg of logs) {
          if (lg.ph === "fall") {
            dirty = true;
            if (lg.delay > 0) { lg.delay -= dt; if (lg.delay <= 0) place(lg, false); continue; }
            lg.vy -= 13 * dt; lg.y += lg.vy * dt;
            if (lg.y <= lg.ty) {
              lg.y = lg.ty;
              if (lg.vy < -1.4) {
                if (lg.loud && audioOn()) { try { knock(1, 0.5 + Math.random() * 0.25); } catch {} lg.loud = false; }
                lg.vy = -lg.vy * 0.28;
              } else { lg.vy = 0; lg.ph = "rest"; }
            }
            place(lg, false);
          } else if (lg.ph === "hop") {
            dirty = true;
            lg.hop += dt;
            if (lg.hop >= 0.42) { lg.ph = "rest"; lg.hop = -1; }
            place(lg, false);
          }
        }
        if (ghostG.visible) ghostG.userData.mat.opacity = 0.42 + Math.sin(t * 1.3) * 0.14;
        if (dirty) logs.forEach((lg) => { if (lg.ph !== "wait") lg.px.position.y = lg.y; });
      }
      // the rings: slow spin + bob in the fog
      if (!culled(ringG) && near(RINGS, 70)) {
        disc.rotation.z += dt * 0.035;
        bob.position.y = RINGS.y + Math.sin(t * 0.6) * 0.12;
        bob.rotation.x = Math.sin(t * 0.4) * 0.03;
        bob.rotation.y = Math.sin(t * 0.27) * 0.05;
      }
      // the lantern flickers
      if (!culled(ledG) && near(LEDGER, 60)) {
        const f = 0.84 + 0.1 * Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1) + 0.06 * Math.sin(t * 23.7 + 2) + (Math.random() - 0.5) * 0.04;
        lantern.intensity = (small ? 10 : 16) * f;
        flame.emissiveIntensity = 1.6 + f;
      }
    });

    api = { sync };
    sync();
  }

  return { set };
})();
