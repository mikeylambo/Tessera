/**
 * Daily share card (GDD §18): a PNG of the run's path silhouette across the void — every tile ever earned — with
 * Depth and Score. Two players' cards for the same Daily look different (GDD §43.3).
 */
export interface ShareCardInput {
  cells: ReadonlyArray<{ x: number; z: number }>;
  depth: number;
  score: number;
  label: string;
}

export function renderShareCard(inp: ShareCardInput): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, H * 0.8);
  bg.addColorStop(0, "#0b0c10");
  bg.addColorStop(1, "#050608");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // path: z grows upward; fit all rows into the frame
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of inp.cells) {
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  if (!Number.isFinite(minZ)) minZ = maxZ = 0;
  const rows = maxZ - minZ + 1;
  const top = 250;
  const bottom = H - 300;
  const cell = Math.min(64, (bottom - top) / rows, (W - 240) / 7);
  const x0 = W / 2 - (cell * 7) / 2;
  // faint lattice
  g.strokeStyle = "rgba(138,147,163,0.10)";
  g.lineWidth = 1;
  for (let x = 0; x <= 7; x++) {
    g.beginPath();
    g.moveTo(x0 + x * cell, bottom - rows * cell);
    g.lineTo(x0 + x * cell, bottom);
    g.stroke();
  }
  // tiles: warm, brightest toward the front (radiance)
  for (const p of inp.cells) {
    const t = rows > 1 ? (p.z - minZ) / (rows - 1) : 1;
    const px = x0 + p.x * cell;
    const py = bottom - (p.z - minZ + 1) * cell;
    g.fillStyle = `rgba(58,54,50,${0.75 + 0.25 * t})`;
    g.fillRect(px + 2, py + 2, cell - 4, cell - 4);
    g.strokeStyle = `rgba(255,166,74,${0.25 + 0.65 * t})`;
    g.lineWidth = Math.max(1.5, cell * 0.06);
    g.shadowColor = "rgba(255,179,71,0.6)";
    g.shadowBlur = 8 * t;
    g.strokeRect(px + 3, py + 3, cell - 6, cell - 6);
    g.shadowBlur = 0;
  }
  g.textAlign = "center";
  g.fillStyle = "#d9d2c5";
  g.font = '64px "Cinzel", serif';
  g.fillText("T E S S E R A", W / 2, 140);
  g.fillStyle = "#8a8478";
  g.font = '26px "JetBrains Mono", monospace';
  g.fillText(inp.label.toUpperCase(), W / 2, 190);
  g.fillStyle = "#ffb347";
  g.font = '44px "JetBrains Mono", monospace';
  g.fillText(`DEPTH ${inp.depth}`, W / 2, H - 190);
  g.fillStyle = "#e9e3d8";
  g.font = '36px "JetBrains Mono", monospace';
  g.fillText(inp.score.toLocaleString("en-US"), W / 2, H - 130);
  g.fillStyle = "#4d4a44";
  g.font = '22px "JetBrains Mono", monospace';
  g.fillText("every tile is earned", W / 2, H - 60);
  return c;
}

export function canvasToFile(c: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) => c.toBlob((b) => resolve(b ? new File([b], name, { type: "image/png" }) : null), "image/png"));
}
