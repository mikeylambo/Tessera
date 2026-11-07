import type { StageDef } from "./types";
import s001 from "./001.json";
import s002 from "./002.json";
import s003 from "./003.json";
import s004 from "./004.json";
import s005 from "./005.json";
import s006 from "./006.json";
import s007 from "./007.json";
import s008 from "./008.json";
import s009 from "./009.json";
import s010 from "./010.json";

export type { StageDef } from "./types";

/** Authored stages, in order. v1 target: 1–80 (GDD §18). */
export const STAGES: readonly StageDef[] = [s001, s002, s003, s004, s005, s006, s007, s008, s009, s010] as StageDef[];

export const ACTS = [
  { act: 1, name: "Ground", first: 1, last: 10 },
  { act: 2, name: "Restraint", first: 11, last: 25 },
  { act: 3, name: "Material", first: 26, last: 45 },
  { act: 4, name: "Phase", first: 46, last: 65 },
  { act: 5, name: "Mastery", first: 66, last: 80 }
] as const;

export function stageById(id: number): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}
