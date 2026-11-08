import { it } from "vitest";
import { World } from "../../src/sim/World";
import { stageById } from "../../src/data/hundred";
import { NO_INPUT } from "../../src/sim/types";
import type { StageDef } from "../../src/data/hundred/types";
const conflicts = (stage: StageDef): number => {
  const w = new World({ mode: "hundred", seed: "x", stage: { ...stage, crumble: 0, objective: { type: "survive", ticks: 400 } } });
  w.godMode = true;
  let n = 0;
  for (let i = 0; i < 60 * 70 && !w.ended; i++) { w.step(NO_INPUT); for (const e of w.events.drain()) if (e.t === "SkyfallShatter") n++; }
  return n;
};
it("skyfix", () => {
  for (const id of [44, 80]) {
    const s = structuredClone(stageById(id)!);
    s.skyfall!.forEach((k, i) => {
      if (conflicts(s) === 0) return;
      const orig = { ...k };
      const cands = [];
      for (const dz of [0, -1, 1]) for (const dx of [0, -1, 1, -2, 2, -3, 3]) cands.push({ x: orig.x + dx, z: orig.z + dz });
      for (const c of cands) {
        if (c.x < 0 || c.x > 6) continue;
        s.skyfall![i] = { ...orig, ...c };
        const before = conflicts(s);
        if (before === 0) { console.log(`stage ${id} sky#${i} (${orig.x},${orig.z}) -> (${c.x},${c.z})`); return; }
      }
      s.skyfall![i] = orig;
    });
    console.log(`stage ${id} conflicts now ${conflicts(s)}`);
  }
});
