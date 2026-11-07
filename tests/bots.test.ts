import { describe, expect, it } from "vitest";
import { runBot } from "./helpers";
import { STAGES } from "../src/data/hundred";

describe("Phase 2 exit: bots", () => {
  it("Phase 2 exit: competent bot survives 3 Sectors on every seed (TUNING_LOG #3)", () => {
    const results: string[] = [];
    let survivors = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = runBot({ mode: "endless", seed }, "competent", 60 * 60 * 15, false, (w) => w.sector >= 4);
      if (r.world.sector >= 4) survivors++;
      results.push(`seed ${seed}: sector ${r.world.sector} ${r.world.outcome?.kind ?? "alive"}`);
    }
    console.log(`competent survival ${survivors}/8\n${results.join("\n")}`);
    expect(survivors, results.join("\n")).toBe(8);
  });
  it("novice bot falls", () => {
    const r = runBot({ mode: "endless", seed: 1 }, "novice", 60 * 60 * 20);
    expect(r.world.outcome?.kind).toBe("fall");
  });
  it("every authored Hundred stage is solvable by the expert bot", () => {
    const report: string[] = [];
    for (const stage of STAGES) {
      const r = runBot({ mode: "hundred", seed: 1, stage }, "expert", 60 * 120);
      report.push(`${stage.id} ${stage.name}: ${r.world.outcome?.kind ?? "timeout"} marks ${r.world.marksPlaced} par ${stage.par}`);
    }
    expect(report.filter((l) => !l.includes(": clear")), report.join("\n")).toEqual([]);
  });
});
