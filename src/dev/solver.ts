import { World } from "../sim/World";
import { Cubes } from "../sim/Cubes";
import { InputRecorder, type LogEntry } from "../sim/Replay";
import { NO_INPUT, isStandard, type Cell, type Dir, type FrameInput } from "../sim/types";
import type { StageDef } from "../data/hundred/types";
import { Bot } from "./bot";

/**
 * Plan-search stage solver (GDD §32, DECISIONS #37/#39). Beam search over macro-actions executed on the REAL sim
 * (cloned worlds), so every solution it reports is a genuine input log that clears the stage. Par = fewest marks
 * among the solutions found (best found, not a proof of optimality).
 *
 * Macro-action = one 12-frame window of real inputs: wait · step (4 dirs) · mark+detonate one Standard ·
 * mark+detonate two (incl. both Phase halves) · Blast. Windows align with the half-roll logical switch.
 */
export interface SolverOptions {
  beam?: number;
  maxFrames?: number;
  /** Keep searching after the first clear to lower the mark count. */
  minimiseMarks?: boolean;
}

export interface SolverResult {
  solved: boolean;
  marks: number;
  frames: number;
  entries: LogEntry[];
  nodes: number;
  ms: number;
}

const WINDOW = 12;

interface Node {
  w: World;
  log: Array<[number, FrameInput]>;
  score: number;
  /** Every macro so far was the policy (this lineage is always kept so the search never does worse than the bot). */
  pure: boolean;
}

/** A macro is fixed inputs, or "policy": the expert bot drives the window (search never does worse than it). */
type Macro = FrameInput[] | "policy" | "waitBlast";

const at = (n: number, f: Partial<FrameInput>): FrameInput[] => {
  const out: FrameInput[] = Array.from({ length: WINDOW }, () => ({ ...NO_INPUT }));
  out[n] = { ...out[n]!, ...f };
  return out;
};

function macros(w: World): Macro[] {
  const out: Macro[] = [at(0, {}), "policy"];
  const p = w.player;
  if (p.state === "idle") {
    for (const d of [1, 2, 3, 4] as Dir[]) {
      const nx = p.x + (d === 2 ? 1 : d === 4 ? -1 : 0);
      const nz = p.z + (d === 1 ? 1 : d === 3 ? -1 : 0);
      if (w.canEnter(nx, nz)) out.push(at(0, { press: d }));
    }
  }
  if (!p.canAct || w.actionLock > 2) return out;
  // targets: Standard cubes whose logical cell holds for the next ~10 frames and lies within Reach
  const targets: Array<{ cell: Cell; id: number; twin: number }> = [];
  const switchSoon = w.f < w.tickLen - 12 && w.f + 10 >= w.tickLen - 12;
  for (const c of w.cubes.alive()) {
    if (!isStandard(c.type)) continue;
    const l = w.logical(c);
    if (!l || !w.inReach(l)) continue;
    if (switchSoon && Cubes.rolling(c, w.tickLen - 12, w.tickLen)) continue;
    targets.push({ cell: l, id: c.id, twin: c.twin });
  }
  const cubeOf = (id: number) => w.cubes.byId(id);
  for (const t of targets) {
    if (cubeOf(t.id)?.type === "phase") continue;
    const m = at(0, { mark: t.cell });
    m[1] = { ...m[1]!, detonate: true };
    out.push(m);
  }
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i]!;
      const b = targets[j]!;
      const isPhasePair = a.twin === b.id;
      if (!isPhasePair && (cubeOf(a.id)?.type === "phase" || cubeOf(b.id)?.type === "phase")) continue;
      if (!isPhasePair && targets.length > 6 && Math.abs(a.cell.x - b.cell.x) + Math.abs(a.cell.z - b.cell.z) > 3) continue;
      const m = at(0, { mark: a.cell });
      m[1] = { ...m[1]!, mark: b.cell };
      m[5] = { ...m[5]!, detonate: true };
      out.push(m);
    }
  }
  if (w.run.glyphs.length && glyphPotential(w) >= 3) out.push("waitBlast");
  if (w.run.glyphs.length) {
    const g = w.run.glyphs[0]!;
    const caught = w.cubes.alive().filter((c) => {
      const l = w.logical(c);
      return l && Math.abs(l.x - g.x) <= 1 && Math.abs(l.z - g.z) <= 1;
    });
    // only offer the Blast once the catch is as good as it will get (or nothing better is coming)
    const still = glyphPotential(w);
    if (caught.length && !caught.some((c) => c.type === "forbidden") && caught.length >= Math.min(3, still)) out.push(at(0, { blast: true }));
  }
  return out;
}

/** Standards that are in, or will roll through, the oldest Glyph's 3×3 (a held Glyph is worth waiting for). */
function glyphPotential(w: World): number {
  const g = w.run.glyphs[0];
  if (!g) return 0;
  return w.cubes.alive().filter((c) => isStandard(c.type) && c.landTick < 0 && Math.abs(c.x - g.x) <= 1 && c.z >= g.z - 1).length;
}

function evaluate(w: World, stage: StageDef): number {
  if (w.outcome?.kind === "clear") return 1e9 - w.marksPlaced * 100 - w.frame * 0.01;
  if (w.outcome) return -1e9;
  const conn = w.connected();
  let front = -Infinity;
  for (const t of conn) front = Math.max(front, t.z);
  const o = stage.objective;
  let s = conn.length * 2 - w.marksPlaced * 3 + w.kills * 4 + glyphPotential(w) * 6;
  if (o.type === "exit") s += front * 40 + w.player.z * 25 - Math.abs(w.player.z - o.z) * 5;
  else if (o.type === "clear") s += w.kills * 30;
  else s += w.tick * 5;
  // danger: a cube about to roll onto the player
  for (const c of w.cubes.alive()) if (c.x === w.player.x && c.z - w.player.z >= 0 && c.z - w.player.z <= 1 && c.landTick < 0) s -= 60;
  return s;
}

export function solveStage(stage: StageDef, opts: SolverOptions = {}): SolverResult {
  const t0 = performance.now();
  const beam = opts.beam ?? 60;
  const maxFrames = opts.maxFrames ?? 60 * 180;
  let frontier: Node[] = [{ w: new World({ mode: "hundred", seed: `stage-${stage.id}`, stage }), log: [], score: 0, pure: true }];
  let best: Node | null = null;
  let nodes = 0;
  while (frontier.length) {
    const next: Node[] = [];
    const seen = new Set<string>();
    for (const n of frontier) {
      for (const m of macros(n.w)) {
        const w = n.w.clone();
        const log = n.log.slice();
        if (m === "waitBlast") {
          // hold still until the oldest Glyph's 3×3 holds the most Standards it ever will, then Blast (multi-window)
          const caught = () => {
            const g = w.run.glyphs[0];
            if (!g) return { n: 0, bad: true };
            let cnt = 0;
            let bad = false;
            for (const c of w.cubes.alive()) {
              const l = w.logical(c);
              if (!l || Math.abs(l.x - g.x) > 1 || Math.abs(l.z - g.z) > 1) continue;
              if (c.type === "forbidden") bad = true;
              else cnt++;
            }
            return { n: cnt, bad };
          };
          let best = 0;
          let fired = false;
          for (let i = 0; i < 60 * 12 && !w.ended && !w.outcome; i++) {
            const c = caught();
            const pot = glyphPotential(w);
            if (!c.bad && c.n >= 3 && (c.n >= pot || (best > 0 && c.n < best))) {
              const inp = { ...NO_INPUT, blast: true };
              log.push([w.frame, inp]);
              w.step(inp);
              w.events.drain();
              fired = true;
              break;
            }
            best = Math.max(best, c.bad ? 0 : c.n);
            w.step(NO_INPUT);
            w.events.drain();
          }
          if (!fired) continue;
          for (let i = 0; i < 8 && !w.ended && !w.outcome; i++) {
            w.step(NO_INPUT);
            w.events.drain();
          }
        }
        const bot = m === "policy" ? new Bot("expert", n.w.frame) : null;
        for (let i = 0; m !== "waitBlast" && i < WINDOW; i++) {
          if (w.ended || w.outcome) break;
          const inp = bot ? bot.think(w) : (m as FrameInput[])[i]!;
          if (inp.press || inp.mark || inp.detonate || inp.blast) log.push([w.frame, inp]);
          w.step(inp);
          w.events.drain();
        }
        nodes++;
        if (w.outcome?.kind === "clear") {
          if (!best || w.marksPlaced < best.w.marksPlaced || (w.marksPlaced === best.w.marksPlaced && w.frame < best.w.frame)) best = { w, log, score: 0, pure: false };
          continue;
        }
        if (w.outcome || w.ended || w.frame >= maxFrames) continue;
        const pure = n.pure && m === "policy";
        const key = w.stateHash();
        if (seen.has(key) && !pure) continue;
        seen.add(key);
        next.push({ w, log, score: evaluate(w, stage), pure });
      }
    }
    if (best && !opts.minimiseMarks) break;
    next.sort((a, b) => b.score - a.score);
    const kept = next.slice(0, beam);
    const pureNode = next.find((x) => x.pure);
    if (pureNode && !kept.includes(pureNode)) kept.push(pureNode);
    frontier = kept;
    // a candidate already using more marks than the best solution can't improve par
    if (best) frontier = frontier.filter((n) => n.w.marksPlaced < best!.w.marksPlaced);
    if (best && opts.minimiseMarks && frontier.length === 0) break;
  }
  const found = best as Node | null;
  if (!found) return { solved: false, marks: -1, frames: 0, entries: [], nodes, ms: performance.now() - t0 };
  const rec = new InputRecorder();
  for (const [f, inp] of found.log) rec.record(f, inp);
  return { solved: true, marks: found.w.marksPlaced, frames: found.w.frame, entries: rec.entries, nodes, ms: performance.now() - t0 };
}
