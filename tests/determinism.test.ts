import { describe, expect, it } from "vitest";
import { resimulate } from "../src/sim/Replay";
import { runBot } from "./helpers";

describe("determinism", () => {
  for (const seed of [1, 42, "DAILY-2026-11-07"]) {
    it(`same seed + input log → identical state hash (${seed})`, () => {
      const a = runBot({ mode: "endless", seed }, "competent", 6000);
      const b = runBot({ mode: "endless", seed }, "competent", 6000);
      expect(a.world.stateHash()).toBe(b.world.stateHash());
      const r = resimulate({ mode: "endless", seed }, a.recorder.entries, a.world.frame);
      expect(r.frame).toBe(a.world.frame);
      expect(r.stateHash()).toBe(a.world.stateHash());
    });
  }
  it("tampered log diverges", () => {
    const a = runBot({ mode: "endless", seed: 5 }, "competent", 4000);
    const tampered = a.recorder.entries.map((e) => [...e] as typeof e);
    const i = tampered.findIndex((e) => e[5] === 1);
    tampered.splice(i, 1);
    const r = resimulate({ mode: "endless", seed: 5 }, tampered, a.world.frame);
    expect(r.stateHash()).not.toBe(a.world.stateHash());
  });
});
