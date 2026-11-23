// specimen card: interactive 3D flog via <model-viewer> when media lists a model,
// falling back to the turntable video if there is no model or it fails to load.
// tap (not drag) = knock on wood + a little hop.

const MODEL_VIEWER_SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js";

function initSpecimen(media) {
  const card = $("#specimen"), stage = $("#spec-stage"), video = $("#spec-video");
  let viewer = null;

  // knock on tap; a drag (rotating the model) is not a tap
  let down = null;
  card.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  card.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 600) return;
    knock();
    const target = viewer || card;
    target.classList.remove("hop", "knock");
    void target.offsetWidth;
    target.classList.add(viewer ? "hop" : "knock");
  });

  const fallback = () => {
    viewer?.remove();
    viewer = null;
    video.hidden = false;
    card.classList.remove("is-3d");
    $("#spec-mode").textContent = "FIELD CARD";
    $("#spec-cap").textContent = "tap the card to knock on wood";
  };

  const src = media.model;
  if (!src) return;
  // only fetch the ~1MB viewer when the model file is actually there
  fetch(src, { method: "HEAD" }).then((r) => {
    if (!r.ok) return fallback();
    if (!customElements.get("model-viewer")) {
      const s = document.createElement("script");
      s.type = "module";
      s.src = MODEL_VIEWER_SRC;
      s.onerror = fallback;
      document.head.appendChild(s);
    }
    viewer = document.createElement("model-viewer");
    Object.entries({
      src, alt: "flog, in 3D. drag to spin him.", poster: video.getAttribute("poster"),
      "camera-controls": "", "auto-rotate": "", "auto-rotate-delay": "0", "rotation-per-second": "28deg",
      "interaction-prompt": "none", "disable-zoom": "", "disable-pan": "", "touch-action": "pan-y",
      "shadow-intensity": "1", "shadow-softness": "0.8", exposure: "1.05", "environment-image": "neutral",
      "camera-orbit": "20deg 78deg auto", loading: "eager",
    }).forEach(([k, v]) => viewer.setAttribute(k, v));
    viewer.className = "spec-3d";
    viewer.addEventListener("error", fallback, { once: true });
    viewer.addEventListener("load", () => {
      video.hidden = true;
      video.pause();
      card.classList.add("is-3d");
      $("#spec-mode").textContent = "3D SCAN";
      $("#spec-cap").textContent = "drag to spin him. tap to knock on wood.";
    }, { once: true });
    stage.appendChild(viewer);
  }).catch(fallback);
}
