import { describe, expect, it } from "vitest";
import { runBot } from "../helpers";
import { STAGES } from "../../src/data/hundred";

describe("invariants hold every frame", () => {
  for (const level of ["novice", "competent", "expert"] as const) {
    for (const seed of [2, 9]) {
      it(`${level} bot, seed ${seed}`, () => {
        const r = runBot({ mode: "endless", seed }, level, 9000, true);
        expect(r.violations.slice(0, 5)).toEqual([]);
      });
    }
  }
  for (const sector of [6, 10]) {
    it(`expert bot from Sector ${sector} (Skyfall, Phase, Iron, Glass)`, () => {
      const r = runBot({ mode: "endless", seed: 3, sector }, "expert", 9000, true);
      expect(r.violations.slice(0, 5)).toEqual([]);
    });
  }
  it("hundred stages (competent bot)", () => {
    for (const stage of STAGES) {
      const r = runBot({ mode: "hundred", seed: 1, stage }, "competent", 6000, true);
      expect(r.violations.slice(0, 5)).toEqual([]);
    }
  });
});
