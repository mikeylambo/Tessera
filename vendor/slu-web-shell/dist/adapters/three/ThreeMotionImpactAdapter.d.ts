import type { ImpactRecipe, ImpactSpawnContext } from "../../impact/types.js";
import type { MotionClip, MotionPlayOptions, RigMap } from "../../motion/types.js";
import type { ImpactRuntimeAdapter } from "../../impact/types.js";
export interface ThreeMotionHost {
    loadRig?(rig: RigMap): Promise<void> | void;
    playAnimation(entityId: string, assetUri: string, clipId: string, options: MotionPlayOptions): string;
    stopAnimation(hostInstanceId: string): void;
    seekAnimation?(hostInstanceId: string, timeSeconds: number): void;
    setAnimationSpeed?(hostInstanceId: string, speed: number): void;
}
export declare class ThreeMotionRuntimeAdapter {
    private readonly host;
    private readonly bridge;
    private readonly player;
    private readonly instances;
    private readonly rigs;
    private readonly recipes;
    constructor(host: ThreeMotionHost, impact: ImpactRuntimeAdapter);
    registerImpact(recipe: ImpactRecipe): void;
    loadRig(rig: RigMap): Promise<void> | void;
    playClip(entityId: string, clip: MotionClip, options?: MotionPlayOptions, context?: ImpactSpawnContext): string;
    stopClip(instanceId: string): void;
    seek(instanceId: string, timeSeconds: number): void;
    setPlaybackSpeed(instanceId: string, speed: number): void;
    update(deltaSeconds: number): void;
}
