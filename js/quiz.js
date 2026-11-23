// "how wood are you?": six questions → a stage of lignification + a share card (canvas) + X intent.

const QUIZ = [
  { q: "the chart dips 40% while you're at dinner. you:", a: ["sell at the bottom. rebuy higher.", "check it 11 times under the table.", "finish dinner.", "didn't notice. was being a log."] },
  { q: "how do your hands feel right now?", a: ["sweaty", "a bit stiff", "like a fence", "i can't feel my hands. they're wood."] },
  { q: "someone at the party says \"bonfire\". you:", a: ["nice, marshmallows", "change the subject", "go quiet for a long time", "i don't want to talk about it"] },
  { q: "the last time you pressed sell:", a: ["today", "last week. it was a mistake.", "i tried. the button didn't move.", "what button"] },
  { q: "a beaver replies \"gm\" to your post. you:", a: ["gm back", "check his wallet", "block", "stand very still until he leaves"] },
  { q: "your morning routine:", a: ["chart. coffee. chart. panic.", "chart. coffee.", "stand in the forest", "photosynthesis"] },
];
const STAGES = [
  { name: "sapling", max: 3, diag: "still green. you check the chart every 4 minutes. the doctor says there's hope. (bad news.)" },
  { name: "twig", max: 7, diag: "first ring spotted on the belly. the sell button feels far away. keep sitting." },
  { name: "plank", max: 11, diag: "hands stiffening. you held through a dip and felt nothing. flat. sturdy. load-bearing." },
  { name: "log", max: 15, diag: "bark up to the neck. you tried to sell. the button didn't move. you are at peace with it." },
  { name: "petrified", max: 18, diag: "stone. beyond wood. a museum piece. doctors want to study you. est. 2026." },
];

function initQuiz(media) {
  const flogSrc = (media.cutouts[0] || { file: "img/flog-standing.png" }).file;
  const flogImg = loadImg(flogSrc).catch(() => null);
  let answers = [];

  const card = $("#q-card"), result = $("#q-result");
  const dots = $("#q-dots");
  dots.innerHTML = QUIZ.map(() => "<i></i>").join("");

  function show(i) {
    const item = QUIZ[i];
    $("#q-count").textContent = `question ${i + 1} of ${QUIZ.length}`;
    $$("i", dots).forEach((d, k) => { d.classList.toggle("done", k < i); d.classList.toggle("now", k === i); });
    $("#q-text").textContent = item.q;
    const box = $("#q-answers");
    box.innerHTML = "";
    item.a.forEach((txt, score) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "q-a";
      b.innerHTML = `<span class="q-l">${"abcd"[score]}</span>${esc(txt)}`;
      b.addEventListener("click", () => {
        knock(1, 0.9 + score * 0.12);
        answers[i] = score;
        b.classList.add("picked");
        setTimeout(() => (i + 1 < QUIZ.length ? swap(() => show(i + 1)) : finish()), REDUCED ? 0 : 220);
      });
      box.appendChild(b);
    });
  }
  function swap(fn) {
    if (REDUCED) return fn();
    card.classList.add("out");
    setTimeout(() => { fn(); card.classList.remove("out"); }, 200);
  }

  async function finish() {
    const score = answers.reduce((s, x) => s + x, 0);
    const idx = STAGES.findIndex((s) => score <= s.max);
    const stage = STAGES[idx];
    // personal rings: one per point plus a deterministic wobble from the answers, so the same answers give the same card
    const rings = 1 + score * 4 + (answers.reduce((h, x, k) => h * 7 + x * (k + 3), 11) % 4);
    card.hidden = true;
    result.hidden = false;
    $("#q-stage").textContent = stage.name;
    $("#q-diag").textContent = stage.diag;
    const text = `i took the lignification test at flog.fun\n\ndiagnosis: ${stage.name} (stage ${idx + 1} of 5, ${rings} rings)\n\nwooden hands > diamond hands. knock on wood 🪵 $FLOG`;
    $("#q-x").href = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    knock(idx >= 3 ? 3 : 2);
    await drawCard(stage, idx, rings, await flogImg);
    result.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
  }

  async function drawCard(stage, idx, rings, img) {
    await document.fonts.ready;
    const cv = $("#q-canvas"), c = cv.getContext("2d"), S = cv.width;
    const stone = stage.name === "petrified";
    // paper
    c.fillStyle = stone ? "#e4e1da" : "#f2e9d4";
    c.fillRect(0, 0, S, S);
    // faint tree rings behind everything
    c.save();
    c.translate(S * 0.68, S * 0.56);
    for (let r = 30, k = 0; r < S; r += 22 + (k % 3) * 6, k++) {
      c.beginPath(); c.ellipse(0, 0, r, r * 0.97, 0, 0, Math.PI * 2);
      c.strokeStyle = stone ? "rgba(90,90,90,.10)" : "rgba(150,92,40,.13)"; c.lineWidth = 2 + (k % 4 === 0 ? 2 : 0); c.stroke();
    }
    c.restore();
    // header strip
    c.fillStyle = stone ? "#3a3a3a" : "#3b2415";
    c.fillRect(0, 0, S, 110);
    c.font = "60px VT323, monospace"; c.fillStyle = "#f2e9d4"; c.textBaseline = "middle";
    c.textAlign = "left"; c.fillText("LIGNIFICATION REPORT", 56, 58);
    c.textAlign = "right"; c.fillText("FORM 70-Y", S - 56, 58);
    // patient line
    c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.font = "44px VT323, monospace"; c.fillStyle = "#7a6a52";
    c.fillText("patient: you", 60, 200);
    c.fillText(`stage ${idx + 1} of 5`, 60, 250);
    // stage name, wood-grain filled
    c.font = "800 190px Bricolage, sans-serif";
    let fs = 190;
    while (c.measureText(stage.name).width > S * 0.6 && fs > 90) { fs -= 8; c.font = `800 ${fs}px Bricolage, sans-serif`; }
    const gy = 250 + fs * 0.95;
    const grad = c.createLinearGradient(0, gy - fs, 0, gy);
    if (stone) { grad.addColorStop(0, "#8c8c88"); grad.addColorStop(1, "#4b4b48"); }
    else { grad.addColorStop(0, "#c98a4b"); grad.addColorStop(0.5, "#8a5426"); grad.addColorStop(1, "#5a3517"); }
    c.fillStyle = grad;
    c.fillText(stage.name, 52, gy);
    // stage pips
    for (let k = 0; k < 5; k++) {
      c.beginPath(); c.arc(76 + k * 64, gy + 70, 22, 0, Math.PI * 2);
      c.fillStyle = k <= idx ? (stone ? "#555" : "#3e9e1e") : "rgba(0,0,0,.12)"; c.fill();
    }
    // diagnosis text
    c.font = "40px Bricolage, sans-serif"; c.fillStyle = "#1d150d";
    const words = stage.diag.split(" "), lines = [];
    let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (c.measureText(t).width > S * 0.56 && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
    lines.forEach((l, k) => c.fillText(l, 60, gy + 170 + k * 52));
    // ring badge: one drawn ring per personal ring (capped for legibility)
    const bx = 200, by = S - 230, br = 120;
    c.beginPath(); c.arc(bx, by, br + 14, 0, Math.PI * 2); c.fillStyle = stone ? "#3a3a3a" : "#3b2415"; c.fill();
    c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fillStyle = stone ? "#bdbab3" : "#efcf98"; c.fill();
    const shown = Math.min(rings, 40);
    for (let k = 1; k <= shown; k++) {
      c.beginPath(); c.arc(bx + Math.sin(k) * 1.5, by + Math.cos(k * 1.7) * 1.5, (br - 6) * (k / shown), 0, Math.PI * 2);
      c.strokeStyle = stone ? "rgba(70,70,70,.55)" : "rgba(130,78,30,.6)"; c.lineWidth = k === shown ? 3 : 1.6; c.stroke();
    }
    c.beginPath(); c.arc(bx, by + 8, 60, 0, Math.PI * 2); c.fillStyle = stone ? "rgba(228,225,218,.92)" : "rgba(246,226,186,.92)"; c.fill();
    c.font = "86px VT323, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#1d150d"; c.fillText(String(rings), bx, by - 6);
    c.font = "34px VT323, monospace"; c.fillText("rings", bx, by + 44);
    // flog
    if (img) {
      const h = S * 0.64, w = h * (img.width / img.height), x = S - w - 70, y = S - h - 150;
      c.save();
      c.translate(x + w / 2, y + h - 8); c.scale(1, 0.12);
      const sg = c.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
      sg.addColorStop(0, "rgba(0,0,0,.35)"); sg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = sg; c.beginPath(); c.arc(0, 0, w * 0.55, 0, Math.PI * 2); c.fill();
      c.restore();
      if (stone) c.filter = "grayscale(1) contrast(1.15) brightness(1.05)";
      else if (idx === 0) c.filter = "saturate(1.25) brightness(1.05)";
      c.drawImage(img, x, y, w, h);
      c.filter = "none";
    }
    // footer
    c.fillStyle = stone ? "#3a3a3a" : "#3b2415";
    c.fillRect(0, S - 84, S, 84);
    c.font = "46px VT323, monospace"; c.fillStyle = "#f2e9d4"; c.textBaseline = "middle";
    c.textAlign = "left"; c.fillText("$FLOG · knock on wood", 56, S - 42);
    c.textAlign = "right"; c.fillStyle = "#63d63a"; c.fillText("flog.fun", S - 56, S - 42);
    drawStamp(c, S, S - 84, digicamDate());
  }

  $("#q-dl").addEventListener("click", () => { knock(1); downloadCanvas($("#q-canvas"), `flog-lignification-${$("#q-stage").textContent}.png`); });
  $("#q-again").addEventListener("click", () => {
    answers = [];
    result.hidden = true;
    card.hidden = false;
    show(0);
  });
  show(0);
}
