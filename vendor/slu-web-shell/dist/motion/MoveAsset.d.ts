import type { ImpactSpawnContext } from "../impact/types.js";
import type { MotionPlayOptions } from "./types.js";
export interface MoveAsset {
    id: string;
    clipId: string;
    targetRigId?: string;
    defaultPlayback?: MotionPlayOptions;
    defaultImpactContext?: ImpactSpawnContext;
    tags?: string[];
    metadata?: Record<string, unknown>;
}
export interface MoveLibraryPack {
    moves: MoveAsset[];
}
export declare class MoveLibrary {
    private readonly moves;
    register(move: MoveAsset): void;
    registerPack(pack: MoveLibraryPack): void;
    get(id: string): MoveAsset | undefined;
    list(tags?: string[]): MoveAsset[];
}
