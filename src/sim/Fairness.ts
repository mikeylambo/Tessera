import { TUNING } from "../data/tuning";
import type { Cell } from "./types";

/**
 * Formation fairness (Design Law 5, GDD §19). A formation is fair against the current ground when a plan exists that
 * kills every Standard, kills no Forbidden and keeps the player on ground. v1 checks the necessary conditions
 * of such a plan against the player's connected ground and Reach:
 *  1. Reach: every Standard's column is within Reach of some connected tile (the player can stand there as it passes).
 *  2. Sanctuary: some column carries no Forbidden in this formation and holds connected ground — a lane to let them pass.
 *  3. Capacity: per row, the marks required (Phase = 2) fit the mark budget over the rows it is reachable
 *     (≤ max marks × 2 detonations per tick), so no row demands more inputs than a tick allows.
 *  4. Phase halves are adjacent within one row (both reachable in one detonation).
 */
export interface FairnessInput {
  rows: readonly string[];
  connected: readonly Cell[];
  reach: number;
  maxMarks: number;
  tickLen: number;
}

export interface FairnessResult {
  fair: boolean;
  reason: string;
}

export function checkFormation(input: FairnessInput): FairnessResult {
  const { rows, connected, reach, maxMarks, tickLen } = input;
  if (connected.length === 0) return { fair: false, reason: "no ground" };
  const groundCols = new Set(connected.map((c) => c.x));
  const cols = TUNING.grid.columns;

  // 1. reach
  for (const row of rows) {
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      if (!ch || ch === "." || ch === "F") continue;
      let ok = false;
      for (const gx of groundCols) if (Math.abs(gx - x) <= reach) ok = true;
      if (!ok) return { fair: false, reason: `column ${x} out of reach` };
    }
  }

  // 2. sanctuary lane
  const forbiddenCols = new Set<number>();
  for (const row of rows) for (let x = 0; x < cols; x++) if (row[x] === "F") forbiddenCols.add(x);
  let sanctuary = false;
  for (const gx of groundCols) if (!forbiddenCols.has(gx)) sanctuary = true;
  if (!sanctuary) return { fair: false, reason: "no sanctuary lane" };

  // 3. capacity per row: one detonation cycle = maxMarks × markLock + detonate lock + recovery
  const cycle = maxMarks * TUNING.marks.markLock + TUNING.detonate.lock + TUNING.detonate.recovery;
  const killsPerTick = Math.max(1, Math.floor(tickLen / cycle)) * maxMarks;
  for (const row of rows) {
    let need = 0;
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      if (ch && ch !== "." && ch !== "F") need += ch === "I" ? 1 : 1; // Phase halves each need a mark
    }
    if (need > killsPerTick * 2) return { fair: false, reason: "row exceeds input budget" };
  }

  // 4. phase pairing
  for (const row of rows) {
    const p = [...row].filter((c) => c === "P").length;
    if (p % 2 !== 0) return { fair: false, reason: "unpaired phase" };
    if (p > 0 && maxMarks < 2) return { fair: false, reason: "phase needs two marks" };
  }
  return { fair: true, reason: "ok" };
}
