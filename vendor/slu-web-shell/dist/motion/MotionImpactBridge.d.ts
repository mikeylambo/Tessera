import type { ImpactRecipe, ImpactRuntimeAdapter, ImpactSpawnContext } from "../impact/types.js";
import type { MotionClip, MotionMarker } from "./types.js";
export interface MotionImpactBinding {
    markerId: string;
    recipeId: string;
}
export declare class MotionImpactBridge {
    private readonly impact;
    private recipes;
    private fired;
    constructor(impact: ImpactRuntimeAdapter);
    register(recipe: ImpactRecipe): void;
    reset(instanceId: string): void;
    update(instanceId: string, clip: MotionClip, previousTime: number, currentTime: number, context?: ImpactSpawnContext): MotionMarker[];
}
