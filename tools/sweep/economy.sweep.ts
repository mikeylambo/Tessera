import { it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { runBot } from "../../tests/helpers";
import { TUNING } from "../../src/data/tuning";

/**
 * Economy sweep (GDD §33 balance harness). Competent bot × seeds; reports average connected ground (sampled every
 * 10 s of sim time) and whether each run survives 3 Sectors (reaches Sector 4). Not part of `gates` (slow).
 *   npm run sweep            → default seeds 1–8
 *   SWEEP_SEEDS=1-16 npm run sweep
 */
const range = (process.env.SWEEP_SEEDS ?? "1-8").split("-").map(Number);
const seeds = Array.from({ length: range[1]! - range[0]! + 1 }, (_, i) => range[0]! + i);
const level = (process.env.SWEEP_BOT ?? "competent") as "competent" | "expert" | "novice";

export interface SweepResult {
  seed: number;
  sector: number;
  survived3: boolean;
  avgGround: number;
  minGround: number;
  cause: string;
}

export function sweep(): { rows: SweepResult[]; avg: number; survivors: number } {
  const rows: SweepResult[] = [];
  for (const seed of seeds) {
    let sum = 0;
    let n = 0;
    let min = Infinity;
    const r = runBot({ mode: "endless", seed }, level, 60 * 60 * 15, false, (w) => {
      if (w.frame % 600 === 0) {
        const g = w.connected().length;
        sum += g;
        n++;
        min = Math.min(min, g);
      }
      return w.sector >= 4;
    });
    const w = r.world;
    rows.push({ seed, sector: w.sector, survived3: w.sector >= 4, avgGround: n ? sum / n : 0, minGround: min === Infinity ? 0 : min, cause: w.outcome?.kind === "fall" ? `${w.outcome.cause}${w.lastCause ? `/${w.lastCause.kind}` : ""}` : "alive" });
  }
  const avg = rows.reduce((a, b) => a + b.avgGround, 0) / rows.length;
  return { rows, avg, survivors: rows.filter((r) => r.survived3).length };
}

it("economy sweep", () => {
  const { rows, avg, survivors } = sweep();
  const lines = rows.map((r) => `seed ${String(r.seed).padStart(2)}: sector ${r.sector} ${r.survived3 ? "✓" : "✗"} avg ${r.avgGround.toFixed(1)} min ${r.minGround} ${r.cause}`);
  const summary = `${level} | crumble ${TUNING.crumble.startInterval} (${TUNING.crumble.holdUntilContact}) | avg connected ${avg.toFixed(1)} (target 28–49) | survived 3 Sectors ${survivors}/${rows.length}`;
  console.log(`${summary}\n${lines.join("\n")}`);
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/economy-sweep.txt", `${summary}\n${lines.join("\n")}\n`);
}, 600000);
