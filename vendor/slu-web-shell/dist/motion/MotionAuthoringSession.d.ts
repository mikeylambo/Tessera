import type { ImpactRecipe } from "../impact/types.js";
import { type MotionImpactPackage } from "./package.js";
import type { MotionClip, MotionMarker, MotionMarkerKind, RigMap } from "./types.js";
export declare class MotionAuthoringSession {
    readonly id: string;
    private readonly rigs;
    private readonly clips;
    private readonly impacts;
    constructor(id: string);
    addRig(rig: RigMap): this;
    addClip(clip: MotionClip): this;
    addImpact(recipe: ImpactRecipe): this;
    addMarker(clipId: string, marker: MotionMarker): this;
    createMarker(clipId: string, input: {
        id: string;
        at: number;
        kind: MotionMarkerKind;
        recipeId?: string;
        payload?: Record<string, unknown>;
    }): this;
    removeMarker(clipId: string, markerId: string): boolean;
    bindImpact(clipId: string, markerId: string, recipeId: string): this;
    setRootMotion(clipId: string, rootMotion: MotionClip["rootMotion"]): this;
    setTargetRig(clipId: string, rigId: string): this;
    getClip(clipId: string): MotionClip;
    export(metadata?: Record<string, unknown>): MotionImpactPackage;
    private requireClip;
}
