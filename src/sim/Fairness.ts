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
  // jobs in row-major order (index order == row order, which is also the EDF order the reference sorts into)
  const jx: number[] = [];
  const jrow: number[] = [];
  const jtwin: number[] = [];
  let forbiddenMask = 0;
  let maxRow = 0;
  inp.rows.forEach((row, r) => {
    let pend = -1;
    for (let x = 0; x < cols; x++) {
      const ch = row[x] ?? ".";
      if (ch === ".") {
        pend = -1;
        continue;
      }
      const i = jx.length;
      jx.push(x);
      jrow.push(r);
      jtwin.push(-1);
      if (ch === "F") forbiddenMask |= 1 << i;
      if (r > maxRow) maxRow = r;
      if (ch === "P") {
        if (pend >= 0) {
          jtwin[i] = pend;
          jtwin[pend] = i;
          pend = -1;
        } else pend = i;
      } else pend = -1;
    }
  });
  const n = jx.length;
  if (n > 30) return searchFormationReference(inp, beam); // bitmask capacity; no shipped formation is this dense
  const all = n === 0 ? 0 : n === 31 ? 0x7fffffff : (1 << n) - 1;
  const standardMask = all & ~forbiddenMask;
  const key = (x: number, z: number) => z * 8 + x;
  const ground = new Set<number>();
  let rear = Infinity;
  let front = -Infinity;
  for (const c of inp.ground) {
    ground.add(key(c.x, c.z));
    if (c.z < rear) rear = c.z;
    if (c.z > front) front = c.z;
  }
  const crumbles = [...inp.crumbleAt].sort((a, b) => a - b);
  const rearAt = (k: number): number => {
    let c = 0;
    for (const t of crumbles) if (t <= k) c++;
    return rear + c;
  };
  const onGround = (x: number, z: number, k: number) => ground.has(key(x, z)) && z >= rearAt(k);
  const zAtRow = (row: number, k: number) => inp.z0 + row - Math.max(0, k - 1);
  const cycle = inp.maxMarks * TUNING.marks.markLock + TUNING.detonate.lock + TUNING.detonate.recovery;
  const budget = Math.max(1, Math.floor(inp.tickLen / cycle)) * inp.maxMarks;
  const steps = Math.max(1, Math.floor(inp.tickLen / TUNING.movement.stepFrames));
  const horizon = inp.z0 + maxRow - rear + 3;
  // occupancy: jobs by (column, row)
  const cellJobs = new Map<number, number>();
  for (let i = 0; i < n; i++) cellJobs.set(jrow[i]! * 8 + jx[i]!, (cellJobs.get(jrow[i]! * 8 + jx[i]!) ?? 0) | (1 << i));
  const jobsAt = (x: number, row: number) => (row < 0 ? 0 : (cellJobs.get(row * 8 + x) ?? 0));
  const popcount = (m: number) => {
    let c = 0;
    while (m) {
      m &= m - 1;
      c++;
    }
    return c;
  };
  const lowestRow = (m: number) => {
    let lo = Infinity;
    for (let i = 0; m; i++, m >>>= 1) if (m & 1 && jrow[i]! < lo) lo = jrow[i]!;
    return lo;
  };

  let kStart = 1;
  const anyNear = (k: number) => {
    for (let i = 0; i < n; i++) if (zAtRow(jrow[i]!, k + 1) - front <= inp.reach + 1) return true;
    return false;
  };
  while (kStart < horizon && !anyNear(kStart)) kStart++;
  const seeds: Cell[] = kStart > 3 ? inp.ground.filter((c) => onGround(c.x, c.z, kStart)) : [inp.player];

  // path by parent pointers (the reference copies the whole path per node)
  interface Node {
    x: number;
    z: number;
    parent: Node | null;
  }
  interface State {
    x: number;
    z: number;
    left: number;
    pop: number;
    node: Node;
  }
  const root: Node = { x: inp.player.x, z: inp.player.z, parent: null };
  const pathOf = (nd: Node): Cell[] => {
    const out: Cell[] = [];
    for (let c: Node | null = nd; c; c = c.parent) out.push({ x: c.x, z: c.z });
    return out.reverse();
  };
  const sp = popcount(standardMask);
  let frontier: State[] = seeds.map((c) => ({ x: c.x, z: c.z, left: standardMask, pop: sp, node: { x: c.x, z: c.z, parent: root } }));
  let nodes = 0;
  const reachCache = new Map<number, number[]>();
  const reachable = (sx: number, sz: number, k: number): number[] => {
    const rk = rearAt(k);
    const ck = (key(sx, sz) + 4096) * 8192 + (rk + 4096);
    const hit = reachCache.get(ck);
    if (hit) return hit;
    const dist = new Map<number, number>([[key(sx, sz), 0]]);
    const qx = [sx];
    const qz = [sz];
    for (let i = 0; i < qx.length; i++) {
      const cx = qx[i]!;
      const cz = qz[i]!;
      const d = dist.get(key(cx, cz))!;
      if (d >= steps) continue;
      for (let dir = 0; dir < 4; dir++) {
        const nx = cx + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
        const nz = cz + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (nx < 0 || nx >= cols || dist.has(key(nx, nz)) || !onGround(nx, nz, k)) continue;
        dist.set(key(nx, nz), d + 1);
        qx.push(nx);
        qz.push(nz);
      }
    }
    const out = [...dist.keys()];
    reachCache.set(ck, out);
    return out;
  };
  const reach = inp.reach;
  for (let k = kStart; k <= horizon && frontier.length; k++) {
    const next = new Map<number, State>();
    // (cell, remaining-set) fully determines a successor, so a repeat can only re-derive an id already in `next`
    const seen = new Set<number>();
    const rk = rearAt(k);
    const shift = Math.max(0, k - 1); // zAt(row, k) = z0 + row - shift
    // per-job reach test at tick k is |jx − x| ≤ R and |z0 + row − shift − z| ≤ R
    for (const s of frontier) {
      const dist = reachable(s.x, s.z, k);
      // a Standard escaped → every successor of this state is dead (reference: `alive.length !== left.length`)
      const escaped = s.left !== 0 && inp.z0 + lowestRow(s.left) - shift < rk;
      if (escaped) {
        nodes += dist.length;
        continue;
      }
      for (const kk of dist) {
        const x = ((kk % 8) + 8) % 8;
        const z = Math.floor(kk / 8);
        nodes++;
        const sk = kk * 2147483648 + s.left;
        if (seen.has(sk)) continue;
        seen.add(sk);
        // EDF greedy in index order under the input budget
        let cap = budget;
        let killed = 0;
        for (let m = s.left, i = 0; m; i++, m >>>= 1) {
          if (!(m & 1) || killed & (1 << i)) continue;
          if (Math.abs(jx[i]! - x) > reach || Math.abs(inp.z0 + jrow[i]! - shift - z) > reach) continue;
          const t = jtwin[i]!;
          if (t >= 0 && (Math.abs(jx[t]! - x) > reach || Math.abs(inp.z0 + jrow[t]! - shift - z) > reach)) continue;
          const cost = t >= 0 ? 2 : 1;
          if (cap < cost) continue;
          cap -= cost;
          killed |= 1 << i;
          if (t >= 0) killed |= 1 << t;
        }
        const left = s.left & ~killed;
        // never stand where a surviving cube (or any Forbidden) is or arrives next tick
        const rowNow = z - inp.z0 + shift;
        const danger = jobsAt(x, rowNow) | jobsAt(x, rowNow + 1);
        if (danger & (forbiddenMask | left)) continue;
        const node: Node = { x, z, parent: s.node };
        if (left === 0) return { fair: true, path: pathOf(node), nodes };
        const id = kk * 2147483648 + left;
        if (!next.has(id)) next.set(id, { x, z, left, pop: popcount(left), node });
      }
    }
    frontier = [...next.values()].sort((a, b) => a.pop - b.pop || b.z - a.z).slice(0, beam);
  }
  return { fair: false, path: [], nodes };
}

/** Original plan search, kept verbatim as the equivalence oracle for `searchFormation` (tests/fairness.equiv.test.ts). */
export function searchFormationReference(inp: SearchInput, beam = 24): SearchResult {
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

/**
 * JIT warm-up: run the plan search on synthetic boards while the title screen shows, so the first real spawn
 * doesn't pay compilation cost (cold first calls measured 2–7 ms vs ≤ 0.6 ms warm). Pure; touches no game state.
 */
export function warmFairnessSearch(): void {
  const ground: Cell[] = [];
  for (let z = 0; z < 6; z++) for (let x = 0; x < TUNING.grid.columns; x++) ground.push({ x, z });
  const boards = [["SS.S.SS", "S.SFS.S", ".SS.SS."], ["PP.S.F.", "SSS.SSS"], ["S......"]];
  for (let r = 0; r < 4; r++)
    for (const rows of boards) searchFormation({ rows, z0: 14, ground, player: { x: 3, z: 3 }, reach: 3, maxMarks: 2, tickLen: 60, crumbleAt: [12] });
}
