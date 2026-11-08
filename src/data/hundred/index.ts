import type { StageDef } from "./types";

export type { StageDef } from "./types";

const modules = import.meta.glob<{ default: StageDef }>("./[0-9][0-9][0-9].json", { eager: true });

/** Authored stages, in order (GDD §18; v1 target 1–80). Files: src/data/hundred/NNN.json (Act II–V from tools/stages/author.py). */
export const STAGES: readonly StageDef[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.id - b.id);

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

export function actOf(id: number): (typeof ACTS)[number] {
  return ACTS.find((a) => id >= a.first && id <= a.last) ?? ACTS[0];
}
