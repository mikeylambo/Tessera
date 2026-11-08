import { describe, expect, it } from "vitest";
import { World } from "../src/sim/World";
import { STAGES } from "../src/data/hundred";
import { NO_INPUT } from "../src/sim/types";

/**
 * Authoring validation: with no kills, cube motion is deterministic, and kills only remove cubes — so an idle,
 * no-fail run exposes every possible Skyfall landing conflict and every pair of cubes sharing a cell.
 */
describe("stage authoring validation", () => {
  for (const stage of STAGES) {
    it(`${String(stage.id).padStart(3, "0")} ${stage.name}: no Skyfall lands on a cube; no two cubes share a cell`, () => {
      const probe = { ...stage, crumble: 0, objective: { type: "survive" as const, ticks: 400 } };
      const w = new World({ mode: "hundred", seed: `stage-${stage.id}`, stage: probe });
      w.godMode = true;
      const problems: string[] = [];
      for (let i = 0; i < 60 * 70 && !w.ended; i++) {
        w.step(NO_INPUT);
        for (const e of w.events.drain()) if (e.t === "SkyfallShatter") problems.push(`skyfall ${e.x},${e.z} lands on a cube at tick ${w.tick}`);
        const seen = new Set<string>();
        for (const c of w.cubes.alive()) {
          const l = w.logical(c);
          if (!l) continue;
          const k = `${l.x},${l.z}`;
          if (seen.has(k)) problems.push(`two cubes share ${k} at tick ${w.tick}`);
          seen.add(k);
        }
      }
      expect([...new Set(problems)].slice(0, 3)).toEqual([]);
    });
  }
});
