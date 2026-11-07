import { it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { solveStage } from "../../src/dev/solver";
import { resimulate } from "../../src/sim/Replay";
import { STAGES } from "../../src/data/hundred";

/**
 * Offline stage solver run: writes a witness input log per stage (tests/witness/NNN.json) and
 * tests/hundred.report.md. The gate replays the witnesses (fast) instead of re-searching.
 *   STAGES=1-10 BEAM=60 npm run solve
 */
it("solve stages", () => {
  const [a, b] = (process.env.STAGES ?? "1-10").split("-").map(Number);
  const beam = Number(process.env.BEAM ?? 60);
  mkdirSync("tests/witness", { recursive: true });
  const lines: string[] = [];
  for (const stage of STAGES.filter((s) => s.id >= a! && s.id <= (b ?? a)!)) {
    const r = solveStage(stage, { beam, minimiseMarks: true });
    let verified = false;
    if (r.solved) {
      const w = resimulate({ mode: "hundred", seed: `stage-${stage.id}`, stage }, r.entries, r.frames + 120);
      verified = w.outcome?.kind === "clear";
      if (verified) writeFileSync(`tests/witness/${String(stage.id).padStart(3, "0")}.json`, JSON.stringify({ stage: stage.id, marks: r.marks, frames: r.frames, entries: r.entries }) + "\n");
    }
    const line = `| ${stage.id} | ${stage.name} | ${r.solved ? (verified ? "solved" : "UNVERIFIED") : "NOT SOLVED"} | ${r.solved ? r.marks : "–"} | ${stage.par} | ${(r.frames / 60).toFixed(1)} s | ${r.nodes} | ${(r.ms / 1000).toFixed(1)} s |`;
    console.log(line);
    lines.push(line);
  }
  writeFileSync(`artifacts/solve-${a}-${b ?? a}.md`, lines.join("\n") + "\n");
}, 3600000);
