import type { TunableSchema } from "../../../tuning/Tunables.js";
/**
 * Effect presets are data: semantic id → kind + tunable schema (defaults). Tuned values save to
 * tuning/vfx.<id>.json like any other group, so a game can re-skin every effect without code.
 */
export interface VfxPreset {
    id: string;
    kind: VfxKind;
    sustained: boolean;
    params: TunableSchema;
}
export type VfxKind = "lightning" | "slash" | "burst" | "charge" | "trail" | "explosion" | "shockwave" | "beam" | "aura" | "portal" | "smoke";
export declare const SLU_VFX_PRESETS: readonly VfxPreset[];
