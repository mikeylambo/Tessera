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

/** Act VI · The Turn (Finale update, GDD §18/§39). Stage 81 is the Phase 0 Turn prototype: reachable via ?stage=81, not in v1 stage select. */
export const FINALE = { act: 6, name: "The Turn", first: 81, last: 100 } as const;

/** Stages shipped in v1 (Acts I–V). */
export const V1_STAGES: readonly StageDef[] = STAGES.filter((s) => s.id <= 80);

export function stageById(id: number): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}

export function actOf(id: number): (typeof ACTS)[number] {
  return ACTS.find((a) => id >= a.first && id <= a.last) ?? ACTS[0];
}
