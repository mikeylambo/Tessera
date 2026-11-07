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

describe("World.clone (solver search)", () => {
  it("a clone stepped with the same inputs stays hash-identical to the original", async () => {
    const { World } = await import("../src/sim/World");
    const { Bot } = await import("../src/dev/bot");
    const a = new World({ mode: "endless", seed: 21 });
    const bot = new Bot("competent", 3);
    for (let i = 0; i < 1500; i++) a.step(bot.think(a));
    const b = a.clone();
    expect(b.stateHash()).toBe(a.stateHash());
    const bot2 = new Bot("competent", 3);
    for (let i = 0; i < 1500; i++) {
      const inp = bot2.think(a);
      a.step(inp);
      b.step(inp);
    }
    expect(b.stateHash()).toBe(a.stateHash());
    b.step({ held: 0, press: 1, mark: null, detonate: true, blast: false, pick: -1 });
    expect(b.frame).toBe(a.frame + 1); // independent
  });
});
