import { describe, expect, it } from "vitest";
import { World } from "../src/sim/World";
import { Bot } from "../src/dev/bot";
import { FORMATIONS, mirrorRow } from "../src/data/formations";
import { searchFormation, searchFormationReference, type SearchInput } from "../src/sim/Fairness";

/** The optimized plan search must be decision- and path-identical to the reference (replays + server validation depend on it). */
describe("fairness search equivalence", () => {
  it("optimized search == reference on live Endless states", () => {
    const inputs: SearchInput[] = [];
    for (const seed of [1, 2, 3]) {
      for (const sector of [1, 4, 8, 12]) {
        const w = new World({ mode: "endless", seed, sector });
        const bot = new Bot("competent", seed);
        for (let i = 0; i < 2400 && !w.ended; i++) {
          w.step(w.runeOffers ? { held: 0, press: 0, mark: null, detonate: false, blast: false, pick: 0 } : bot.think(w));
          if (i % 400 === 399 && !w.outcome) for (const f of FORMATIONS) for (const m of [false, true]) {
            const inp = w.searchInputFor(m ? f.rows.map(mirrorRow) : [...f.rows]);
            if (inp) inputs.push(inp);
          }
        }
      }
    }
    expect(inputs.length).toBeGreaterThan(500);
    let fair = 0;
    for (const inp of inputs) {
      const a = searchFormation(inp);
      const b = searchFormationReference(inp);
      expect(a.fair).toBe(b.fair);
      expect(a.path).toEqual(b.path);
      if (a.fair) fair++;
    }
    console.log(`equivalence: ${inputs.length} inputs identical (${fair} fair)`);
  }, 300000);
});
