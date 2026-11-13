import type { ImpactCue } from "./types.js";
export interface ResolvedImpactVariation {
    scale: number;
    rotationDegrees: number;
    pitch: number;
    intensity: number;
}
export declare function resolveImpactVariation(cue: Pick<ImpactCue, "id" | "variation">, seed?: number, salt?: string): ResolvedImpactVariation;
