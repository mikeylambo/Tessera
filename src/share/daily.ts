import { World, type WorldConfig } from "../sim/World";
import { InputPlayer, type LogEntry } from "../sim/Replay";

/**
 * The shareable Daily (brief §3). Pure functions shared by the client and the `tessera-submit` edge function, so the
 * share grid, the replay hash and the OG image all come from the same deterministic re-simulation.
 */

/** Daily #1 = 2026-11-13, the day online boards went live (DECISIONS #67, #80). */
export const DAILY_EPOCH = "2026-11-13";
const DAY_MS = 86_400_000;

export function dailyIndex(day: string): number {
  return Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`)) / DAY_MS) + 1;
}
export function dailyDay(index: number): string {
  return new Date(Date.parse(`${DAILY_EPOCH}T00:00:00Z`) + (index - 1) * DAY_MS).toISOString().slice(0, 10);
}
/** ms until the next UTC midnight (the next Daily). */
export function msToNextDaily(now = Date.now()): number {
  return DAY_MS - (now % DAY_MS);
}
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Streak update for a finished Daily `day` (consecutive UTC days; replaying the same day doesn't count twice). */
export function nextStreak(prev: { last: string; count: number } | null, day: string): { last: string; count: number } {
  if (!prev || !prev.last) return { last: day, count: 1 };
  if (prev.last === day) return prev;
  const gap = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${prev.last}T00:00:00Z`)) / DAY_MS);
  if (gap === 1) return { last: day, count: prev.count + 1 };
  if (gap < 0) return prev;
  return { last: day, count: 1 };
}

export const GRID_COLS = 6;
export const GRID_ROWS = 6;

/**
 * Spoiler-free silhouette: every cell the run earned ground on, downsampled to 6 columns × ≤ 6 rows, front row first.
 * Shape only — formations are never encoded. Returned as row strings of "1"/"0".
 */
export function silhouette(cells: ReadonlyArray<{ x: number; z: number }>): string[] {
  if (!cells.length) return ["000000"];
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of cells) {
    minZ = Math.min(minZ, c.z);
    maxZ = Math.max(maxZ, c.z);
  }
  const span = maxZ - minZ + 1;
  const rows = Math.min(GRID_ROWS, span);
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(GRID_COLS).fill(0));
  for (const c of cells) {
    const r = Math.min(rows - 1, Math.floor(((maxZ - c.z) / span) * rows)); // front row on top
    // 7 columns → 6: each output column covers 7/6 of a source column; a cell lights every bucket it overlaps
    const a = (c.x * GRID_COLS) / 7;
    const b = ((c.x + 1) * GRID_COLS) / 7;
    for (let k = Math.floor(a); k < Math.ceil(b) && k < GRID_COLS; k++) if (Math.min(b, k + 1) - Math.max(a, k) >= 0.34) grid[r]![k] = 1;
  }
  return grid.map((row) => row.join(""));
}

export interface ShareTextInput {
  index: number;
  depth: number;
  perfect: number;
  /** Only when the run was validated by `tessera-submit`. */
  rank: number | null;
  grid: string[];
  url: string;
}

export function shareText(s: ShareTextInput): string {
  const head = [`Depth ${s.depth}`, ...(s.rank ? [`Rank #${s.rank}`] : []), ...(s.perfect ? [`Perfect ×${s.perfect}`] : [])].join(" · ");
  const rows = s.grid.map((r) => [...r].map((c) => (c === "1" ? "🟧" : "⬛")).join(""));
  return [`TESSERA Daily #${s.index} ✦`, head, ...rows, s.url].join("\n");
}

export interface RunTrace {
  world: World;
  /** Every cell that ever rose as earned ground (start slab excluded). */
  cells: Array<{ x: number; z: number }>;
  hash: string;
}

/** Re-simulate (config, log) to `frames`, collecting earned ground. Deterministic: same inputs → same hash. */
export function traceRun(config: WorldConfig, entries: readonly LogEntry[], frames: number): RunTrace {
  const w = new World(config);
  const p = new InputPlayer(entries);
  const seen = new Map<number, { x: number; z: number }>();
  let guard = 0;
  while (w.frame < frames && !w.ended && guard++ < frames * 4) {
    w.step(p.next(w.frame));
    for (const e of w.events.drain()) if (e.t === "TileRise") seen.set(e.z * 8 + e.x, { x: e.x, z: e.z });
  }
  return { world: w, cells: [...seen.values()], hash: w.stateHash() };
}

/** Replay ids: 10 chars of Crockford-ish base32 (no ambiguous letters). */
export const RUN_ID = /^[0-9abcdefghjkmnpqrstvwxyz]{10}$/;
