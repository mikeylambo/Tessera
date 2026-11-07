import { World, type WorldConfig } from "../src/sim/World";
import { Bot, type BotLevel } from "../src/dev/bot";
import { InputRecorder } from "../src/sim/Replay";
import { NO_INPUT, type FrameInput } from "../src/sim/types";
import { TUNING } from "../src/data/tuning";
import { isStandard } from "../src/sim/types";

export function input(p: Partial<FrameInput> = {}): FrameInput {
  return { ...NO_INPUT, ...p };
}

export function idle(w: World, frames: number): void {
  for (let i = 0; i < frames && !w.ended; i++) w.step(input());
}

/** Advance until predicate or frame budget. */
export function until(w: World, pred: () => boolean, frames = 5000): boolean {
  for (let i = 0; i < frames && !w.ended; i++) {
    if (pred()) return true;
    w.step(input());
  }
  return pred();
}

export interface BotRun {
  world: World;
  recorder: InputRecorder;
  violations: string[];
}

export function runBot(config: WorldConfig, level: BotLevel, frames: number, check = false, stopWhen?: (w: World) => boolean): BotRun {
  const world = new World(config);
  const bot = new Bot(level, 11);
  const recorder = new InputRecorder();
  const violations: string[] = [];
  for (let i = 0; i < frames && !world.ended; i++) {
    const inp = bot.think(world);
    recorder.record(world.frame, inp);
    world.step(inp);
    world.events.drain();
    if (check) violations.push(...invariants(world));
    if (stopWhen?.(world)) break;
  }
  return { world, recorder, violations };
}

/** GDD §41 invariants, evaluated every frame in test builds. */
export function invariants(w: World): string[] {
  const out: string[] = [];
  const p = w.player;
  if (p.alive && !w.outcome && !w.grid.has(p.x, p.z) && p.state !== "shoved") out.push(`f${w.frame}: player off ground`);
  const seen = new Set<string>();
  for (const c of w.cubes.alive()) {
    const l = w.logical(c);
    if (c.x < 0 || c.x >= TUNING.grid.columns) out.push(`f${w.frame}: cube ${c.id} out of x bounds`);
    if (!l) continue;
    const k = `${l.x},${l.z}`;
    if (seen.has(k)) out.push(`f${w.frame}: two cubes share ${k}`);
    seen.add(k);
  }
  for (const s of w.grid.scarList()) if (w.grid.has(s.x, s.z)) out.push(`f${w.frame}: tile on scar ${s.x},${s.z}`);
  if (w.marks.count > w.maxMarks + w.echo.length) out.push(`f${w.frame}: marks ${w.marks.count} > max`);
  if (w.score.ledger !== w.score.total) out.push(`f${w.frame}: score ${w.score.total} != ledger ${w.score.ledger}`);
  if (p.x < 0 || p.x >= TUNING.grid.columns) out.push(`f${w.frame}: player out of bounds`);
  if (w.run.glyphs.length > TUNING.glyphs.maxHeld) out.push(`f${w.frame}: glyphs > max`);
  for (const g of w.run.glyphs) if (w.grid.get(g.x, g.z)?.type !== "glyph") out.push(`f${w.frame}: glyph without tile`);
  if (w.cubes.count > TUNING.spawn.liveCap + 12) out.push(`f${w.frame}: cube cap exceeded`);
  void isStandard;
  return out;
}
