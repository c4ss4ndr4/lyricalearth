import { IMAGERY_CONFIG } from "./config.js";

export class EarthLayer {
  constructor(containerEl, fallbackCanvasEl, attributionEl) {
    this.container = containerEl;
    this.canvas = fallbackCanvasEl;
    this.ctx = this.canvas.getContext("2d");
    this.attributionEl = attributionEl;
    this.map3d = null;
    this.usingGoogle3D = false;
    this.currentScene = null;
    this.driftAngle = 0;
  }

  async init(initialScene) {
    this.currentScene = initialScene;
    this.resize();
    window.addEventListener("resize", () => this.resize());

    if (window.google && window.google.maps && window.google.maps.importLibrary) {
      try {
        await window.google.maps.importLibrary("maps3d");
        this.mountMap3D(initialScene);
        this.usingGoogle3D = true;
        this.canvas.style.display = "none";
        this.attributionEl.textContent = "Imagery © Google, Data providers (Google Maps 3D)";
        return;
      } catch (err) {
        console.warn("Google Maps 3D failed to initialize; falling back to relief model.", err);
      }
    }

    this.usingGoogle3D = false;
    this.canvas.style.display = "block";
    this.attributionEl.textContent =
      "Procedural topographic relief — add Google Maps API key in index.html for live 3D Earth";
    this.renderFallbackRelief(initialScene, 0);
  }

  mountMap3D(scene) {
    const el = document.createElement("gmp-map-3d");
    el.setAttribute("mode", IMAGERY_CONFIG.map3dMode);
    el.setAttribute("center", `${scene.camera.lat},${scene.camera.lng},${scene.camera.altitude}`);
    el.setAttribute("range", String(scene.camera.range));
    el.setAttribute("tilt", String(scene.camera.tilt));
    el.setAttribute("heading", String(scene.camera.heading));
    this.container.appendChild(el);
    this.map3d = el;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth * 0.5 * dpr);
    const h = Math.floor(window.innerHeight * 0.5 * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      if (!this.usingGoogle3D && this.currentScene) {
        this.renderFallbackRelief(this.currentScene, this.driftAngle);
      }
    }
  }

  transitionTo(scene, durationMs = 2600) {
    this.currentScene = scene;
    if (this.usingGoogle3D && this.map3d) {
      if (typeof this.map3d.flyCameraTo === "function") {
        this.map3d.flyCameraTo({
          endCamera: {
            center: {
              lat: scene.camera.lat,
              lng: scene.camera.lng,
              altitude: scene.camera.altitude,
            },
            range: scene.camera.range,
            tilt: scene.camera.tilt,
            heading: scene.camera.heading,
          },
          durationMillis: durationMs,
        });
      }
    } else {
      this.renderFallbackRelief(scene, this.driftAngle);
    }
  }

  update(dtMs, morphFactor) {
    this.driftAngle += dtMs * IMAGERY_CONFIG.cameraDriftSpeed;
    const opacity =
      IMAGERY_CONFIG.earthOpacityMin +
      (IMAGERY_CONFIG.earthOpacityMax - IMAGERY_CONFIG.earthOpacityMin) * morphFactor;
    const contrast = 1.08 + (1 - morphFactor) * 0.35;
    const saturate = 0.35 + morphFactor * 0.45;
    this.container.style.opacity = opacity.toFixed(3);
    this.container.style.filter = `contrast(${contrast.toFixed(2)}) saturate(${saturate.toFixed(2)})`;

    if (this.usingGoogle3D && this.map3d && this.currentScene) {
      const headingOffset = Math.sin(this.driftAngle * 1.5) * 4.5;
      this.map3d.heading = this.currentScene.camera.heading + headingOffset;
    }
  }

  renderFallbackRelief(scene, phase) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;

    const img = this.ctx.createImageData(w, h);
    const data = img.data;
    const seed = scene.terrainSeed;

    for (let y = 0; y < h; y++) {
      const ny = y / h - 0.5;
      for (let x = 0; x < w; x++) {
        const nx = x / w - 0.5;
        const elev = sampleSceneHeightfield(nx, ny, scene.geographyType, seed, phase);
        const dx = sampleSceneHeightfield(nx + 0.004, ny, scene.geographyType, seed, phase) - elev;
        const dy = sampleSceneHeightfield(nx, ny + 0.004, scene.geographyType, seed, phase) - elev;
        const shade = Math.max(0, Math.min(1, 0.52 + (dx * -18 + dy * -14)));
        const lum = Math.floor((elev * 0.48 + shade * 0.52) * 145);

        let r = lum;
        let g = lum * 0.96;
        let b = lum * 0.9;
        if (scene.geographyType === "flow") {
          r = lum * 0.78;
          g = lum * 0.92;
          b = lum * 1.05;
        } else if (scene.geographyType === "architecture") {
          r = lum * 1.06;
          g = lum * 0.92;
          b = lum * 0.8;
        }

        const idx = (y * w + x) * 4;
        data[idx] = Math.min(255, r);
        data[idx + 1] = Math.min(255, g);
        data[idx + 2] = Math.min(255, b);
        data[idx + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }
}

export function sampleSceneHeightfield(nx, ny, type, seed, phase = 0) {
  const s = seed * 0.17;
  const wave1 = Math.sin(nx * 6.5 + s + phase * 0.2) * Math.cos(ny * 5.2 - s);
  const wave2 = Math.sin((nx + ny) * 11.0 - s * 1.4) * 0.35;

  if (type === "architecture") {
    const corridor = Math.exp(-Math.pow(nx * 4.8 + Math.sin(ny * 4.0) * 0.35, 2));
    const steps = Math.floor(Math.abs(nx) * 7 + Math.abs(ny) * 5) * 0.08;
    return Math.max(0, Math.min(1, 0.72 - corridor * 0.55 + steps + wave2 * 0.18));
  }

  if (type === "ridge") {
    const spine = nx - 0.14 * Math.sin(ny * 5.4 + s);
    const crest = Math.exp(-Math.abs(spine) * 7.5);
    return Math.max(0, Math.min(1, 0.25 + crest * 0.68 + wave1 * 0.12));
  }

  if (type === "basin") {
    const r = Math.hypot(nx * 1.1, ny * 1.25);
    const bend = Math.exp(-Math.pow((ny - 0.18 * Math.sin(nx * 5.0)) * 5.5, 2));
    return Math.max(0, Math.min(1, 0.3 + r * 0.55 - bend * 0.35 + wave1 * 0.16));
  }

  const channel = Math.sin(nx * 5.2 + Math.sin(ny * 4.5 + s) * 1.6);
  return Math.max(0, Math.min(1, 0.45 + channel * 0.32 + wave2 * 0.22));
}
