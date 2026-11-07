import { TUNING } from "../data/tuning";
import type { Cell } from "./types";

/**
 * Formation fairness (Design Law 5, GDD §19). A formation is fair against the current ground when a plan exists that
 * kills every Standard, kills no Forbidden and keeps the player on ground. v1 checks the necessary conditions
 * of such a plan against the player's connected ground and Reach:
 *  1. Reach: every Standard's column is within Reach of some connected tile (the player can stand there as it passes).
 *  2. Sanctuary: some column carries no Forbidden in this formation and holds connected ground — a lane to let them pass.
 *  3. Capacity: per row, the marks required (Phase = 2) fit the mark budget over the rows it is reachable
 *     (≤ max marks × 2 detonations per tick), so no row demands more inputs than a tick allows.
 *  4. Phase halves are adjacent within one row (both reachable in one detonation).
 */
export interface FairnessInput {
  rows: readonly string[];
  connected: readonly Cell[];
  reach: number;
  maxMarks: number;
  tickLen: number;
}

export interface FairnessResult {
  fair: boolean;
  reason: string;
}

export function checkFormation(input: FairnessInput): FairnessResult {
  const { rows, connected, reach, maxMarks, tickLen } = input;
  if (connected.length === 0) return { fair: false, reason: "no ground" };
  const groundCols = new Set(connected.map((c) => c.x));
  const cols = TUNING.grid.columns;

  // 1. reach
  for (const row of rows) {
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      if (!ch || ch === "." || ch === "F") continue;
      let ok = false;
      for (const gx of groundCols) if (Math.abs(gx - x) <= reach) ok = true;
      if (!ok) return { fair: false, reason: `column ${x} out of reach` };
    }
  }

  // 2. sanctuary lane
  const forbiddenCols = new Set<number>();
  for (const row of rows) for (let x = 0; x < cols; x++) if (row[x] === "F") forbiddenCols.add(x);
  let sanctuary = false;
  for (const gx of groundCols) if (!forbiddenCols.has(gx)) sanctuary = true;
  if (!sanctuary) return { fair: false, reason: "no sanctuary lane" };

  // 3. capacity per row: one detonation cycle = maxMarks × markLock + detonate lock + recovery
  const cycle = maxMarks * TUNING.marks.markLock + TUNING.detonate.lock + TUNING.detonate.recovery;
  const killsPerTick = Math.max(1, Math.floor(tickLen / cycle)) * maxMarks;
  for (const row of rows) {
    let need = 0;
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      if (ch && ch !== "." && ch !== "F") need += ch === "I" ? 1 : 1; // Phase halves each need a mark
    }
    if (need > killsPerTick * 2) return { fair: false, reason: "row exceeds input budget" };
  }

  // 4. phase pairing
  for (const row of rows) {
    const p = [...row].filter((c) => c === "P").length;
    if (p % 2 !== 0) return { fair: false, reason: "unpaired phase" };
    if (p > 0 && maxMarks < 2) return { fair: false, reason: "phase needs two marks" };
  }
  return { fair: true, reason: "ok" };
}

/* ───────────────────────── plan search (Design Law 5, DECISIONS #52) ───────────────────────── */

export interface SearchInput {
  rows: readonly string[];
  /** z of the formation's nearest row at spawn. */
  z0: number;
  /** Connected ground now (static model: ground the plan's own kills create is ignored — conservative). */
  ground: readonly Cell[];
  player: Cell;
  reach: number;
  maxMarks: number;
  tickLen: number;
  /** Ticks until each future timed crumble (rear row first); empty = none during the formation. */
  crumbleAt: readonly number[];
}

export interface SearchResult {
  fair: boolean;
  /** Player cell per tick for a found plan (debug/overlay). */
  path: Cell[];
  nodes: number;
}

interface Job {
  x: number;
  row: number;
  /** Phase twin index or −1. */
  twin: number;
  forbidden: boolean;
}

/**
 * Fair ⇔ some player path over the ground (≤ ⌊tick/9⌋ steps per tick) lets every Standard be killed — scheduled
 * earliest-deadline-first under the per-tick input budget — before it lands behind the rear edge, never standing
 * where a surviving cube arrives, never killing a Forbidden, and never standing on a row the Crumble removes.
 * Beam over (tick, cell, remaining-set) states.
 */
export function searchFormation(inp: SearchInput, beam = 24): SearchResult {
  const cols = TUNING.grid.columns;
  const jobs: Job[] = [];
  inp.rows.forEach((row, r) => {
    let pend = -1;
    for (let x = 0; x < cols; x++) {
      const ch = row[x] ?? ".";
      if (ch === ".") {
        pend = -1;
        continue;
      }
      const j: Job = { x, row: r, twin: -1, forbidden: ch === "F" };
      jobs.push(j);
      if (ch === "P") {
        if (pend >= 0) {
          j.twin = pend;
          jobs[pend]!.twin = jobs.length - 1;
          pend = -1;
        } else pend = jobs.length - 1;
      } else pend = -1;
    }
  });
  const zAt = (j: Job, k: number): number => inp.z0 + j.row - Math.max(0, k - 1);
  const key = (x: number, z: number) => z * 8 + x;
  const ground = new Set(inp.ground.map((c) => key(c.x, c.z)));
  let rear = Infinity;
  for (const c of inp.ground) rear = Math.min(rear, c.z);
  const rearAt = (k: number): number => rear + inp.crumbleAt.filter((t) => t <= k).length;
  const onGround = (x: number, z: number, k: number) => ground.has(key(x, z)) && z >= rearAt(k);
  const cycle = inp.maxMarks * TUNING.marks.markLock + TUNING.detonate.lock + TUNING.detonate.recovery;
  const budget = Math.max(1, Math.floor(inp.tickLen / cycle)) * inp.maxMarks;
  const steps = Math.max(1, Math.floor(inp.tickLen / TUNING.movement.stepFrames));
  const standard = jobs.map((j, i) => (j.forbidden ? -1 : i)).filter((i) => i >= 0);
  let maxRow = 0;
  for (const j of jobs) maxRow = Math.max(maxRow, j.row);
  const horizon = inp.z0 + maxRow - rear + 3;

  interface State {
    x: number;
    z: number;
    left: number[];
    path: Cell[];
  }
  // fast-forward: nothing can be done until some cube is within Reach of the ground; by then the player can stand
  // anywhere on connected ground (steps per tick × idle ticks ≫ ground diameter), so seed every ground cell
  let front = -Infinity;
  for (const c of inp.ground) front = Math.max(front, c.z);
  let kStart = 1;
  while (kStart < horizon && !jobs.some((j) => zAt(j, kStart + 1) - front <= inp.reach + 1)) kStart++;
  const seeds: Cell[] = kStart > 3 ? inp.ground.filter((c) => onGround(c.x, c.z, kStart)) : [inp.player];
  let frontier: State[] = seeds.map((c) => ({ x: c.x, z: c.z, left: standard, path: [inp.player, c] }));
  let nodes = 0;
  const reachCache = new Map<string, number[]>();
  const reachable = (sx: number, sz: number, k: number): number[] => {
    const ck = `${sx},${sz},${rearAt(k)}`;
    const hit = reachCache.get(ck);
    if (hit) return hit;
    const dist = new Map<number, number>([[key(sx, sz), 0]]);
    const q: Cell[] = [{ x: sx, z: sz }];
    for (let i = 0; i < q.length; i++) {
      const c = q[i]!;
      const d = dist.get(key(c.x, c.z))!;
      if (d >= steps) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx;
        const nz = c.z + dz;
        if (nx < 0 || nx >= cols || dist.has(key(nx, nz)) || !onGround(nx, nz, k)) continue;
        dist.set(key(nx, nz), d + 1);
        q.push({ x: nx, z: nz });
      }
    }
    const out = [...dist.keys()];
    reachCache.set(ck, out);
    return out;
  };
  for (let k = kStart; k <= horizon && frontier.length; k++) {
    const next = new Map<string, State>();
    for (const s of frontier) {
      const dist = reachable(s.x, s.z, k);
      for (const kk of dist) {
        const x = ((kk % 8) + 8) % 8;
        const z = Math.floor(kk / 8);
        nodes++;
        // kill EDF: deadline = tick at which the cube lands behind the rear edge
        const inReach = (j: Job) => Math.max(Math.abs(j.x - x), Math.abs(zAt(j, k) - z)) <= inp.reach;
        const alive = s.left.filter((i) => zAt(jobs[i]!, k) >= rearAt(k));
        if (alive.length !== s.left.length) continue; // a Standard escaped
        const cand = alive
          .filter((i) => inReach(jobs[i]!) && (jobs[i]!.twin < 0 || inReach(jobs[jobs[i]!.twin]!)))
          .sort((a, b) => zAt(jobs[a]!, k) - zAt(jobs[b]!, k));
        let cap = budget;
        const killed = new Set<number>();
        for (const i of cand) {
          if (killed.has(i)) continue;
          const cost = jobs[i]!.twin >= 0 ? 2 : 1;
          if (cap < cost) continue;
          cap -= cost;
          killed.add(i);
          if (jobs[i]!.twin >= 0) killed.add(jobs[i]!.twin);
        }
        const left = alive.filter((i) => !killed.has(i));
        const leftSet = new Set(left);
        // never stand where a surviving cube (or any Forbidden) arrives next tick
        const crushed = jobs.some((j, i) => j.x === x && (j.forbidden || leftSet.has(i)) && (zAt(j, k + 1) === z || zAt(j, k) === z));
        if (crushed) continue;
        if (left.length === 0) return { fair: true, path: [...s.path, { x, z }], nodes };
        const id = `${kk}|${left.join(",")}`;
        if (!next.has(id)) next.set(id, { x, z, left, path: [...s.path, { x, z }] });
      }
    }
    frontier = [...next.values()].sort((a, b) => a.left.length - b.left.length || b.z - a.z).slice(0, beam);
  }
  return { fair: false, path: [], nodes };
}
