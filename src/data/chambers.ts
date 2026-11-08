/**
 * Chamber puzzles (GDD §17): time frozen; place up to `marks` marks, fire any of the Glyph Blasts (3×3, everything
 * caught dies — Forbidden included), then one Detonate. Win: every Standard dead, no Forbidden killed.
 * Rows are nearest-first, x 0–6; glyphs are Blast centres [x, row] on the void lattice (not tiles — Design Law 1).
 * Each puzzle is proven solvable with `marks` and NOT with `marks − 1` (tests/chambers.test.ts).
 */
export interface ChamberDef {
  id: string;
  name: string;
  rows: readonly string[];
  marks: number;
  glyphs: ReadonlyArray<readonly [number, number]>;
}

export const CHAMBERS: readonly ChamberDef[] = [
  { id: "c01", name: "Two Breaths", rows: ["SSSSSSS", "SSS.SSS", "SSS.SSS"], marks: 1, glyphs: [[1, 1], [5, 1]] },
  { id: "c02", name: "Spared", rows: ["SSF.SSS", "SSS.SSS", "......."], marks: 5, glyphs: [[1, 1], [5, 1]] },
  { id: "c03", name: "Hold Fire", rows: ["..SSS..", "..SFS..", "..SSS.."], marks: 8, glyphs: [[3, 1]] },
  { id: "c04", name: "Overlap", rows: ["SSSS..S", "SSSS...", "SSSS.S."], marks: 2, glyphs: [[1, 1], [2, 1]] },
  { id: "c05", name: "Hollow Heart", rows: ["SSSSSSS", "SSSFSSS", "SSSSSSS"], marks: 2, glyphs: [[1, 1], [5, 1], [3, 1]] },
  { id: "c06", name: "Margins", rows: ["S.SSS.S", "S.SSS.S", "S.SSS.S"], marks: 3, glyphs: [[3, 1], [1, 1]] },
  { id: "c07", name: "Between", rows: ["SS.F.SS", "SS...SS", "SSSSSSS"], marks: 1, glyphs: [[1, 1], [5, 1], [3, 1]] },
  { id: "c08", name: "Last Light", rows: ["FSSSSSF", ".SSSSS.", ".SSSSS."], marks: 6, glyphs: [[1, 1], [5, 1], [3, 1]] }
];

/** Rare-weighted Rune pool for a cleared Chamber (GDD §17). */
export const CHAMBER_RUNES = ["thirdEye", "leap", "absolution", "resonance", "wideBlast", "bedrock"] as const;

export interface ChamberCell {
  x: number;
  row: number;
  forbidden: boolean;
}

export function chamberCells(def: ChamberDef): ChamberCell[] {
  const out: ChamberCell[] = [];
  def.rows.forEach((r, row) => [...r].forEach((ch, x) => ch !== "." && out.push({ x, row, forbidden: ch === "F" })));
  return out;
}

/** Best plan: which Glyphs to fire (bitmask) and which cells to mark. */
export function chamberPlan(def: ChamberDef): { mask: number; marks: ChamberCell[] } | null {
  const cells = chamberCells(def);
  let best: { mask: number; marks: ChamberCell[] } | null = null;
  for (let mask = 0; mask < 1 << def.glyphs.length; mask++) {
    const blasted = (c: ChamberCell) => def.glyphs.some(([gx, gr], i) => mask & (1 << i) && Math.abs(c.x - gx) <= 1 && Math.abs(c.row - gr) <= 1);
    if (cells.some((c) => c.forbidden && blasted(c))) continue;
    const marks = cells.filter((c) => !c.forbidden && !blasted(c));
    if (!best || marks.length < best.marks.length) best = { mask, marks };
  }
  return best;
}

/** Minimum marks needed over every subset of Glyph Blasts; Infinity if no subset avoids the Forbidden. */
export function chamberMinMarks(def: ChamberDef): number {
  const cells = chamberCells(def);
  let best = Infinity;
  for (let mask = 0; mask < 1 << def.glyphs.length; mask++) {
    const blasted = (c: ChamberCell) => def.glyphs.some(([gx, gr], i) => mask & (1 << i) && Math.abs(c.x - gx) <= 1 && Math.abs(c.row - gr) <= 1);
    if (cells.some((c) => c.forbidden && blasted(c))) continue;
    best = Math.min(best, cells.filter((c) => !c.forbidden && !blasted(c)).length);
  }
  return best;
}
