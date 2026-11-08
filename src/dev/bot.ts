import { World } from "../sim/World";
import { Cubes } from "../sim/Cubes";
import { isStandard, NO_INPUT, type Cell, type Dir, type FrameInput } from "../sim/types";
import { DeterministicRng } from "@slu/web-shell";
import { chamberPlan } from "../data/chambers";

export type BotLevel = "novice" | "competent" | "expert";

/**
 * Verification bots (GDD §14). They produce FrameInput through the same input layer and timings as humans.
 *  novice    — random fair marks, 40% miss rate
 *  competent — greedy: kill the Standard whose death builds ground nearest the front; never marks Forbidden;
 *              steps toward the forward-most safe tile
 *  expert    — competent + Beacon seeking + Blast timing
 */
export class Bot {
  private rng: DeterministicRng;
  private cooldown = 0;
  private plan: Cell | null = null;

  constructor(readonly level: BotLevel, seed = 7) {
    this.rng = new DeterministicRng(seed);
  }

  think(w: World): FrameInput {
    const input: FrameInput = { ...NO_INPUT };
    if (w.runeOffers) return { ...input, pick: 0 };
    if (w.chamber) return this.chamber(w);
    if (w.outcome || !w.player.alive) return input;
    if (this.cooldown > 0) this.cooldown--;

    const p = w.player;
    const standards = w.cubes.alive().filter((c) => isStandard(c.type) && w.logical(c));

    // 0. Restraint first: if a Forbidden is coming down our lane, step aside before doing anything else
    if (p.state === "idle" && this.level !== "novice") {
      const threat = w.cubes.alive().some((c) => c.type === "forbidden" && c.landTick < 0 && c.x === p.x && c.z - p.z >= 0 && c.z - p.z <= 3);
      if (threat) {
        const side = ([2, 4] as const)
          .map((d) => ({ d, x: p.x + (d === 2 ? 1 : -1) }))
          .filter((o) => w.grid.has(o.x, p.z) && !w.cubeAt({ x: o.x, z: p.z }))
          .sort((a, b) => this.danger(w, a.x, p.z) - this.danger(w, b.x, p.z))[0];
        if (side) return { ...input, press: side.d };
      }
    }

    // 1. Detonate when every mark sits on a live Standard
    const marks = w.marks.list();
    if (marks.length && this.cooldown === 0 && w.actionLock === 0) {
      const allLoaded = marks.every((m) => {
        const c = w.cubeAt(m);
        return c && c.type !== "forbidden";
      });
      const anyForbidden = marks.some((m) => w.cubeAt(m)?.type === "forbidden");
      if (anyForbidden) {
        const bad = marks.find((m) => w.cubeAt(m)?.type === "forbidden")!;
        this.cooldown = 6;
        return { ...input, mark: bad };
      }
      // a lone Phase half can't die: mark its twin first (both halves, one detonation)
      const lonePhase = marks
        .map((m) => w.cubeAt(m))
        .find((c) => c && c.type === "phase" && !marks.some((m2) => { const t = w.cubes.byId(c.twin); const l = t && w.logical(t); return l && l.x === m2.x && l.z === m2.z; }));
      if (lonePhase) {
        const twin = w.cubes.byId(lonePhase.twin);
        const tl = twin && w.logical(twin);
        if (tl && w.inReach(tl) && marks.length < w.maxMarks && this.cooldown === 0) {
          this.cooldown = 2;
          return { ...input, mark: tl };
        }
        if (marks.length >= w.maxMarks || !tl || !w.inReach(tl)) {
          // can't complete the pair: clear the dead mark instead of wasting a detonation
          const dead = marks.find((m) => w.cubeAt(m)?.id === lonePhase.id)!;
          this.cooldown = 4;
          return { ...input, mark: dead };
        }
      } else if (allLoaded || marks.length >= w.maxMarks) {
        this.cooldown = 4;
        return { ...input, detonate: true };
      }
    }

    // 2. Expert: Blast when ≥ 2 Standards are inside a glyph's 3×3
    if (this.level === "expert" && w.run.glyphs.length && this.cooldown === 0 && w.actionLock === 0) {
      const g = w.run.glyphs[0]!;
      const caught = w.cubes.alive().filter((c) => {
        const l = w.logical(c);
        return l && Math.abs(l.x - g.x) <= 1 && Math.abs(l.z - g.z) <= 1;
      });
      if (caught.length >= 2 && !caught.some((c) => c.type === "forbidden")) {
        this.cooldown = 30;
        return { ...input, blast: true };
      }
    }

    // 3. Mark: kill each Standard where its death extends connected ground; urgent kills anywhere
    if (this.cooldown === 0 && w.actionLock === 0 && marks.length < w.maxMarks) {
      const conn = new Set(w.connected().map((t) => t.z * 8 + t.x));
      const touchesConn = (x: number, z: number) => conn.has(z * 8 + x - 1) || conn.has(z * 8 + x + 1) || conn.has((z - 1) * 8 + x) || conn.has((z + 1) * 8 + x);
      const rear = w.grid.rearZ() ?? 0;
      let best: Cell | null = null;
      let bestScore = -Infinity;
      for (const c of standards) {
        const l = w.logical(c)!;
        if (w.marks.has(l) || !w.inReach(l)) continue;
        const rolling = Cubes.rolling(c, w.f, w.tickLen);
        if (rolling && l.z === c.z && w.f > w.tickLen - 16) continue; // about to leave this cell
        const isVoid = !w.grid.has(l.x, l.z) && !w.grid.isScar(l.x, l.z);
        let s = -Infinity;
        if (isVoid && touchesConn(l.x, l.z)) s = 60 + l.z * 3; // bridge / extend the front
        else if (l.z - p.z <= 1 || l.z <= rear + 1) s = 40 + (2 - (l.z - p.z)) * 5; // urgent: about to crush us or escape
        else if (!isVoid && conn.has(l.z * 8 + l.x) && l.z - p.z <= 2) s = 30; // on our ground and close
        else if (this.level !== "novice" && isVoid && w.run.glyphs.length === 0 && c.type === "advantage") s = 20;
        if (s === -Infinity) continue;
        s -= Math.abs(l.x - p.x) * 0.5;
        if (s > bestScore) {
          bestScore = s;
          best = l;
        }
      }
      if (best) {
        if (this.level === "novice" && this.rng.chance(0.4)) {
          const miss = { x: Math.max(0, Math.min(6, best.x + this.rng.int(-1, 1))), z: best.z + this.rng.int(-1, 1) };
          this.cooldown = 10 + this.rng.int(0, 20);
          return { ...input, mark: w.inReach(miss) ? miss : best };
        }
        this.cooldown = this.level === "novice" ? 12 : 2;
        return { ...input, mark: best };
      }
    }

    // 4. Movement: step toward the safest forward tile
    if (p.state !== "idle") return input;
    const target = this.pickTarget(w);
    if (!target || (target.x === p.x && target.z === p.z)) {
      return input;
    }
    const dir = this.firstStep(w, target);
    if (dir) return { ...input, press: dir };
    return input;
  }

  /** Chamber: solve exactly (exhaustive), arm the Glyph set, mark the rest, one Detonate. Novice guesses. */
  private chamber(w: World): FrameInput {
    const ch = w.chamber!;
    if (this.cooldown > 0) {
      this.cooldown--;
      return { ...NO_INPUT };
    }
    this.cooldown = 3;
    const plan = this.level === "novice" ? { mask: (1 << ch.glyphs.length) - 1, marks: [] } : chamberPlan(ch.def);
    if (!plan) return { ...NO_INPUT, detonate: true };
    const wrong = ch.armed.findIndex((a, i) => a !== !!(plan.mask & (1 << i)));
    if (wrong >= 0) return { ...NO_INPUT, pick: wrong };
    const todo = plan.marks.map((c) => ({ x: c.x, z: ch.z0 + c.row })).find((c) => !w.marks.has(c));
    if (todo) return { ...NO_INPUT, mark: todo };
    return { ...NO_INPUT, detonate: true };
  }

  /** Lane danger: a cube rolls down its whole column, so every cell below an approaching cube is in its path. */
  private danger(w: World, x: number, z: number): number {
    let d = 0;
    for (const c of w.cubes.alive()) {
      if (c.x !== x) continue;
      if (c.landTick >= 0) {
        if (c.z === z) d += 100;
        continue;
      }
      const dz = c.z - z;
      if (dz < 0 || dz > 5) continue;
      // Forbidden must be dodged (whole lane); Standards get killed, so only imminent ones matter
      d += c.type === "forbidden" ? 200 - dz * 25 : dz <= 2 ? 25 - dz * 8 : 0;
    }
    if (w.grid.rearZ() === z) d += 15;
    return d;
  }

  private pickTarget(w: World): Cell | null {
    const tiles = w.connected();
    const p = w.player;
    let best: Cell | null = null;
    let bestScore = -Infinity;
    const seekBeacon = this.level === "expert" ? w.beacons.live()[0] : undefined;
    const incoming = w.cubes.alive().filter((c) => isStandard(c.type) && c.landTick < 0 && c.z - p.z <= 7);
    for (const t of tiles) {
      const dist = Math.abs(t.x - p.x) + Math.abs(t.z - p.z);
      if (dist > 6) continue;
      let s = -this.danger(w, t.x, t.z) * 3;
      for (const c of incoming) if (Math.abs(c.x - t.x) > w.reach) s -= 18;
      if (t.type === "glass") s -= t.standTicks >= 1 || (t.x === p.x && t.z === p.z) ? 80 : 25;
      const front = w.grid.frontZ() ?? 0;
      s -= Math.abs(t.z - (front - 2)) * 2; // stay ~2 rows behind the front edge: reach covers the threat
      s -= Math.abs(t.x - 3) * 0.6;
      s -= dist * 0.3;
      if (seekBeacon) s -= (Math.abs(seekBeacon.x - t.x) + Math.abs(seekBeacon.z - t.z)) * 1.5;
      const obj = w.config.stage?.objective;
      if (obj?.type === "exit" && t.z >= obj.z) s += 200;
      if (s > bestScore) {
        bestScore = s;
        best = { x: t.x, z: t.z };
      }
    }
    return best;
  }

  /** BFS over ground for the first step toward target. */
  private firstStep(w: World, target: Cell): Dir {
    const p = w.player;
    const key = (x: number, z: number) => `${x},${z}`;
    const prev = new Map<string, { x: number; z: number; d: Dir } | null>([[key(p.x, p.z), null]]);
    const q: Cell[] = [{ x: p.x, z: p.z }];
    const dirs: Array<[Dir, number, number]> = [[1, 0, 1], [2, 1, 0], [3, 0, -1], [4, -1, 0]];
    for (let i = 0; i < q.length; i++) {
      const c = q[i]!;
      if (c.x === target.x && c.z === target.z) break;
      for (const [d, dx, dz] of dirs) {
        const nx = c.x + dx;
        const nz = c.z + dz;
        const k = key(nx, nz);
        if (prev.has(k) || !w.grid.has(nx, nz) || w.cubeAt({ x: nx, z: nz })) continue;
        prev.set(k, { x: c.x, z: c.z, d });
        q.push({ x: nx, z: nz });
      }
    }
    let k = key(target.x, target.z);
    if (!prev.has(k)) return 0;
    let step: Dir = 0;
    for (let guard = 0; guard < 64; guard++) {
      const pr = prev.get(k);
      if (!pr) break;
      step = pr.d;
      if (pr.x === p.x && pr.z === p.z) break;
      k = key(pr.x, pr.z);
    }
    return step;
  }
}
