import * as THREE from "three";
import { seeded } from "../cosmetic";

/**
 * Procedural canvas textures (GDD §23): generated once at boot, cached, seeded per type. These are final art
 * unless assets/manifest.ts maps an override.
 */
const cache = new Map<string, THREE.Texture>();

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function finish(key: string, c: HTMLCanvasElement, srgb = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

function noise(g: CanvasRenderingContext2D, size: number, rnd: () => number, amount: number, base: number): void {
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n + base));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n + base));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n + base));
  }
  g.putImageData(img, 0, 0);
}

/** Etched rune strokes: short orthogonal/diagonal glyph marks inside a square border. */
function runes(g: CanvasRenderingContext2D, size: number, rnd: () => number, color: string, width: number, count: number): void {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = "square";
  const m = size * 0.16;
  g.strokeRect(m, m, size - 2 * m, size - 2 * m);
  const cells = 4;
  const cs = (size - 2 * m) / cells;
  for (let i = 0; i < count; i++) {
    const cx = m + cs * (Math.floor(rnd() * cells) + 0.5);
    const cy = m + cs * (Math.floor(rnd() * cells) + 0.5);
    const r = cs * 0.32;
    g.beginPath();
    const kind = Math.floor(rnd() * 4);
    if (kind === 0) {
      g.moveTo(cx - r, cy);
      g.lineTo(cx + r, cy);
      g.moveTo(cx, cy - r);
      g.lineTo(cx, cy + r * 0.3);
    } else if (kind === 1) {
      g.moveTo(cx - r, cy - r);
      g.lineTo(cx + r, cy - r);
      g.lineTo(cx, cy + r);
      g.closePath();
    } else if (kind === 2) {
      g.moveTo(cx - r, cy + r);
      g.lineTo(cx - r, cy - r);
      g.lineTo(cx + r, cy - r);
    } else {
      g.rect(cx - r * 0.5, cy - r * 0.5, r, r);
    }
    g.stroke();
  }
}

export function stoneTexture(): THREE.Texture {
  const key = "stone";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(512);
  const rnd = seeded(101);
  g.fillStyle = "#8f8981";
  g.fillRect(0, 0, 512, 512);
  noise(g, 512, rnd, 26, 0);
  runes(g, 512, rnd, "rgba(40,36,34,0.55)", 7, 7);
  return finish(key, c);
}

export function groundTexture(): THREE.Texture {
  const key = "ground";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(512);
  const rnd = seeded(202);
  g.fillStyle = "#3a3632";
  g.fillRect(0, 0, 512, 512);
  noise(g, 512, rnd, 22, 0);
  // poured-concrete blotches
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "90,80,70"},${0.04 + rnd() * 0.05})`;
    g.beginPath();
    g.arc(rnd() * 512, rnd() * 512, 20 + rnd() * 70, 0, Math.PI * 2);
    g.fill();
  }
  return finish(key, c);
}

/** Emissive seams for owned ground: bright amber cut lines along the border + one inner etch. */
export function seamTexture(): THREE.Texture {
  const key = "seam";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#ffffff";
  g.lineWidth = 5;
  g.strokeRect(10, 10, 236, 236);
  g.lineWidth = 2;
  g.globalAlpha = 0.5;
  g.strokeRect(34, 34, 188, 188);
  return finish(key, c);
}

export function glyphTexture(): THREE.Texture {
  const key = "glyph";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#fff";
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(128, 34);
  g.lineTo(222, 128);
  g.lineTo(128, 222);
  g.lineTo(34, 128);
  g.closePath();
  g.stroke();
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(128, 80);
  g.lineTo(128, 176);
  g.moveTo(80, 128);
  g.lineTo(176, 128);
  g.stroke();
  return finish(key, c);
}

/** Emerald fracture lines for Advantage cubes (emissive). */
export function crackTexture(): THREE.Texture {
  const key = "crack";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256);
  const rnd = seeded(303);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#fff";
  for (let k = 0; k < 6; k++) {
    g.lineWidth = 2 + rnd() * 3;
    g.beginPath();
    let x = 128 + (rnd() - 0.5) * 60;
    let y = 128 + (rnd() - 0.5) * 60;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rnd() - 0.5) * 70;
      y += (rnd() - 0.5) * 70;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return finish(key, c);
}

export function ironTexture(): THREE.Texture {
  const key = "iron";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256);
  const rnd = seeded(404);
  g.fillStyle = "#2b2e33";
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, rnd, 14, 0);
  for (let i = 0; i < 6; i++) {
    const y = 28 + i * 40;
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(16, y, 224, 6);
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.fillRect(16, y + 6, 224, 6);
  }
  return finish(key, c);
}

/** Mark sigil: an amber etched square-and-cross with tick marks; drawn white, tinted by material. */
export function sigilTexture(): THREE.Texture {
  const key = "sigil";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "#fff";
  g.shadowColor = "#fff";
  g.shadowBlur = 10;
  g.lineWidth = 8;
  g.strokeRect(30, 30, 196, 196);
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(128, 56);
  g.lineTo(200, 128);
  g.lineTo(128, 200);
  g.lineTo(56, 128);
  g.closePath();
  g.stroke();
  g.lineWidth = 4;
  for (const [x, y] of [[128, 12], [128, 244], [12, 128], [244, 128]] as const) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(128 + (x - 128) * 0.78, 128 + (y - 128) * 0.78);
    g.stroke();
  }
  g.fillStyle = "#fff";
  g.fillRect(118, 118, 20, 20);
  return finish(key, c);
}

/** Soft radial dot (dust motes, beacon glow, core halo). */
export function dotTexture(): THREE.Texture {
  const key = "dot";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return finish(key, c);
}

/** Chevron pointing toward the player (next-cell telegraph). */
export function chevronTexture(): THREE.Texture {
  const key = "chevron";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = "#fff";
  g.lineWidth = 12;
  g.lineJoin = "miter";
  g.beginPath();
  g.moveTo(24, 40);
  g.lineTo(64, 84);
  g.lineTo(104, 40);
  g.stroke();
  return finish(key, c);
}

/** Scar rift: jagged dark tear with a violet rim. */
export function scarTexture(): THREE.Texture {
  const key = "scar";
  if (cache.has(key)) return cache.get(key)!;
  const [c, g] = canvas(256);
  const rnd = seeded(505);
  g.clearRect(0, 0, 256, 256);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 70 + rnd() * 50;
    pts.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.8]);
  }
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = "rgba(4,2,8,0.95)";
  g.fill();
  g.strokeStyle = "rgba(139,92,246,0.9)";
  g.lineWidth = 4;
  g.shadowColor = "rgba(139,92,246,1)";
  g.shadowBlur = 16;
  g.stroke();
  return finish(key, c);
}
