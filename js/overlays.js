// full-screen overlays: the found-photo pile, the tape shelf + tv, the meme wall, and the slide projector
// (the one picture viewer for the whole site). they open from the HUD (#hud-photos #hud-tapes #hud-memes),
// from anything with data-overlay="photos|tapes|memes", and from 3D objects through the public functions.
// public: openPhotos(), openTapes(), openMemes(), openProjector(items, index), closeOverlay()
// events: window "flog:overlay" (detail {open: kind | null}) whenever an overlay opens or the last one closes.

const _ov = (() => {
  const html = document.documentElement;
  const calm = () => REDUCED || html.classList.contains("static");
  const pad2 = (n) => String(n).padStart(2, "0");
  // fnv-1a + a murmur finaliser, so "idx" and "idy" don't land on the same diagonal
  const hash = (s) => {
    let h = 2166136261;
    for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  };
  const SMALL = matchMedia("(max-width: 760px)");
  const onMQ = (mq, fn) => (mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn));
  const clack = (p = 2) => { try { knock(1, p); } catch {} };

  // ---- media: app.js sets window.FLOG_MEDIA and fires "flog:media" ----
  let mediaP = null;
  function media() {
    if (window.FLOG_MEDIA) return Promise.resolve(window.FLOG_MEDIA);
    return (mediaP = mediaP || new Promise((res) => {
      addEventListener("flog:media", (e) => res(e.detail || window.FLOG_MEDIA), { once: true });
      // nobody announced it: read the file ourselves
      setTimeout(() => {
        if (window.FLOG_MEDIA) return res(window.FLOG_MEDIA);
        fetch("data/media.json").then((r) => (r.ok ? r.json() : null)).then((m) => m && res(m)).catch(() => {});
      }, 2500);
    }));
  }

  // ---- layers: open/close, scroll lock, focus trap, focus restore ----
  const open = [];
  let saved = null;
  function lock(on) {
    const b = document.body;
    if (on && !saved) {
      const sb = innerWidth - html.clientWidth;
      saved = { o: b.style.overflow, p: b.style.paddingRight };
      b.style.overflow = "hidden";
      if (sb > 0) b.style.paddingRight = `${sb}px`;
      html.classList.add("ov-open");
    } else if (!on && saved) {
      b.style.overflow = saved.o;
      b.style.paddingRight = saved.p;
      saved = null;
      html.classList.remove("ov-open");
    }
  }
  function layer(kind, title, main) {
    const el = document.createElement("div");
    el.className = `ov ov-${kind}`;
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", title);
    el.innerHTML = (main ? `<div class="ov-osd" aria-hidden="true"><span class="ov-play">play</span><span class="ov-title">${esc(title)}</span><span class="ov-date"></span></div>` : "")
      + `<div class="ov-body"></div><button class="ov-close" type="button" aria-label="close ${esc(title)}">close <b aria-hidden="true">×</b></button>`;
    document.body.appendChild(el);
    const L = { kind, el, main, body: $(".ov-body", el), from: null, t: 0 };
    $(".ov-close", el).addEventListener("click", () => hide(L));
    return L;
  }
  function show(L) {
    if (open.includes(L)) return;
    let from = document.activeElement;
    if (L.main) {
      const cur = open.find((l) => l.main);
      if (cur) { from = cur.from; hide(cur, true); }
    }
    L.from = from;
    open.push(L);
    clearTimeout(L.t);
    L.el.hidden = false;
    L.el.classList.toggle("calm", calm());
    const date = $(".ov-date", L.el);
    if (date) date.textContent = digicamDate();
    lock(true);
    void L.el.offsetWidth;
    L.el.classList.add("on");
    L.onOpen?.();
    ((L.focus && L.focus()) || $(".ov-close", L.el)).focus({ preventScroll: true });
    dispatchEvent(new CustomEvent("flog:overlay", { detail: { open: L.kind } }));
  }
  function hide(L, quiet) {
    const i = open.indexOf(L);
    if (i < 0) return;
    open.splice(i, 1);
    L.el.classList.remove("on");
    L.t = setTimeout(() => { L.el.hidden = true; }, calm() ? 0 : 260);
    L.onClose?.();
    if (!open.length) lock(false);
    if (!quiet) {
      // the opener may have been hidden meanwhile (the HUD panel closes on click): fall back to the menu button
      const back = [L.from, $("#hud-menu")].find((el) => el && el.isConnected && el.focus && el.getClientRects().length);
      if (back) back.focus({ preventScroll: true });
    }
    if (!open.length) dispatchEvent(new CustomEvent("flog:overlay", { detail: { open: null } }));
  }
  function trap(el, e) {
    const f = $$('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])', el)
      .filter((x) => !x.hidden && x.getClientRects().length && !x.closest("[aria-hidden='true']"));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!el.contains(a)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener("keydown", (e) => {
    const top = open[open.length - 1];
    if (!top) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); hide(top); return; }
    if (e.key === "Tab") { trap(top.el, e); return; }
    top.onKey?.(e);
  }, true);

  // ---- a stack of cards you flick off left/right (photos + memes on phones) ----
  function makeStack(host, n, make, onPick, ratio) {
    host.innerHTML = `<div class="stk-deck"></div>
      <div class="stk-bar"><button class="stk-btn stk-prev" type="button" aria-label="previous">‹ back</button><span class="stk-count" aria-live="polite"></span><button class="stk-btn stk-next" type="button" aria-label="next">next ›</button></div>
      <p class="stk-hint">flick it. tap to look closer.</p>`;
    const deck = $(".stk-deck", host), count = $(".stk-count", host);
    deck.style.setProperty("--ar", ratio);
    const live = new Map();
    let idx = 0, g = null, dragged = false;
    const tilt = (i) => (hash(`stk${i}`) - 0.5) * 9;
    function place(el, d, i) {
      el.style.zIndex = 10 - d;
      el.style.transform = `translate3d(${d * 4}px, ${d * 12}px, 0) scale(${1 - d * 0.045}) rotate(${tilt(i)}deg)`;
      el.classList.toggle("top", d === 0);
      el.tabIndex = d === 0 ? 0 : -1;
      el.setAttribute("aria-hidden", d === 0 ? "false" : "true");
    }
    function paint(enter) {
      const want = [];
      for (let d = 0; d < Math.min(3, n); d++) want.push((idx + d) % n);
      live.forEach((el, i) => { if (!want.includes(i)) { el.remove(); live.delete(i); } });
      want.forEach((i, d) => {
        let el = live.get(i);
        if (!el) {
          el = make(i);
          el.classList.add("stk-card");
          live.set(i, el);
          deck.prepend(el);
          if (enter && d === 0 && !calm()) {
            el.style.transition = "none";
            el.style.transform = `translate3d(${enter * 140}%, -20px, 0) rotate(${enter * 24}deg)`;
            void el.offsetWidth;
            el.style.transition = "";
          }
        }
        place(el, d, i);
      });
      count.textContent = `${idx + 1} / ${n}`;
    }
    function fling(dir) {
      const el = live.get(idx);
      if (!el) return;
      const hadFocus = deck.contains(document.activeElement);
      live.delete(idx);
      el.classList.remove("top");
      el.classList.add("gone");
      el.tabIndex = -1;
      el.style.zIndex = 20;
      if (calm()) el.remove();
      else {
        el.style.transform = `translate3d(${dir * 150}%, 40px, 0) rotate(${dir * 30}deg)`;
        setTimeout(() => el.remove(), 450);
      }
      idx = (idx + 1) % n;
      paint(0);
      if (hadFocus) live.get(idx)?.focus({ preventScroll: true });
    }
    function back() {
      idx = (idx - 1 + n) % n;
      paint(-1);
    }
    deck.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(".stk-card.top");
      if (!el || g || (e.pointerType === "mouse" && e.button !== 0)) return;
      g = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, dy: 0, on: false, i: idx };
      dragged = false;
    });
    deck.addEventListener("pointermove", (e) => {
      if (!g || e.pointerId !== g.id) return;
      g.dx = e.clientX - g.x0;
      g.dy = e.clientY - g.y0;
      if (!g.on && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy)) {
        g.on = dragged = true;
        g.el.classList.add("held");
        try { g.el.setPointerCapture(g.id); } catch {}
      }
      if (g.on) g.el.style.transform = `translate3d(${g.dx}px, ${g.dy * 0.25}px, 0) rotate(${tilt(g.i) + g.dx * 0.06}deg)`;
    });
    const up = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const s = g;
      g = null;
      if (!s.on) return;
      s.el.classList.remove("held");
      const v = s.dx / Math.max(1, performance.now() - s.t0);
      if (Math.abs(s.dx) > deck.clientWidth * 0.28 || Math.abs(v) > 0.55) fling(Math.sign(s.dx) || 1);
      else place(s.el, 0, s.i);
    };
    deck.addEventListener("pointerup", up);
    deck.addEventListener("pointercancel", up);
    deck.addEventListener("click", (e) => {
      if (!e.target.closest(".stk-card.top")) return;
      if (dragged) { dragged = false; return; }
      onPick(idx);
    });
    $(".stk-prev", host).addEventListener("click", back);
    $(".stk-next", host).addEventListener("click", () => fling(idx % 2 ? -1 : 1));
    paint(0);
    return {
      key(e) {
        if (e.key === "ArrowRight") { e.preventDefault(); fling(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      },
    };
  }

  // =====================================================================================
  // photos: printed sightings on a dark table under a lamp
  // =====================================================================================
  let P = null;
  function photos() {
    if (P) return P;
    const L = layer("photos", "found photos", true);
    L.body.innerHTML = `<div class="ph-table">
        <div class="ph-decor" aria-hidden="true"><i class="ph-ring"></i><i class="ph-mug"></i><i class="ph-pencil"></i><i class="ph-pencil p2"></i></div>
        <div class="ph-prints"></div>
        <div class="ph-stack stk"></div>
        <i class="ph-loupe" aria-hidden="true"></i>
      </div>`;
    const tools = document.createElement("div");
    tools.className = "ph-tools";
    tools.innerHTML = `<button class="tag-btn ph-tidy" type="button" aria-pressed="false">tidy up</button><button class="tag-btn ph-deal" type="button"></button><span class="ph-count" aria-live="polite"></span>`;
    L.el.appendChild(tools);
    const table = $(".ph-table", L.body), layerEl = $(".ph-prints", L.body), stackHost = $(".ph-stack", L.body);
    const tidyB = $(".ph-tidy", tools), dealB = $(".ph-deal", tools), countEl = $(".ph-count", tools);
    const BATCH = 12;
    let list = [], items = [], prints = [], dealt = 0, tidy = false, mode = "", z = 10, W = 0, H = 0, stack = null;
    let drag = null, dragged = false;

    const make = (s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "print";
      b.dataset.i = i;
      b.setAttribute("aria-label", `photo: ${s.place || "somewhere"}${s.time ? `, ${s.time}` : ""}. open in the projector`);
      b.innerHTML = `<img src="${esc(s.file)}" alt="" width="720" height="720" loading="lazy" decoding="async" draggable="false"><span class="print-cap"><b>${esc(s.place || "")}${s.time ? ` · ${esc(s.time)}` : ""}</b><span>${esc(s.note || "")}</span></span>`;
      return b;
    };
    const project = (i) => openProjector(items, i);

    function setData(sightings) {
      const next = (sightings || []).filter((s) => s && s.file);
      if (next.length === list.length && next.every((s, i) => s.id === list[i].id)) return;
      list = next;
      items = list.map((s) => ({ src: s.file, cap: [s.place, s.time, s.note].filter(Boolean).join(". "), name: `flog-sighting-${s.id || "photo"}.jpg` }));
      mode = "";
      setMode();
    }
    function setMode() {
      if (!list.length) return;
      const m = SMALL.matches ? "stack" : "spread";
      if (m === mode) return;
      mode = m;
      L.el.dataset.mode = m;
      prints.forEach((p) => p.el.remove());
      prints = [];
      dealt = 0;
      stack = null;
      stackHost.innerHTML = "";
      table.style.height = "";
      if (m === "stack") stack = makeStack(stackHost, list.length, (i) => make(list[i], i), project, "340 / 392");
      else { measure(); deal(BATCH); }
    }

    // ---- spread: drag prints around the table ----
    function measure() {
      W = layerEl.clientWidth;
      H = layerEl.clientHeight;
      prints.forEach((p) => { p.w = p.el.offsetWidth; p.h = p.el.offsetHeight; });
    }
    function spot(p) {
      if (p.free) return [Math.min(p.free[0], Math.max(0, W - p.w)), Math.min(p.free[1], Math.max(0, H - p.h))];
      if (!tidy) return [p.fx * Math.max(0, W - p.w), p.fy * Math.max(0, H - p.h)];
      const gap = 22, cols = Math.max(1, Math.floor((W + gap) / (p.w + gap)));
      const k = prints.indexOf(p), row = Math.floor(k / cols), col = k % cols;
      const left = (W - (cols * (p.w + gap) - gap)) / 2;
      return [left + col * (p.w + gap), row * (p.h + gap)];
    }
    function put(p) {
      const [x, y] = spot(p);
      p.x = x; p.y = y;
      p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(tidy && !p.free ? p.r * 0.12 : p.r).toFixed(2)}deg)`;
    }
    function layout() {
      if (mode !== "spread") return;
      table.style.height = "";
      measure();
      if (tidy && prints.length) {
        const p = prints[0], gap = 22, cols = Math.max(1, Math.floor((W + gap) / (p.w + gap)));
        const need = Math.ceil(prints.length / cols) * (p.h + gap);
        if (need > H) { table.style.height = `${table.clientHeight + need - H}px`; measure(); }
      }
      prints.forEach(put);
    }
    function deal(n) {
      if (!list.length) return;
      if (dealt >= list.length) {
        // sweep the desk and start over
        prints.forEach((p) => p.el.remove());
        prints = [];
        dealt = 0;
      }
      const fresh = [], still = calm(), w0 = W || layerEl.clientWidth;
      list.slice(dealt, dealt + n).forEach((s, k) => {
        const i = dealt + k, el = make(s, i);
        el.style.zIndex = ++z;
        const p = { el, i, fx: 0.04 + hash(`${s.id}x`) * 0.92, fy: 0.03 + hash(`${s.id}y`) * 0.94, r: (hash(`${s.id}r`) - 0.5) * 26, free: null, w: 0, h: 0, x: 0, y: 0 };
        if (!still) {
          // start off the table edge; the transition is switched on after this style is committed
          el.style.transition = "none";
          el.style.transform = `translate3d(${w0 + 120}px, ${-260 - k * 10}px, 0) rotate(${p.r + 40}deg)`;
        }
        prints.push(p);
        fresh.push(p);
        layerEl.appendChild(el);
      });
      dealt += fresh.length;
      measure();
      if (!still) {
        fresh.forEach((p, k) => {
          p.el.style.transition = "";
          p.el.style.setProperty("--dl", `${k * 55}ms`);
          p.el.classList.add("dealing");
        });
        setTimeout(() => fresh.forEach((p) => p.el.classList.remove("dealing")), 900 + fresh.length * 55);
      }
      layout();
      status();
    }
    function status() {
      const left = list.length - dealt;
      dealB.textContent = left > 0 ? `deal ${Math.min(BATCH, left)} more` : "sweep the desk";
      countEl.textContent = `${dealt} of ${list.length} on the desk`;
    }
    tidyB.addEventListener("click", () => {
      tidy = !tidy;
      prints.forEach((p) => { p.free = null; });
      tidyB.textContent = tidy ? "mess it up" : "tidy up";
      tidyB.setAttribute("aria-pressed", tidy);
      layout();
    });
    dealB.addEventListener("click", () => { deal(BATCH); clack(1.4); });

    const local = (e) => { const r = layerEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    layerEl.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(".print");
      if (!el || drag || e.button !== 0) return;
      const p = prints.find((q) => q.el === el);
      if (!p) return;
      const [mx, my] = local(e);
      drag = { p, id: e.pointerId, ox: mx - p.x, oy: my - p.y, x0: e.clientX, y0: e.clientY, on: false, lean: 0 };
      dragged = false;
    });
    layerEl.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = drag.p;
      if (!drag.on) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
        drag.on = dragged = true;
        try { p.el.setPointerCapture(drag.id); } catch {}
        p.el.classList.add("held");
        p.el.style.zIndex = ++z;
      }
      const [mx, my] = local(e);
      const x = Math.max(0, Math.min(W - p.w, mx - drag.ox)), y = Math.max(0, Math.min(H - p.h, my - drag.oy));
      if (!calm()) drag.lean = drag.lean * 0.8 + Math.max(-7, Math.min(7, (x - p.x) * 0.5)) * 0.2;
      p.x = x; p.y = y;
      p.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(p.r + drag.lean).toFixed(2)}deg) scale(1.04)`;
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { p, on } = drag;
      drag = null;
      if (!on) return;
      p.el.classList.remove("held");
      if (tidy) p.free = [p.x, p.y];
      else { p.fx = W > p.w ? p.x / (W - p.w) : 0; p.fy = H > p.h ? p.y / (H - p.h) : 0; }
      put(p);
    };
    layerEl.addEventListener("pointerup", up);
    layerEl.addEventListener("pointercancel", up);
    layerEl.addEventListener("click", (e) => {
      const el = e.target.closest(".print");
      if (!el) return;
      if (dragged) { dragged = false; return; }
      project(+el.dataset.i);
    });
    layerEl.addEventListener("dragstart", (e) => e.preventDefault());

    if ("ResizeObserver" in window) new ResizeObserver(() => { if (!L.el.hidden && mode === "spread" && !drag) layout(); }).observe(layerEl);
    onMQ(SMALL, () => { if (!L.el.hidden) setMode(); else mode = ""; });

    L.onOpen = () => {
      if (list.length) { if (!mode) setMode(); else if (mode === "spread") layout(); }
      else media().then((m) => { if (open.includes(L)) setData(m.sightings); });
    };
    L.onKey = (e) => { if (mode === "stack" && stack) stack.key(e); };
    P = { L, setData };
    return P;
  }

  // =====================================================================================
  // tapes: a shelf of cassettes next to a small portable tv
  // =====================================================================================
  let T = null;
  function noiseURL() {
    const c = document.createElement("canvas");
    c.width = 160; c.height = 120;
    const x = c.getContext("2d"), d = x.createImageData(160, 120);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    try { return c.toDataURL("image/png"); } catch { return ""; }
  }
  function tapes() {
    if (T) return T;
    const L = layer("tapes", "tapes", true);
    L.body.innerHTML = `<div class="tp-room">
        <div class="tp-tv">
          <div class="tv-ant" aria-hidden="true"><i></i><i></i></div>
          <div class="tv-body">
            <div class="tv-screen">
              <video muted loop playsinline preload="none" disablepictureinpicture></video>
              <div class="tv-static" aria-hidden="true"></div>
              <div class="tv-glass" aria-hidden="true"></div>
            </div>
            <div class="tv-panel">
              <div class="tv-grille" aria-hidden="true"></div>
              <div class="tv-osd" aria-hidden="true"><span class="tv-state">stop</span><span class="tv-ch">ch --</span></div>
              <button class="tv-knob tv-pp" type="button" aria-label="pause tape"></button>
              <span class="tv-knob-l" aria-hidden="true">play / pause</span>
              <i class="tv-led" aria-hidden="true"></i>
            </div>
          </div>
          <div class="tv-label"><b class="tv-title">pick a tape.</b><span class="tv-cap">they're on the shelf.</span></div>
        </div>
        <div class="tp-shelf-wrap"><div class="tp-shelf" role="group" aria-label="tapes"></div><div class="tp-board" aria-hidden="true"></div></div>
      </div>`;
    const v = $("video", L.body), stat = $(".tv-static", L.body), shelf = $(".tp-shelf", L.body);
    const stateEl = $(".tv-state", L.body), chEl = $(".tv-ch", L.body), led = $(".tv-led", L.body), pp = $(".tv-pp", L.body);
    const titleEl = $(".tv-title", L.body), capEl = $(".tv-cap", L.body), screen = $(".tv-screen", L.body);
    const LABELS = ["#e8342b", "#f2c21b", "#63d63a", "#2f7fe0", "#ff7a14"];
    let vids = [], spines = [], cur = -1, staticT = 0, wanted = false;
    screen.style.setProperty("--noise", `url(${noiseURL()})`);

    const setState = () => {
      const playing = !v.paused && cur >= 0;
      stateEl.textContent = cur < 0 ? "stop" : playing ? "play" : "pause";
      stateEl.classList.toggle("is-play", playing);
      led.classList.toggle("on", playing);
      pp.setAttribute("aria-label", playing ? "pause tape" : "play tape");
      pp.classList.toggle("on", playing);
    };
    const staticOff = () => { clearTimeout(staticT); stat.classList.remove("on"); };
    v.addEventListener("playing", () => { staticOff(); setState(); });
    v.addEventListener("loadeddata", () => { if (v.paused) staticOff(); });
    v.addEventListener("pause", setState);
    v.addEventListener("error", () => { staticOff(); stateEl.textContent = "no signal"; });

    function play() {
      wanted = true;
      const p = v.play();
      if (p && p.catch) p.catch(() => { wanted = false; setState(); });
    }
    // 16:9 tapes may carry a 1:1 `square` cut ({file, poster}) for narrow screens
    const cut = (t) => {
      const sq = SMALL.matches && t.square;
      if (!sq) return { file: t.file, poster: t.poster || "" };
      return typeof sq === "string" ? { file: sq, poster: t.poster || "" } : { file: sq.file || t.file, poster: sq.poster || t.poster || "" };
    };
    onMQ(SMALL, () => {
      const t = vids[cur];
      if (!t || !t.square) return;
      const c = cut(t), go = !v.paused;
      if (v.currentSrc.endsWith(c.file)) return;
      v.poster = c.poster;
      v.src = c.file;
      v.load();
      if (go) play();
    });
    function pick(i, byUser) {
      if (!vids[i]) return;
      if (i === cur) { if (byUser && v.paused) play(); return; }
      cur = i;
      const t = vids[i];
      spines.forEach((s, k) => { s.classList.toggle("out", k === i); s.setAttribute("aria-pressed", k === i); });
      titleEl.textContent = t.title || t.id;
      capEl.textContent = t.caption || "";
      chEl.textContent = `ch ${pad2(i + 1)}`;
      stat.classList.add("on");
      clearTimeout(staticT);
      staticT = setTimeout(staticOff, 1400);
      const c = cut(t);
      v.poster = c.poster;
      v.src = c.file;
      v.load();
      if (byUser || !calm()) play(); else { wanted = false; setState(); }
      if (byUser) clack(0.8);
    }
    function setData(videos) {
      vids = (videos || []).filter((t) => t && t.file);
      shelf.innerHTML = "";
      cur = -1;
      spines = vids.map((t, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "spine";
        b.setAttribute("aria-pressed", "false");
        b.setAttribute("aria-label", `play tape: ${t.title || t.id}`);
        b.style.setProperty("--lab", LABELS[i % LABELS.length]);
        b.style.setProperty("--tilt", `${((hash(t.id) - 0.5) * 3).toFixed(2)}deg`);
        b.innerHTML = `<span class="spine-label"><span class="spine-title">${esc(t.title || t.id)}</span></span><span class="spine-brand">t-120</span>`;
        b.addEventListener("click", () => pick(i, true));
        shelf.appendChild(b);
        return b;
      });
      // two that never get played
      shelf.insertAdjacentHTML("beforeend", `<span class="spine blank" aria-hidden="true" style="--lab:#d9d4c4;--tilt:-1.2deg"><span class="spine-label"><span class="spine-title">blank</span></span><span class="spine-brand">t-120</span></span><span class="spine blank lean" aria-hidden="true" style="--lab:#e8342b;--tilt:7deg"><span class="spine-label"><span class="spine-title">do not tape over</span></span><span class="spine-brand">t-160</span></span>`);
      setState();
      if (vids.length) pick(0, false);
    }
    pp.addEventListener("click", () => {
      if (cur < 0) return pick(0, true);
      if (v.paused) play(); else { wanted = false; v.pause(); }
      clack(1.6);
    });
    L.onKey = (e) => {
      const k = spines.indexOf(document.activeElement);
      if (k < 0 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      e.preventDefault();
      spines[(k + (e.key === "ArrowRight" ? 1 : -1) + spines.length) % spines.length].focus();
    };
    L.onOpen = () => {
      if (vids.length) { if (wanted || !calm()) play(); }
      else media().then((m) => { if (open.includes(L)) setData(m.videos); });
    };
    L.onClose = () => { const w = wanted; v.pause(); wanted = w; staticOff(); };
    L.focus = () => spines[Math.max(0, cur)] || null;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (!v.paused) { v.pause(); wanted = true; } }
      else if (open.includes(L) && wanted && cur >= 0) play();
    });
    T = { L, setData };
    return T;
  }

  // =====================================================================================
  // memes: wheatpasted posters on brick (stack on phones)
  // =====================================================================================
  let M = null;
  function memes() {
    if (M) return M;
    const L = layer("memes", "posters", true);
    L.body.innerHTML = `<div class="mm-wall"><div class="mm-posters"></div><div class="mm-stack stk"></div><button class="tag-btn mm-more" type="button" hidden>paste more</button></div>`;
    const wall = $(".mm-posters", L.body), stackHost = $(".mm-stack", L.body), more = $(".mm-more", L.body);
    const PAGE = 12;
    let list = [], items = [], shown = 0, mode = "", stack = null;
    const make = (m, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `poster-p t${Math.floor(hash(`${m.id}t`) * 4)}`;
      b.dataset.i = i;
      b.style.setProperty("--r", `${((hash(`${m.id}r`) - 0.5) * 6).toFixed(2)}deg`);
      b.style.setProperty("--y", `${Math.round((hash(`${m.id}y`) - 0.5) * 24)}px`);
      b.style.setProperty("--x", `${Math.round((hash(`${m.id}x`) - 0.5) * 14)}px`);
      b.style.setProperty("--w", `${Math.round(196 + hash(`${m.id}w`) * 64)}px`);
      b.setAttribute("aria-label", `poster: ${m.caption || m.id}. open in the projector`);
      b.innerHTML = `<img src="${esc(m.file)}" alt="" width="900" height="1070" loading="lazy" decoding="async" draggable="false">`;
      return b;
    };
    const project = (i) => openProjector(items, i);
    function paste() {
      const frag = document.createDocumentFragment();
      list.slice(shown, shown + PAGE).forEach((m, k) => frag.appendChild(make(m, shown + k)));
      shown = Math.min(list.length, shown + PAGE);
      wall.appendChild(frag);
      more.hidden = shown >= list.length;
    }
    function setMode() {
      if (!list.length) return;
      const m = SMALL.matches ? "stack" : "wall";
      if (m === mode) return;
      mode = m;
      L.el.dataset.mode = m;
      wall.innerHTML = "";
      stackHost.innerHTML = "";
      shown = 0;
      stack = null;
      more.hidden = true;
      if (m === "stack") stack = makeStack(stackHost, list.length, (i) => make(list[i], i), project, "900 / 1070");
      else paste();
    }
    function setData(ms) {
      list = (ms || []).filter((m) => m && m.file);
      items = list.map((m) => ({ src: m.file, cap: m.caption || "", name: `flog-meme-${m.id}.jpg` }));
      mode = "";
      setMode();
    }
    wall.addEventListener("click", (e) => { const b = e.target.closest(".poster-p"); if (b) project(+b.dataset.i); });
    more.addEventListener("click", () => { paste(); clack(1.2); });
    onMQ(SMALL, () => { if (!L.el.hidden) setMode(); else mode = ""; });
    L.onOpen = () => {
      if (list.length) { if (!mode) setMode(); }
      else media().then((m) => { if (open.includes(L)) setData(m.memes); });
    };
    L.onKey = (e) => { if (mode === "stack" && stack) stack.key(e); };
    M = { L, setData };
    return M;
  }

  // =====================================================================================
  // the slide projector
  // =====================================================================================
  let J = null;
  function projector() {
    if (J) return J;
    const L = layer("projector", "slide projector", false);
    const dust = Array.from({ length: 26 }, (_, k) => {
      const r = (s) => hash(`d${k}${s}`);
      return `<i style="--x:${(8 + r("x") * 84).toFixed(1)}%;--y:${(r("y") * 100).toFixed(1)}%;--s:${(1 + r("s") * 2.4).toFixed(1)}px;--t:${(9 + r("t") * 14).toFixed(1)}s;--dl:${(-r("d") * 20).toFixed(1)}s;--dx:${((r("m") - 0.5) * 80).toFixed(0)}px"></i>`;
    }).join("");
    L.body.innerHTML = `<div class="pj-room" aria-hidden="true"><div class="pj-beam"><i></i></div><div class="pj-dust">${dust}</div><div class="pj-lens"></div></div>
      <div class="pj-stage">
        <figure class="pj-slide">
          <div class="pj-mount">
            <span class="pj-mark a" aria-hidden="true">flog · 35mm</span><span class="pj-mark b" aria-hidden="true"></span><span class="pj-mark c" aria-hidden="true">this side to screen</span>
            <div class="pj-window"><img class="pj-img" alt=""></div>
          </div>
          <figcaption class="pj-cap"><span class="pj-count"></span><span class="pj-text"></span></figcaption>
        </figure>
      </div>
      <button class="pj-btn pj-prev" type="button" aria-label="previous slide">‹ <span>prev</span></button>
      <button class="pj-btn pj-next" type="button" aria-label="next slide"><span>next</span> ›</button>
      <div class="pj-bar"><a class="pj-btn pj-dl" href="#" download>save slide</a></div>`;
    const img = $(".pj-img", L.el), mount = $(".pj-mount", L.el), count = $(".pj-count", L.el), text = $(".pj-text", L.el);
    const markB = $(".pj-mark.b", L.el), dl = $(".pj-dl", L.el), prevB = $(".pj-prev", L.el), nextB = $(".pj-next", L.el);
    let items = [], i = 0, token = 0, swiped = false;

    async function slide(n, dir) {
      if (!items.length) return;
      i = (n + items.length) % items.length;
      const it = items[i], my = ++token;
      count.textContent = `slide ${pad2(i + 1)} / ${pad2(items.length)}`;
      text.textContent = it.cap || "";
      markB.textContent = `no. ${pad2(i + 1)}`;
      dl.href = it.src;
      dl.setAttribute("download", it.name || it.src.split("/").pop().split("?")[0]);
      img.classList.add("loading");
      let im = null;
      try { im = await loadImg(it.src); } catch {}
      if (my !== token) return;
      img.classList.remove("loading");
      img.src = it.src;
      img.alt = it.cap || "slide";
      if (im) { img.width = im.naturalWidth; img.height = im.naturalHeight; }
      if (!calm() && img.animate) {
        if (dir) mount.animate([{ transform: `translateX(${dir * 70}px)`, opacity: 0.2 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
        img.animate([{ filter: "blur(12px) brightness(1.5)", transform: "scale(1.03)" }, { filter: "blur(3px) brightness(1.1)", offset: 0.55 }, { filter: "blur(0) brightness(1)", transform: "none" }], { duration: 750, easing: "ease-out" });
      }
      [i + 1, i - 1].forEach((k) => { const nb = items[(k + items.length) % items.length]; if (nb) loadImg(nb.src).catch(() => {}); });
    }
    const step = (d) => { if (items.length > 1) { clack(2); slide(i + d, d); } };
    prevB.addEventListener("click", () => step(-1));
    nextB.addEventListener("click", () => step(1));
    L.onKey = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    };
    // swipe
    let sw = null;
    L.el.addEventListener("pointerdown", (e) => { if (!e.target.closest(".pj-btn, .ov-close")) sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; swiped = false; });
    L.el.addEventListener("pointerup", (e) => {
      if (!sw || e.pointerId !== sw.id) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      sw = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped = true; step(dx < 0 ? 1 : -1); }
    });
    L.el.addEventListener("pointercancel", () => { sw = null; });
    // click on the dark room closes
    L.el.addEventListener("click", (e) => {
      if (swiped) { swiped = false; return; }
      if (!e.target.closest(".pj-mount, .pj-btn, .pj-cap, .ov-close")) hide(L);
    });
    L.focus = () => (items.length > 1 ? nextB : $(".ov-close", L.el));
    J = {
      L,
      open(list, n) {
        items = (Array.isArray(list) ? list : []).map((it) => (typeof it === "string" ? { src: it } : it)).filter((it) => it && it.src);
        if (!items.length) return;
        prevB.hidden = nextB.hidden = items.length < 2;
        L.el.classList.toggle("single", items.length < 2);
        const was = open.includes(L);
        slide(Math.max(0, Math.min(items.length - 1, n | 0)), 0);
        if (!was) { show(L); clack(2); }
      },
    };
    return J;
  }

  // HUD buttons + anything with data-overlay
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("#hud-photos, #hud-tapes, #hud-memes, [data-overlay]");
    if (!t) return;
    const k = t.dataset.overlay || t.id.replace("hud-", "");
    const fn = { photos: openPhotos, tapes: openTapes, memes: openMemes }[k];
    if (!fn) return;
    e.preventDefault();
    fn();
  });

  return {
    photos() { show(photos().L); },
    tapes() { show(tapes().L); },
    memes() { show(memes().L); },
    projector(list, n) { projector().open(list, n); },
    closeAll() { [...open].reverse().forEach((l) => hide(l)); },
  };
})();

function openPhotos() { _ov.photos(); }
function openTapes() { _ov.tapes(); }
function openMemes() { _ov.memes(); }
function openProjector(items, index) { _ov.projector(items, index); }
function closeOverlay() { _ov.closeAll(); }
