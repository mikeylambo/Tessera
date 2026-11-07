/**
 * Endless/Daily formations (GDD §16): authored 7-wide row strings, seed-selected and randomly mirrored,
 * never free-generated. Rows are listed nearest-first (row 0 arrives first).
 *   .  empty      S  Stone      A  Advantage   F  Forbidden
 *   G  Glass      I  Iron       P  Phase half (adjacent P pairs in a row are one Phase cube)
 */
export interface FormationDef {
  id: string;
  band: 1 | 2 | 3 | 4;
  rows: readonly string[];
}

const f = (band: FormationDef["band"], id: string, ...rows: string[]): FormationDef => ({ id, band, rows });

export const FORMATIONS: readonly FormationDef[] = [
  // Band 1 — Sectors 1–2: Stone 70 / Adv 15 / Forbidden 15; 2–3 rows
  f(1, "b1-gate", "S.S.S.S", "...A..."),
  f(1, "b1-pair", ".SS.SS.", "..F...."),
  f(1, "b1-wedge", "...S...", "..S.S..", ".S.A.S."),
  f(1, "b1-split", "SS...SS", "...F..."),
  f(1, "b1-lane", "S.....S", ".S...S.", "..SAS.."),
  f(1, "b1-tooth", ".S.S.S.", "S.F.S.."),
  f(1, "b1-veil", "..SSS..", "F.....F"),
  f(1, "b1-step", "S......", ".S.....", "..S.A.."),
  f(1, "b1-stair", "......S", ".....S.", "..A.S.."),
  f(1, "b1-ring", ".S...S.", "S..F..S"),
  f(1, "b1-crown", "S.SAS.S"),
  f(1, "b1-hold", ".SF.FS.", "...S..."),
  f(1, "b1-arrow", "...S...", "..SAS..", "...F..."),
  f(1, "b1-scatter", "S...S..", "..S...S", ".F....."),
  // Band 2 — Sectors 3–5: + Glass, Iron; 3–4 rows
  f(2, "b2-glassline", "G.G.G.G", "...S...", "..F.A.."),
  f(2, "b2-anvil", "...I...", "..S.S..", ".G...G.", "F.....F"),
  f(2, "b2-mirror", "SG...GS", "...F...", ".S.A.S."),
  f(2, "b2-forge", "S..I..S", ".F...F.", "..SAS.."),
  f(2, "b2-shards", ".G.G.G.", "S.....S", "..F.S.."),
  f(2, "b2-wall", "SSF.FSS", "...A...", ".G...G."),
  f(2, "b2-ladder", "S.....G", ".S...G.", "..IA...", "...F..."),
  f(2, "b2-vault", "..GIG..", "F.....F", "..SAS.."),
  f(2, "b2-hook", "G......", "GS.....", ".SF.A..", "...S..S"),
  f(2, "b2-cross", "...S...", ".SFAFS.", "...I..."),
  // Band 3 — Sectors 6–9: + Phase; 3–5 rows
  f(3, "b3-twins", ".PP.PP.", "...F...", "S.G.G.S"),
  f(3, "b3-tether", "PP...PP", "..SIS..", ".F...F.", "...A..."),
  f(3, "b3-gauntlet", "S.F.F.S", ".G...G.", "..PP...", "I.....A"),
  f(3, "b3-ribs", "I.S.S.I", "...F...", ".PP.G..", "..A...S"),
  f(3, "b3-prism", "..GGG..", ".F...F.", "PP...PP", "...S..."),
  f(3, "b3-cage", "F.S.S.F", ".I...I.", "..PPA..", "S.....S"),
  f(3, "b3-dunes", "S..G..S", ".PP.PP.", "F.....F", "..SAS..", "...I..."),
  f(3, "b3-fork", "...PP..", "..S..S.", ".F.A.F.", "G.....G"),
  // Band 4 — Sectors 10+: full mix; 4–6 rows
  f(4, "b4-cathedral", "S.PP..S", ".F...F.", "..IAI..", "G.....G", "...F..."),
  f(4, "b4-labyrinth", "SF...FS", "..PP...", "G..I..G", ".F.A.F.", "S.....S"),
  f(4, "b4-tide", "GGG.GGG", "...F...", ".SPPS..", "I.....I", "..A.F..", "S.....S"),
  f(4, "b4-spine", "...I...", "F.S.S.F", ".PP.PP.", "..GAG..", "S..F..S"),
  f(4, "b4-maw", "S.....S", ".SF.FS.", "..PPA..", "I.....I", ".G.F.G."),
  f(4, "b4-hourglass", "SS...SS", "..F.F..", "...I...", "..PPA..", ".G...G.", "S.....S"),
  f(4, "b4-cipher", "G.S.S.G", "F.....F", ".I.A.I.", "..PP...", "S.F...S"),
  f(4, "b4-chorus", ".PP.PP.", "S..F..S", "..GIG..", ".F.A.F.", "S.....S")
];

/** Known-fair fallbacks per band (used if 8 rerolls fail — GDD §19). */
export const FALLBACK: Readonly<Record<FormationDef["band"], string>> = {
  1: "b1-gate",
  2: "b2-mirror",
  3: "b3-fork",
  4: "b4-cathedral"
};

export function bandForSector(sector: number): FormationDef["band"] {
  if (sector <= 2) return 1;
  if (sector <= 5) return 2;
  if (sector <= 9) return 3;
  return 4;
}

/** Gap between formations in ticks by band (GDD §19 table). */
export const BAND_GAP: Readonly<Record<FormationDef["band"], number>> = { 1: 4, 2: 4, 3: 4, 4: 3 };

export function mirrorRow(row: string): string {
  return [...row].reverse().join("");
}
