import type { ImpactSpawnContext } from "../impact/types.js";
import type { MotionImpactBridge } from "./MotionImpactBridge.js";
import type { MotionClip, MotionPlayOptions } from "./types.js";
export interface MotionPlayerHooks {
    onMarker?(instanceId: string, clip: MotionClip, markerId: string): void;
    onComplete?(instanceId: string, clip: MotionClip): void;
    onTime?(instanceId: string, clip: MotionClip, timeSeconds: number): void;
}
export declare class MotionPlayer {
    private readonly bridge?;
    private readonly hooks;
    private readonly active;
    constructor(bridge?: MotionImpactBridge | undefined, hooks?: MotionPlayerHooks);
    play(entityId: string, clip: MotionClip, options?: MotionPlayOptions, context?: ImpactSpawnContext): string;
    stop(instanceId: string): void;
    setSpeed(instanceId: string, speed: number): void;
    seek(instanceId: string, timeSeconds: number): void;
    update(deltaSeconds: number): void;
    getTime(instanceId: string): number | undefined;
    getActiveCount(): number;
}
