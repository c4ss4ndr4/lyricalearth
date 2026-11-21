import { EarthLayer, sampleSceneHeightfield } from "./earth-layer.js";

// ============================================================================
// FOUR GEOGRAPHIC LOCATIONS (Mapped to the 4 quadrants of the gesture key)
// ============================================================================
const scenes = [
  {
    title: "Shelter / Space",
    next: "Space / Body",
    prompt: "Pull the doorway until its frame becomes a horizon.",
    geographyType: "architecture",
    terrainSeed: 104.7,
    keyPos: { x: -0.5, y: -0.5, left: "25%", top: "25%" }, // Top-left
    camera: { lat: 30.3221, lng: 35.4517, altitude: 810, range: 460, tilt: 64, heading: 115 },
  },
  {
    title: "Space / Body",
    next: "Body / Yoga",
    prompt: "Draw the horizon inward until it finds the body.",
    geographyType: "ridge",
    terrainSeed: 219.3,
    keyPos: { x: 0.5, y: -0.5, left: "75%", top: "25%" }, // Top-right
    camera: { lat: -24.7595, lng: 15.2915, altitude: 620, range: 1850, tilt: 58, heading: 42 },
  },
  {
    title: "Body / Yoga",
    next: "Dance / Flow",
    prompt: "Open the seated arc until stillness begins to move.",
    geographyType: "basin",
    terrainSeed: 337.1,
    keyPos: { x: 0.5, y: 0.5, left: "75%", top: "75%" }, // Bottom-right
    camera: { lat: 30.1235, lng: 78.3168, altitude: 420, range: 1400, tilt: 52, heading: 310 },
  },
  {
    title: "Dance / Flow",
    next: "Shelter / Space",
    prompt: "Gather the moving fabric until flow becomes shelter.",
    geographyType: "flow",
    terrainSeed: 482.9,
    keyPos: { x: -0.5, y: 0.5, left: "25%", top: "75%" }, // Bottom-left
    camera: { lat: -21.65, lng: 35.4833, altitude: 120, range: 6200, tilt: 46, heading: 25 },
  },
];

const SEGMENT_SECONDS = 5;

const films = [...document.querySelectorAll(".film")];
const feedback = document.querySelector(".feedback");
const flash = document.querySelector(".flash");
const transitionTitle = document.querySelector(".transition-title");
const pullDot = document.querySelector(".pull-dot");
const targetForm = document.querySelector(".target-form");
const mapNodes = [...document.querySelectorAll(".map-node")];
const tensionBar = document.querySelector(".tension span");
const earthStage = document.getElementById("earthStage");
const geoAttrib = document.getElementById("geoAttrib");
const tiny = document.createElement("canvas");
const fallbackCanvas = document.createElement("canvas");
fallbackCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
earthStage.appendChild(fallbackCanvas);

const earthLayer = new EarthLayer(earthStage, fallbackCanvas, geoAttrib);

tiny.width = 150;
tiny.height = 94;
const tx = tiny.getContext("2d", { willReadFrequently: true });
let current = 0;
let busy = false;
let last = 0;
let segmentStart = performance.now();

const carry = { dx: 0, dy: 0 };
const pull = { active: false, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0, energy: 0, pointer: null };

const cases = {
  1: [[0, 0.5, 0.5, 1]],
  2: [[0.5, 1, 1, 0.5]],
  3: [[0, 0.5, 1, 0.5]],
  4: [[1, 0.5, 0.5, 0]],
  5: [[0, 0.5, 0.5, 0], [0.5, 1, 1, 0.5]],
  6: [[0.5, 0, 0.5, 1]],
  7: [[0, 0.5, 0.5, 0]],
  8: [[0.5, 0, 0, 0.5]],
  9: [[0.5, 0, 0.5, 1]],
  10: [[0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1]],
  11: [[0.5, 0, 1, 0.5]],
  12: [[0, 0.5, 1, 0.5]],
  13: [[0.5, 1, 1, 0.5]],
  14: [[0, 0.5, 0.5, 1]],
};

function field(scene, now) {
  const phase = now * 0.00045;
  const img = tx.createImageData(tiny.width, tiny.height);
  const d = img.data;
  for (let y = 0; y < tiny.height; y++) {
    const ny = y / tiny.height - 0.5;
    for (let x = 0; x < tiny.width; x++) {
      const nx = x / tiny.width - 0.5;
      const e = sampleSceneHeightfield(nx, ny, scene.geographyType, scene.terrainSeed, phase);
      const dx = sampleSceneHeightfield(nx + 0.01, ny, scene.geographyType, scene.terrainSeed, phase) - e;
      const dy = sampleSceneHeightfield(nx, ny + 0.01, scene.geographyType, scene.terrainSeed, phase) - e;
      const lum = Math.max(0, Math.min(255, Math.floor((e * 0.55 + (0.5 + dx * -14 + dy * -10) * 0.45) * 230)));
      const i = (y * tiny.width + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = lum;
      d[i + 3] = 255;
    }
  }
  tx.putImageData(img, 0, 0);
}

function warp(px, py, w, h) {
  const dx = pull.dx + carry.dx;
  const dy = pull.dy + carry.dy;
  if (pull.energy < 0.01 && Math.hypot(dx, dy) < 1) return [px, py];
  const radius = Math.max(w, h) * 0.34;
  const ox = pull.ox || w * 0.5;
  const oy = pull.oy || h * 0.5;
  const dist = Math.hypot(px - ox, py - oy);
  const influence = Math.pow(Math.max(0, 1 - dist / radius), 1.7);
  const ripple = Math.sin(dist * 0.035 - pull.energy * 8) * pull.energy * 3;
  return [px + dx * influence + ((px - ox) / (dist || 1)) * ripple, py + dy * influence + ((py - oy) / (dist || 1)) * ripple];
}

function contour(f, now) {
  const scene = scenes[current];
  const c = f.querySelector("canvas");
  field(scene, now);
  const r = c.getBoundingClientRect();
  const d = Math.min(devicePixelRatio || 1, 1.5);
  const w = Math.round(r.width * d);
  const h = Math.round(r.height * d);
  const ctx = c.getContext("2d");
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  ctx.clearRect(0, 0, w, h);
  const data = tx.getImageData(0, 0, tiny.width, tiny.height).data;
  const g = new Uint8Array(tiny.width * tiny.height);
  for (let i = 0; i < g.length; i++) g[i] = data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722;
  const xs = w / (tiny.width - 1);
  const ys = h / (tiny.height - 1);
  ctx.lineWidth = Math.max(0.75, d * 0.7);
  [45, 86, 128, 170, 214].forEach((th, n) => {
    ctx.beginPath();
    for (let y = 0; y < tiny.height - 1; y++) {
      for (let x = 0; x < tiny.width - 1; x++) {
        const i = y * tiny.width + x;
        const code = (g[i] > th ? 8 : 0) | (g[i + 1] > th ? 4 : 0) | (g[i + tiny.width + 1] > th ? 2 : 0) | (g[i + tiny.width] > th ? 1 : 0);
        for (const s of cases[code] || []) {
          const a = warp((x + s[0]) * xs, (y + s[1]) * ys, w, h);
          const b = warp((x + s[2]) * xs, (y + s[3]) * ys, w, h);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      }
    }
    ctx.strokeStyle = n === 2 ? "rgba(196,255,71,.9)" : `rgba(255,255,255,${0.14 + n * 0.035})`;
    ctx.stroke();
  });
}

function resolveTargetFromPull(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 6) return (current + 1) % scenes.length;
  const nx = dx / len;
  const ny = dy / len;
  let bestIdx = (current + 1) % scenes.length;
  let bestDot = -Infinity;
  for (let i = 0; i < scenes.length; i++) {
    if (i === current) continue;
    const kp = scenes[i].keyPos;
    const kLen = Math.hypot(kp.x, kp.y);
    const dot = (nx * kp.x + ny * kp.y) / kLen;
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function resetPull() {
  pull.active = false;
  pull.dx = 0;
  pull.dy = 0;
  pull.energy = 0;
  pull.pointer = null;
  const curPos = scenes[current].keyPos;
  pullDot.style.left = curPos.left;
  pullDot.style.top = curPos.top;
  pullDot.style.transform = "translate(-50%,-50%)";
  tensionBar.style.width = "0%";
  targetForm.style.left = "50%";
  targetForm.style.top = "50%";
  targetForm.style.transform = "translate(-50%,-50%)";
  targetForm.classList.remove("found");
  mapNodes.forEach((n, i) => {
    n.classList.toggle("is-current", i === current);
    n.classList.remove("is-aimed");
  });
  films.forEach((f) => f.querySelector("canvas").classList.remove("pulling"));
}

function updateUI() {
  const s = scenes[current];
  document.querySelector("#chapter").textContent = String(current + 1).padStart(2, "0");
  document.querySelector("#sceneTitle").textContent = s.title;
  document.querySelector(".question").textContent = s.prompt;
  document.querySelectorAll(".progress-line b").forEach((b, i) => b.classList.toggle("on", i <= current));
  feedback.textContent = "The contours are waiting for your hand.";
  feedback.className = "feedback";
  resetPull();
}

function openPassage(targetIndex) {
  if (busy) return;
  busy = true;
  pull.active = false;
  carry.dx = pull.dx * 0.45;
  carry.dy = pull.dy * 0.45;
  targetForm.classList.add("found");
  feedback.textContent = "The line gives way. Another image enters.";
  feedback.className = "feedback good";
  const nextIndex = typeof targetIndex === "number" ? targetIndex : (current + 1) % films.length;
  const old = films[current];
  const next = films[nextIndex];
  transitionTitle.querySelector("span").textContent = scenes[nextIndex].title;
  transitionTitle.classList.add("show");
  flash.classList.remove("go");
  void flash.offsetWidth;
  flash.classList.add("go");
  earthLayer.transitionTo(scenes[nextIndex], 1500);
  setTimeout(() => {
    next.classList.add("active");
    old.classList.add("outgoing");
  }, 520);
  setTimeout(() => {
    old.classList.remove("active", "outgoing");
    transitionTitle.classList.remove("show");
    current = nextIndex;
    segmentStart = performance.now();
    busy = false;
    updateUI();
  }, 1500);
}

function point(e, c) {
  const r = c.getBoundingClientRect();
  const d = Math.min(devicePixelRatio || 1, 1.5);
  return { x: (e.clientX - r.left) * d, y: (e.clientY - r.top) * d };
}

films.forEach((f) => {
  const c = f.querySelector("canvas");
  c.addEventListener("pointerdown", (e) => {
    if (busy) return;
    const p = point(e, c);
    pull.active = true;
    pull.pointer = e.pointerId;
    pull.ox = p.x;
    pull.oy = p.y;
    pull.x = p.x;
    pull.y = p.y;
    c.setPointerCapture(e.pointerId);
    c.classList.add("pulling");
    feedback.textContent = "Keep pulling. Feel for the point where the image opens.";
  });
  c.addEventListener("pointermove", (e) => {
    if (!pull.active || e.pointerId !== pull.pointer || busy) return;
    const p = point(e, c);
    pull.x = p.x;
    pull.y = p.y;
    pull.dx = p.x - pull.ox;
    pull.dy = p.y - pull.oy;
    const distance = Math.hypot(pull.dx, pull.dy);
    const threshold = Math.min(c.width, c.height) * 0.31;
    pull.energy = Math.min(1, distance / threshold);
    const aimedIdx = resolveTargetFromPull(pull.dx, pull.dy);
    const aimedPos = scenes[aimedIdx].keyPos;
    tensionBar.style.width = Math.round(pull.energy * 100) + "%";
    pullDot.style.left = "50%";
    pullDot.style.top = "50%";
    pullDot.style.transform = `translate(calc(-50% + ${Math.max(-105, Math.min(105, (pull.dx / c.width) * 210))}px),calc(-50% + ${Math.max(-72, Math.min(72, (pull.dy / c.height) * 144))}px))`;
    targetForm.style.left = aimedPos.left;
    targetForm.style.top = aimedPos.top;
    targetForm.style.transform = `translate(-50%,-50%) scale(${0.75 + pull.energy * 0.4})`;
    mapNodes.forEach((n, i) => n.classList.toggle("is-aimed", i === aimedIdx));
    feedback.textContent = `Pulling toward ${scenes[aimedIdx].title}…`;
    if (pull.energy >= 1) openPassage(aimedIdx);
  });
  const release = (e) => {
    if (e.pointerId !== pull.pointer || busy) return;
    pull.active = false;
    pull.pointer = null;
    c.classList.remove("pulling");
    feedback.textContent =
      pull.energy > 0.65
        ? "Almost. Take hold again and pull farther."
        : "The field returns. Try another line, or a longer gesture.";
    const settle = () => {
      pull.dx *= 0.82;
      pull.dy *= 0.82;
      pull.energy *= 0.82;
      tensionBar.style.width = Math.round(pull.energy * 100) + "%";
      if (pull.energy > 0.01) requestAnimationFrame(settle);
      else resetPull();
    };
    requestAnimationFrame(settle);
  };
  c.addEventListener("pointerup", release);
  c.addEventListener("pointercancel", release);
});

document.querySelector(".start").addEventListener("click", () => {
  document.querySelector(".start-gate").classList.add("hidden");
  segmentStart = performance.now();
});

document.querySelector(".reset").addEventListener("click", () => {
  films.forEach((f, i) => f.classList.toggle("active", i === 0));
  current = 0;
  busy = false;
  carry.dx = 0;
  carry.dy = 0;
  segmentStart = performance.now();
  earthLayer.transitionTo(scenes[0], 1500);
  updateUI();
});

function animate(now) {
  carry.dx *= 0.97;
  carry.dy *= 0.97;
  const morph = 0.5 + 0.5 * Math.sin(now * 0.0008);
  earthLayer.update(16, morph);

  const f = films[current];
  if (now - last > 48) {
    contour(f, now);
    last = now;
  }
  const elapsed = ((now - segmentStart) / 1000) % SEGMENT_SECONDS;
  const sec = String(Math.floor(elapsed)).padStart(2, "0");
  const fr = String(Math.floor((elapsed % 1) * 25)).padStart(2, "0");
  document.querySelector("#timecode").textContent = `00:${sec}:${fr}`;
  requestAnimationFrame(animate);
}

earthLayer.init(scenes[0]).then(() => {
  updateUI();
  requestAnimationFrame(animate);
});
