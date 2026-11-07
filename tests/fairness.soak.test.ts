import { describe, expect, it } from "vitest";
import { World } from "../src/sim/World";
import { Bot } from "../src/dev/bot";
import { FORMATIONS, mirrorRow } from "../src/data/formations";

/**
 * Fairness soak (GDD §33): 10,000 formation checks across bands and live ground states. Measures the plan search's
 * cost against the 4 ms budget and that every formation Endless actually spawns has a plan.
 */
describe("fairness plan search", () => {
  it("10,000 formations across bands: ≤ 4 ms average, every spawned formation has a plan", () => {
    const states: World[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const sector of [1, 3, 6, 10]) {
        const w = new World({ mode: "endless", seed, sector });
        const bot = new Bot("competent", seed);
        for (let i = 0; i < 2400 && !w.ended; i++) {
          w.step(bot.think(w));
          if (w.runeOffers) w.step({ held: 0, press: 0, mark: null, detonate: false, blast: false, pick: 0 });
          if (i % 600 === 599 && !w.outcome) states.push(w.clone());
        }
      }
    }
    let checks = 0;
    let fair = 0;
    let worst = 0;
    const t0 = performance.now();
    outer: for (let round = 0; ; round++) {
      for (const w of states) {
        for (const f of FORMATIONS) {
          const rows = round % 2 ? f.rows.map(mirrorRow) : [...f.rows];
          const t = performance.now();
          if (w.fairness(rows).fair) fair++;
          worst = Math.max(worst, performance.now() - t);
          if (++checks >= 10000) break outer;
        }
      }
    }
    const avg = (performance.now() - t0) / checks;
    console.log(`fairness soak: ${checks} checks over ${states.length} states, ${fair} fair, avg ${avg.toFixed(3)} ms, worst ${worst.toFixed(2)} ms`);
    expect(avg).toBeLessThanOrEqual(4);
    // every formation Endless spawned in those runs was fair (rerolls/fallback), or logged as an unfair fallback
    let spawned = 0;
    let unfair = 0;
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const w = new World({ mode: "endless", seed });
      const bot = new Bot("competent", seed);
      for (let i = 0; i < 60 * 60 * 6 && !w.ended; i++) {
        const before = w.lastFairness;
        w.step(w.runeOffers ? { held: 0, press: 0, mark: null, detonate: false, blast: false, pick: 0 } : bot.think(w));
        if (w.lastFairness && w.lastFairness !== before) {
          spawned++;
          if (!w.lastFairness.fair) unfair++;
        }
      }
    }
    console.log(`spawned ${spawned} formations, ${unfair} without a plan`);
    expect(spawned).toBeGreaterThan(20);
    expect(unfair).toBe(0);
  }, 300000);
});
