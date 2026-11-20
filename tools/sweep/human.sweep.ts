import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { World } from "../../src/sim/World";
import { Bot } from "../../src/dev/bot";
import { stageById } from "../../src/data/hundred";

/**
 * Act I/II human difficulty audit (DECISIONS #86): the "human" bot over stages FROM..TO, SEEDS seeds each.
 * Clearing needs no par, so this measures clear rate. Writes the table into tests/hundred.report.md.
 *   npx vitest run --config vitest.sweep.config.ts tools/sweep/human.sweep.ts
 */
const FROM = Number(process.env.FROM ?? 1);
const TO = Number(process.env.TO ?? 20);
const SEEDS = Number(process.env.SEEDS ?? 50);

it("human clear rates", () => {
  const rows: string[] = [];
  for (let id = FROM; id <= TO; id++) {
    const stage = stageById(id)!;
    let clears = 0;
    const why = new Map<string, number>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const w = new World({ mode: "hundred", seed: `stage-${id}`, stage });
      const bot = new Bot("human", seed * 7919 + id);
      while (!w.ended && w.frame < 60 * 60 * 4) {
        w.step(bot.think(w));
        w.events.drain();
      }
      const o = w.outcome;
      if (o?.kind === "clear") clears++;
      else {
        const k = !o ? "timeout" : o.kind === "fall" ? `fall:${o.cause}` : `fail:${o.cause}`;
        why.set(k, (why.get(k) ?? 0) + 1);
      }
    }
    const rate = Math.round((clears / SEEDS) * 100);
    const reasons = [...why].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "—";
    rows.push(`| ${id} | ${stage.name} | ${stage.objective.type} | ${rate}% | ${reasons} |`);
    console.log(rows.at(-1));
  }
  const table = `## Human difficulty audit (stages ${FROM}–${TO}, ${SEEDS} seeds each)\n\n"human" bot (\`src/dev/bot.ts\`): slower reaction (10–22 f between actions), ~1-tick misjudgment on 20% of marks (a miss), no lookahead beyond the nearest formation. Target: ≥ 80% clears through stage 10 (DECISIONS #86).\n\n| Stage | Name | Objective | Clear rate | Failures |\n|---|---|---|---|---|\n${rows.join("\n")}\n`;
  const path = "tests/hundred.report.md";
  const doc = readFileSync(path, "utf8");
  const marker = "## Human difficulty audit";
  const base = doc.includes(marker) ? doc.slice(0, doc.indexOf(marker)).trimEnd() : doc.trimEnd();
  writeFileSync(path, `${base}\n\n${table}`);
});
