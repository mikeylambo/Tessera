import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { STAGES } from "../src/data/hundred";
import { resimulate, type LogEntry } from "../src/sim/Replay";

describe("The Hundred — every authored stage is solvable (witness replay, Design Law 5)", () => {
  for (const stage of STAGES) {
    it(`${String(stage.id).padStart(3, "0")} ${stage.name}: witness clears at par`, () => {
      const file = `tests/witness/${String(stage.id).padStart(3, "0")}.json`;
      expect(existsSync(file), `missing witness — run STAGES=${stage.id} npm run solve`).toBe(true);
      const wit = JSON.parse(readFileSync(file, "utf8")) as { marks: number; frames: number; entries: LogEntry[] };
      const w = resimulate({ mode: "hundred", seed: `stage-${stage.id}`, stage }, wit.entries, wit.frames + 120);
      expect(w.outcome?.kind).toBe("clear");
      expect(w.marksPlaced).toBe(wit.marks);
      expect(stage.par).toBe(wit.marks);
      expect(w.rating()).toBe(3);
    });
  }
});
