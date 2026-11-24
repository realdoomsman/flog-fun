// the journey's spine: scroll state shared with the 3d world (FLOG_SCROLL + 'flog:scroll'),
// the vcr menu hud, subtitle timing, the plain-page switch, and a few easter eggs.

const HTML = document.documentElement;
const isStatic = () => HTML.classList.contains("static");

window.FLOG_SCROLL = { beats: [], progress: 0, beat: "tape", local: 0 };

document.addEventListener("DOMContentLoaded", () => {
  const S = window.FLOG_SCROLL;
  const beatEls = $$(".beat");

  // ---- measure beats ----
  function measure() {
    S.beats = beatEls.map((el) => ({ id: el.id, el, start: el.offsetTop, end: el.offsetTop + el.offsetHeight }));
  }

  // ---- subtitles: one line at a time, timed by scroll inside the beat ----
  // caption boxes: wrap each subtitle's content once so the black box follows wrapped lines
  $$(".sub-line").forEach((l) => { l.innerHTML = `<span class="cc">${l.innerHTML}</span>`; });

  const subs = new Map(beatEls.map((el) => [el.id, $$(".sub-line", el)]));
  function subtitle(id, local) {
    const lines = subs.get(id);
    if (!lines || !lines.length) return;
    // leave a little air at the start and the end of the beat
    const t = Math.min(0.999, Math.max(0, (local - 0.06) / 0.86));
    const cur = Math.floor(t * lines.length);
    lines.forEach((l, k) => { l.classList.toggle("on", k === cur); l.classList.toggle("past", k < cur); });
  }

  // ---- panels fade in/out with their beat ----
  function panelAlpha(b, local) {
    const p = $(".panel", b.el);
    if (!p) return;
    const last = b.id === "end";
    const a = Math.min(1, Math.max(0, (local - 0.06) / 0.14)) * (last ? 1 : Math.min(1, Math.max(0, (0.97 - local) / 0.12)));
    p.style.setProperty("--a", a.toFixed(3));
  }

  // ---- the hud rail ----
  const rail = $("#hud-rail");
  beatEls.forEach((el, i) => {
    const a = document.createElement("a");
    a.href = `#${el.id}`;
    a.innerHTML = `<i></i><span>${String(i + 1).padStart(2, "0")} ${esc(el.dataset.title)}</span>`;
    rail.appendChild(a);
  });
  const railLinks = $$("a", rail);

  let lastBeat = "", queued = false;
  function update() {
    queued = false;
    const y = scrollY + innerHeight * 0.5;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    S.progress = Math.min(1, Math.max(0, scrollY / max));
    let b = S.beats[0];
    for (const x of S.beats) if (y >= x.start) b = x;
    if (!b) return;
    S.beat = b.id;
    S.local = Math.min(1, Math.max(0, (y - b.start) / Math.max(1, b.end - b.start)));
    if (!isStatic()) {
      subtitle(b.id, S.local);
      S.beats.forEach((x) => panelAlpha(x, x === b ? S.local : (S.beats.indexOf(x) < S.beats.indexOf(b) ? 1 : 0)));
    }
    if (b.id !== lastBeat) {
      lastBeat = b.id;
      railLinks.forEach((a) => a.classList.toggle("on", a.hash === `#${b.id}`));
      $$("#hud-list a").forEach((a) => a.classList.toggle("on", a.hash === `#${b.id}`));
    }
    window.dispatchEvent(new CustomEvent("flog:scroll", { detail: S }));
  }
  const kick = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", () => { measure(); kick(); });
  addEventListener("load", () => { measure(); kick(); });
  measure();
  update();

  // ---- jumping to a beat (hud menu + rail + any #beat link) ----
  function jump(id) {
    const b = S.beats.find((x) => x.id === id);
    if (!b) return;
    // land where the beat's content is readable: panels a third in, subtitles at their first line
    const into = isStatic() ? 0 : ($(".panel", b.el) ? 0.32 : 0.1);
    const top = isStatic() ? b.start - 70 : b.start + (b.end - b.start) * into - innerHeight * 0.5;
    const far = Math.abs(top - scrollY) > innerHeight * 6;
    scrollTo({ top: Math.max(0, top), behavior: REDUCED || far ? "auto" : "smooth" });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.hash.slice(1);
    if (!S.beats.some((x) => x.id === id)) return;
    e.preventDefault();
    closeMenu();
    jump(id);
    history.replaceState(null, "", `#${id}`);
  });
  if (location.hash) addEventListener("load", () => jump(location.hash.slice(1)));

  // ---- the menu panel ----
  const menuBtn = $("#hud-menu"), panel = $("#hud-panel");
  function openMenu() { panel.hidden = false; menuBtn.setAttribute("aria-expanded", "true"); HTML.classList.add("menu-open"); ($(".on", panel) || $("a", panel)).focus(); }
  function closeMenu() { if (panel.hidden) return; panel.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); HTML.classList.remove("menu-open"); }
  menuBtn.addEventListener("click", () => (panel.hidden ? openMenu() : closeMenu()));
  document.addEventListener("keydown", (e) => {
    if (panel.hidden) return;
    const items = $$("a, button", panel);
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { closeMenu(); menuBtn.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener("pointerdown", (e) => { if (!panel.hidden && !e.target.closest("#hud")) closeMenu(); });
  ["#hud-tapes", "#hud-photos", "#hud-memes"].forEach((s) => $(s)?.addEventListener("click", closeMenu));

  // ---- 3d journey <-> plain page ----
  const modeBtn = $("#hud-mode");
  const webglOK = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  const setModeLabel = () => { modeBtn.textContent = isStatic() ? "lights off (3d journey)" : "lights on (plain page)"; };
  if (!webglOK || REDUCED) modeBtn.hidden = isStatic();
  setModeLabel();
  modeBtn.addEventListener("click", () => {
    try { localStorage.setItem("flog-static", isStatic() ? "0" : "1"); } catch {}
    location.reload();
  });
  // world3d.js could not start webgl after all: fall back to the plain page in place
  addEventListener("flog:static", () => {
    HTML.classList.remove("webgl", "vhs-booting");
    HTML.classList.add("static");
    $$(".panel").forEach((p) => p.style.removeProperty("--a"));
    $$(".sub-line").forEach((l) => l.classList.remove("on", "past"));
    setModeLabel();
    measure();
    update();
  });

  initEggs();
});

// ---- easter eggs ----
function toast(text) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
function initEggs() {
  // typing "knock" anywhere (not in a field) knocks
  let buf = "";
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kon = 0;
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    kon = e.key === KONAMI[kon] ? kon + 1 : (e.key === KONAMI[0] ? 1 : 0);
    if (kon === KONAMI.length) { kon = 0; cartwheel(); }
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-5);
    if (buf === "knock") { knock(2); toast("knock knock."); buf = ""; }
  });

  // konami: flog cartwheels across the screen. he still can't sell.
  function cartwheel() {
    if (document.querySelector(".cartwheel")) return;
    const c = document.createElement("div");
    c.className = "cartwheel";
    c.innerHTML = `<span>i still can't sell</span><img src="img/flog-standing.png" alt="" width="360" height="690">`;
    document.body.appendChild(c);
    knock(3, 1.2);
    setTimeout(() => c.remove(), REDUCED ? 2500 : 3600);
  }

  // idle for 40s: flog peeks in from an edge, then leaves when you move
  let idleT = 0, peek = null;
  const SAY = ["...", "still here.", "still not selling.", "knock knock.", "hi."];
  const hide = () => {
    if (!peek) return;
    const p = peek;
    peek = null;
    p.classList.remove("in");
    setTimeout(() => p.remove(), 800);
  };
  const arm = () => {
    clearTimeout(idleT);
    hide();
    idleT = setTimeout(() => {
      if (document.hidden || HTML.classList.contains("menu-open") || document.querySelector(".ov-open, [data-overlay-open]")) return arm();
      const side = ["left", "right", "bottom"][Math.floor(Math.random() * 3)];
      peek = document.createElement("button");
      peek.type = "button";
      peek.className = `peek ${side}`;
      peek.setAttribute("aria-label", "flog is peeking. knock.");
      peek.innerHTML = `<img src="img/flog-standing.png" alt="" width="360" height="690"><span class="peek-say">${SAY[Math.floor(Math.random() * SAY.length)]}</span>`;
      peek.addEventListener("click", () => { knock(2); hide(); });
      document.body.appendChild(peek);
      requestAnimationFrame(() => requestAnimationFrame(() => peek?.classList.add("in")));
    }, 40000);
  };
  ["pointermove", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, () => { if (peek) hide(); clearTimeout(idleT); idleT = 0; schedule(); }, { passive: true }));
  let sched = 0;
  function schedule() { clearTimeout(sched); sched = setTimeout(arm, 200); }
  arm();
}
