import { ImpactLibrary } from "../impact/ImpactLibrary.js";
import type { ImpactRuntimeAdapter, ImpactSpawnContext } from "../impact/types.js";
import { MotionLibrary } from "./MotionLibrary.js";
import { MotionImpactBridge } from "./MotionImpactBridge.js";
import { MotionPlayer } from "./MotionPlayer.js";
import { MoveLibrary, type MoveAsset } from "./MoveAsset.js";
import type { MotionImpactPackage } from "./package.js";
import type { MotionPlayOptions } from "./types.js";
export declare class MotionImpactRuntime {
    private readonly impactRuntime;
    readonly motions: MotionLibrary;
    readonly impacts: ImpactLibrary;
    readonly moves: MoveLibrary;
    readonly bridge: MotionImpactBridge;
    readonly player: MotionPlayer;
    constructor(impactRuntime: ImpactRuntimeAdapter);
    registerPackage(pkg: MotionImpactPackage): void;
    registerMove(move: MoveAsset): void;
    playMove(entityId: string, moveId: string, options?: MotionPlayOptions, context?: ImpactSpawnContext): string;
    stop(instanceId: string): void;
    update(deltaSeconds: number): void;
}
