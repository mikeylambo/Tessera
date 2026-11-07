import { it } from "vitest";
import { World } from "../../src/sim/World";
import { Bot } from "../../src/dev/bot";
import { STAGES } from "../../src/data/hundred";
it("perf", () => {
  const w = new World({ mode: "endless", seed: 2 });
  const bot = new Bot("competent", 3);
  for (let i = 0; i < 3000; i++) w.step(bot.think(w));
  let t = performance.now();
  for (let i = 0; i < 2000; i++) w.step({ held: 0, press: 0, mark: null, detonate: false, blast: false, pick: -1 });
  const step = (performance.now() - t) / 2000;
  t = performance.now();
  for (let i = 0; i < 500; i++) w.clone();
  const clone = (performance.now() - t) / 500;
  const s = new World({ mode: "hundred", seed: 1, stage: STAGES[9]! });
  t = performance.now();
  for (let i = 0; i < 500; i++) s.clone();
  console.log(`step ${(step * 1000).toFixed(1)} µs | clone(endless) ${(clone * 1000).toFixed(1)} µs | clone(stage10) ${((performance.now() - t) / 500 * 1000).toFixed(1)} µs | cubes ${w.cubes.count} tiles ${w.grid.size}`);
});
