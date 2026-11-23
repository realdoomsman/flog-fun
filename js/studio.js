// "put flog anywhere": sticker studio. background = uploaded photo or a sighting,
// stickers = flog cutouts (media.cutouts), drag / corner handle / pinch to move, size, spin.
// looks: clean, found photo (crunch + orange date stamp), VHS (chroma, scanlines, OSD). all in-browser.

function initStudio(media) {
  const cv = $("#st-canvas"), ctx = cv.getContext("2d", { willReadFrequently: true });
  const wrap = $("#st-wrap");
  const S = { bg: null, stickers: [], sel: -1, filter: "found", shadow: true };
  const cutouts = media.cutouts.length ? media.cutouts : [{ id: "00_standing", file: "img/flog-standing.png", label: "standing" }];
  const imgCache = new Map();
  const getImg = (src) => {
    if (!imgCache.has(src)) imgCache.set(src, loadImg(src));
    return imgCache.get(src);
  };

  // ---------- geometry (stickers are stored in canvas-relative units) ----------
  const W = () => cv.width, H = () => cv.height;
  function box(st) {
    const h = st.s * H(), w = h * (st.img.width / st.img.height);
    return { cx: st.x * W(), cy: st.y * H(), w, h };
  }
  function toLocal(st, px, py) {
    const b = box(st), dx = px - b.cx, dy = py - b.cy, c = Math.cos(-st.rot), s = Math.sin(-st.rot);
    return { x: dx * c - dy * s, y: dx * s + dy * c, b };
  }
  function handlePos(st) {
    const b = box(st), c = Math.cos(st.rot), s = Math.sin(st.rot), hx = b.w / 2, hy = b.h / 2;
    return { x: b.cx + hx * c - hy * s, y: b.cy + hx * s + hy * c };
  }
  const pxScale = () => cv.width / cv.getBoundingClientRect().width; // canvas px per css px

  // ---------- drawing ----------
  function drawSticker(c, st) {
    const b = box(st);
    c.save();
    c.translate(b.cx, b.cy);
    c.rotate(st.rot);
    if (S.shadow) {
      // soft contact shadow under the feet
      c.save();
      c.translate(0, b.h / 2 - b.h * 0.015);
      c.scale(1, 0.16);
      const r = b.w * 0.5, g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(0.6, "rgba(0,0,0,.18)"); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.scale(st.flip, 1);
    c.drawImage(st.img, -b.w / 2, -b.h / 2, b.w, b.h);
    c.restore();
  }
  function compose(c) {
    c.fillStyle = "#1a2419";
    c.fillRect(0, 0, W(), H());
    if (S.bg) c.drawImage(S.bg, 0, 0, W(), H());
    S.stickers.forEach((st) => drawSticker(c, st));
  }
  function grain(d, amt) {
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  function foundLook(crunched) {
    const w = W(), h = H();
    if (crunched) ctx.drawImage(crunched, 0, 0, w, h);
    else {
      // fast softness while dragging: down + up sample
      const t = document.createElement("canvas");
      t.width = Math.round(w * 0.55); t.height = Math.round(h * 0.55);
      t.getContext("2d").drawImage(cv, 0, 0, t.width, t.height);
      ctx.drawImage(t, 0, 0, w, h);
    }
    const im = ctx.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      // warm, lifted blacks, slightly hot highlights: cheap digicam
      d[i] = 14 + d[i] * 1.02 + 6;
      d[i + 1] = 10 + d[i + 1] * 0.97;
      d[i + 2] = 12 + d[i + 2] * 0.84;
    }
    grain(d, 26);
    ctx.putImageData(im, 0, 0);
    // flash hotspot + vignette
    let g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.5);
    g.addColorStop(0, "rgba(255,250,235,.10)"); g.addColorStop(1, "rgba(255,250,235,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    drawStamp(ctx, w, h, ($("#st-stamp").value.trim() || digicamDate()).slice(0, 24));
  }
  function vhsLook() {
    const w = W(), h = H();
    const src = ctx.getImageData(0, 0, w, h), s = src.data;
    const out = ctx.createImageData(w, h), d = out.data;
    const sh = Math.max(2, Math.round(w / 300));
    const band = h * (0.72 + Math.random() * 0.12), bandH = h * 0.035;
    for (let y = 0; y < h; y++) {
      const inBand = y > band && y < band + bandH;
      const jit = inBand ? Math.round((Math.random() - 0.3) * w * 0.02) : 0;
      const dark = y % 3 === 0 ? 0.82 : 1;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const xr = Math.min(w - 1, Math.max(0, x + sh + jit)), xb = Math.min(w - 1, Math.max(0, x - sh + jit)), xg = Math.min(w - 1, Math.max(0, x + jit));
        let r = s[(y * w + xr) * 4], g = s[(y * w + xg) * 4 + 1], b = s[(y * w + xb) * 4 + 2];
        const l = 0.3 * r + 0.59 * g + 0.11 * b;
        r = l + (r - l) * 0.78; g = l + (g - l) * 0.78; b = l + (b - l) * 0.78; // tired tape colour
        const n = (Math.random() - 0.5) * (inBand ? 90 : 22);
        d[i] = (r * 1.04 + 6 + n) * dark; d[i + 1] = (g + 4 + n) * dark; d[i + 2] = (b * 1.06 + 10 + n) * dark; d[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    // OSD
    const f = Math.round(Math.min(w, h) * 0.065), m = f * 0.7;
    ctx.save();
    ctx.font = `${f}px VT323, monospace`;
    ctx.fillStyle = "#f4f4ee"; ctx.shadowColor = "rgba(0,0,0,.85)"; ctx.shadowOffsetX = f * 0.06; ctx.shadowOffsetY = f * 0.06;
    ctx.textBaseline = "top"; ctx.textAlign = "left";
    ctx.fillText("PLAY", m, m);
    const tw = ctx.measureText("PLAY ").width;
    ctx.beginPath(); ctx.moveTo(m + tw, m + f * 0.18); ctx.lineTo(m + tw + f * 0.5, m + f * 0.45); ctx.lineTo(m + tw, m + f * 0.72); ctx.closePath(); ctx.fill();
    ctx.textAlign = "right"; ctx.fillText("SP", w - m, m);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const d0 = new Date(), hr = d0.getHours();
    ctx.fillText(`${hr < 12 ? "AM" : "PM"} ${(hr % 12) || 12}:${String(d0.getMinutes()).padStart(2, "0")}`, m, h - m - f);
    ctx.fillText($("#st-stamp").value.trim().slice(0, 24) || `${MON[d0.getMonth()]}. ${String(d0.getDate()).padStart(2, "0")} ${d0.getFullYear()}`, m, h - m);
    ctx.restore();
  }
  function drawSelection() {
    const st = S.stickers[S.sel];
    if (!st) return;
    const b = box(st), k = pxScale();
    ctx.save();
    ctx.translate(b.cx, b.cy); ctx.rotate(st.rot);
    ctx.lineWidth = 2 * k;
    ctx.setLineDash([8 * k, 6 * k]);
    ctx.strokeStyle = "#000"; ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.lineDashOffset = 8 * k; ctx.strokeStyle = "#fff"; ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
    const p = handlePos(st), r = 13 * k;
    ctx.save();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#63d63a"; ctx.fill(); ctx.lineWidth = 3 * k; ctx.strokeStyle = "#0c1a07"; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, -2.2, 1.2); ctx.lineWidth = 2.2 * k; ctx.stroke();
    ctx.restore();
  }

  let crunched = null, crunchKey = "", settleT = 0, raf = 0;
  const stateKey = () => JSON.stringify([S.filter, S.shadow, W(), H(), S.bg?.src, S.stickers.map((s) => [s.x, s.y, s.s, s.rot, s.flip, s.img.src])]);
  function paint(withSel = true) {
    compose(ctx);
    if (S.filter === "found") foundLook(crunched && crunchKey === stateKey() ? crunched : null);
    else if (S.filter === "vhs") vhsLook();
    if (withSel) drawSelection();
  }
  // real JPEG crunch: re-encode a smaller copy at low quality, then scale it back up
  async function crunch() {
    const key = stateKey();
    const t = document.createElement("canvas");
    t.width = Math.round(W() * 0.6); t.height = Math.round(H() * 0.6);
    const tc = t.getContext("2d");
    compose(ctx);
    tc.drawImage(cv, 0, 0, t.width, t.height);
    try {
      const im = await loadImg(t.toDataURL("image/jpeg", 0.32));
      crunched = im; crunchKey = key;
    } catch { crunched = null; }
  }
  function render() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => paint());
    clearTimeout(settleT);
    if (S.filter === "found") settleT = setTimeout(async () => { if (crunchKey !== stateKey()) { await crunch(); paint(); } }, 180);
    syncPanel();
  }

  // ---------- panel ----------
  function syncPanel() {
    const st = S.stickers[S.sel];
    $("#st-sel").classList.toggle("off", !st);
    $$("#st-sel button, #st-sel input[type=range]").forEach((el) => (el.disabled = !st));
    if (st) {
      $("#st-size").value = Math.round(st.s * 100);
      $("#st-rot").value = Math.round((st.rot * 180) / Math.PI);
    }
  }
  function addSticker(img, opts = {}) {
    S.stickers.push({ img, x: 0.5, y: 0.56, s: 0.42, rot: 0, flip: 1, ...opts });
    S.sel = S.stickers.length - 1;
    knock(1, 1.2);
    render();
  }
  async function setBg(src, isUpload) {
    const im = await loadImg(src);
    const max = isUpload ? 1440 : 1080, k = Math.min(1, max / Math.max(im.width, im.height));
    const w = isUpload ? Math.round(im.width * k) : 1080, h = isUpload ? Math.round(im.height * k) : 1080;
    S.bg = im;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    crunched = null;
    render();
  }

  // background picker: upload + sightings
  const bgs = $("#st-bgs");
  media.sightings.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "st-bg";
    b.title = s.place;
    b.innerHTML = `<img loading="lazy" src="${esc(s.clean || s.file)}" alt="${esc(s.place)}" width="90" height="90">`;
    b.querySelector("img").onerror = function () { if (this.src.indexOf(s.file) < 0) this.src = s.file; };
    b.addEventListener("click", () => {
      $$(".st-bg", bgs).forEach((x) => x.classList.toggle("on", x === b));
      setBg(b.querySelector("img").src);
    });
    bgs.appendChild(b);
  });
  const fileIn = $("#st-file");
  const takeFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    $$(".st-bg", bgs).forEach((x) => x.classList.remove("on"));
    setBg(URL.createObjectURL(f), true);
  };
  fileIn.addEventListener("change", (e) => takeFile(e.target.files[0]));
  [wrap, $("#st-drop")].forEach((el) => {
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("over"); takeFile(e.dataTransfer.files[0]); });
  });

  // cutouts
  const cuts = $("#st-cutouts");
  cutouts.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "st-cut";
    b.title = `add flog (${c.label})`;
    b.innerHTML = `<img loading="lazy" src="${esc(c.file)}" alt="${esc(c.label)}"><span>+ ${esc(c.label)}</span>`;
    b.addEventListener("click", async () => addSticker(await getImg(c.file)));
    cuts.appendChild(b);
  });

  // selected sticker controls
  const sel = () => S.stickers[S.sel];
  $("#st-size").addEventListener("input", (e) => { if (sel()) { sel().s = e.target.value / 100; render(); } });
  $("#st-rot").addEventListener("input", (e) => { if (sel()) { sel().rot = (e.target.value * Math.PI) / 180; render(); } });
  $("#st-flip").addEventListener("click", () => { if (sel()) { sel().flip *= -1; render(); } });
  $("#st-front").addEventListener("click", () => {
    if (!sel()) return;
    S.stickers.push(S.stickers.splice(S.sel, 1)[0]);
    S.sel = S.stickers.length - 1;
    render();
  });
  $("#st-dup").addEventListener("click", () => { if (sel()) addSticker(sel().img, { ...sel(), x: Math.min(0.92, sel().x + 0.08), y: Math.min(0.92, sel().y + 0.03) }); });
  const del = () => { if (!sel()) return; S.stickers.splice(S.sel, 1); S.sel = S.stickers.length - 1; render(); };
  $("#st-del").addEventListener("click", del);
  $("#st-shadow").addEventListener("change", (e) => { S.shadow = e.target.checked; render(); });
  $$("#st-filter button").forEach((b) => b.addEventListener("click", () => {
    S.filter = b.dataset.f;
    $$("#st-filter button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
    render();
  }));
  $("#st-stamp").addEventListener("input", render);
  $("#st-stamp").placeholder = digicamDate();

  // ---------- pointer: drag, handle (size + spin), pinch ----------
  const pts = new Map();
  let mode = null, g0 = null;
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; };
  function pinchInfo() {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    const p = at(e);
    pts.set(e.pointerId, p);
    if (pts.size === 2 && sel()) {
      const st = sel(), i = pinchInfo();
      mode = "pinch"; g0 = { d: i.d, a: i.a, mx: i.x, my: i.y, s: st.s, rot: st.rot, sx: st.x, sy: st.y };
      return;
    }
    const st = sel();
    if (st) {
      const hp = handlePos(st);
      if (Math.hypot(p.x - hp.x, p.y - hp.y) < 22 * pxScale()) {
        const b = box(st);
        mode = "handle"; g0 = { d: Math.hypot(p.x - b.cx, p.y - b.cy), a: Math.atan2(p.y - b.cy, p.x - b.cx), s: st.s, rot: st.rot };
        return;
      }
    }
    for (let i = S.stickers.length - 1; i >= 0; i--) {
      const l = toLocal(S.stickers[i], p.x, p.y);
      if (Math.abs(l.x) <= l.b.w / 2 && Math.abs(l.y) <= l.b.h / 2) {
        S.sel = i;
        mode = "drag"; g0 = { dx: p.x - l.b.cx, dy: p.y - l.b.cy };
        render();
        return;
      }
    }
    S.sel = -1; mode = null; render();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) {
      // hover cursor
      const p = at(e), st = sel();
      const onHandle = st && Math.hypot(p.x - handlePos(st).x, p.y - handlePos(st).y) < 22 * pxScale();
      const onSticker = S.stickers.some((s) => { const l = toLocal(s, p.x, p.y); return Math.abs(l.x) <= l.b.w / 2 && Math.abs(l.y) <= l.b.h / 2; });
      cv.style.cursor = onHandle ? "nwse-resize" : onSticker ? "grab" : "default";
      return;
    }
    const p = at(e);
    pts.set(e.pointerId, p);
    const st = sel();
    if (!st || !mode) return;
    if (mode === "drag") { st.x = (p.x - g0.dx) / W(); st.y = (p.y - g0.dy) / H(); }
    else if (mode === "handle") {
      const b = box(st);
      st.s = Math.max(0.05, Math.min(2, g0.s * (Math.hypot(p.x - b.cx, p.y - b.cy) / g0.d)));
      st.rot = g0.rot + (Math.atan2(p.y - b.cy, p.x - b.cx) - g0.a);
    } else if (mode === "pinch" && pts.size >= 2) {
      const i = pinchInfo();
      st.s = Math.max(0.05, Math.min(2, (g0.s * i.d) / g0.d));
      st.rot = g0.rot + (i.a - g0.a);
      st.x = g0.sx + (i.x - g0.mx) / W();
      st.y = g0.sy + (i.y - g0.my) / H();
    }
    render();
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2 && mode === "pinch") mode = null;
    if (!pts.size) mode = null;
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  // keyboard: arrows nudge, delete removes, f flips
  cv.tabIndex = 0;
  cv.addEventListener("keydown", (e) => {
    const st = sel();
    if (!st) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (k) { st.x += k[0]; st.y += k[1]; e.preventDefault(); render(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); del(); }
    else if (e.key === "f") { st.flip *= -1; render(); }
  });

  $("#st-dl").addEventListener("click", async () => {
    knock(1);
    clearTimeout(settleT);
    if (S.filter === "found" && crunchKey !== stateKey()) await crunch();
    paint(false);
    await downloadCanvas(cv, `flog-was-here-${Date.now()}.png`);
    paint(true);
  });

  // starting scene: the empty apartment, one flog standing in it
  (async () => {
    const start = media.sightings.find((s) => s.id === "14_empty_room") || media.sightings[0];
    const btn = start && $$(".st-bg", bgs)[media.sightings.indexOf(start)];
    btn?.classList.add("on");
    await document.fonts.ready;
    if (start) await setBg(start.clean || start.file).catch(() => setBg(start.file));
    const first = await getImg(cutouts[0].file).catch(() => null);
    if (first) { S.stickers.push({ img: first, x: 0.3, y: 0.6, s: 0.5, rot: -0.06, flip: -1 }); S.sel = 0; }
    render();
  })();

  // exposed for the browser check only
  return S;
}
