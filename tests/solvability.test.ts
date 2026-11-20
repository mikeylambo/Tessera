import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { World } from "../src/sim/World";
import { InputPlayer, type LogEntry } from "../src/sim/Replay";
import { NO_INPUT } from "../src/sim/types";
import { STAGES, stageById } from "../src/data/hundred";

/** DECISIONS #83: no soft-locks. A stage that can no longer be won ends within one tick, kindly. */
const cfg = (id: number) => ({ mode: "hundred" as const, seed: `stage-${id}`, stage: stageById(id)! });
const LIMIT = 60 * 60 * 6;

/** Run with `input`, asserting the world never sits unwinnable-but-running for more than one tick. */
function runChecked(id: number, input: (w: World) => typeof NO_INPUT) {
  const w = new World(cfg(id));
  let lostAt = -1;
  let worst = 0;
  while (!w.ended && w.frame < LIMIT) {
    w.step(input(w));
    w.events.drain();
    if (!w.outcome && !w.noFail && !w.winnable()) {
      if (lostAt < 0) lostAt = w.frame;
      worst = Math.max(worst, w.frame - lostAt);
    } else lostAt = -1;
  }
  return { w, worst };
}

const exitStages = STAGES.filter((s) => s.objective.type === "exit" && !s.turns);

describe("no soft-locks", () => {
  /** The witness with mark #k aimed one row short (a single forced miss). */
  const missOne = (entries: LogEntry[], k: number): LogEntry[] => {
    let i = -1;
    return entries.map((e): LogEntry => (e[3] >= 0 && ++i === k ? [e[0], e[1], e[2], e[3], Math.max(0, e[4] - 1), e[5], e[6], e[7]] : e));
  };
  const witness = (id: number) => JSON.parse(readFileSync(`tests/witness/${String(id).padStart(3, "0")}.json`, "utf8")) as { entries: LogEntry[]; marks: number };

  it("stage 9: a forced miss can close the last route → 'No path remains' within one tick, never a hang", () => {
    const wit = witness(9);
    const outcomes: string[] = [];
    for (let k = 0; k < wit.marks; k++) {
      const p = new InputPlayer(missOne(wit.entries, k));
      const { w, worst } = runChecked(9, (w) => p.next(w.frame));
      expect(w.ended, `miss #${k} hung`).toBe(true);
      expect(worst, `miss #${k}`).toBeLessThanOrEqual(w.tickLen);
      outcomes.push(w.outcome?.kind === "fail" ? w.outcome.cause : w.outcome!.kind);
    }
    expect(outcomes).toContain("noPath");
  });

  it.each(exitStages.map((s) => s.id))("exit stage %i: every single forced miss ends (clear or kind failure), never unwinnable > 1 tick", (id) => {
    const wit = witness(id);
    for (let k = 0; k < wit.marks; k++) {
      const p = new InputPlayer(missOne(wit.entries, k));
      const { w, worst } = runChecked(id, (w) => p.next(w.frame));
      expect(w.ended, `stage ${id} miss #${k} hung at frame ${w.frame}`).toBe(true);
      expect(worst, `stage ${id} miss #${k}`).toBeLessThanOrEqual(w.tickLen);
    }
    const idle = runChecked(id, () => NO_INPUT);
    expect(idle.w.ended, `stage ${id} idle hung`).toBe(true);
  });

  it("every witness stays winnable until it clears (no false 'No path remains')", () => {
    for (const s of exitStages) {
      const wit = JSON.parse(readFileSync(`tests/witness/${String(s.id).padStart(3, "0")}.json`, "utf8")) as { entries: LogEntry[]; frames: number };
      const w = new World(cfg(s.id));
      const p = new InputPlayer(wit.entries);
      while (!w.ended && w.frame < wit.frames + 120) {
        w.step(p.next(w.frame));
        w.events.drain();
        if (!w.outcome) expect(w.winnable(), `stage ${s.id} frame ${w.frame}`).toBe(true);
      }
      expect(w.outcome?.kind, `stage ${s.id}`).toBe("clear");
    }
  });
});
