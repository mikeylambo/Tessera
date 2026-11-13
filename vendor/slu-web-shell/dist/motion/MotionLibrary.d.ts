import type { MotionClip, RigMap } from "./types.js";
export declare class MotionLibrary {
    private readonly rigs;
    private readonly clips;
    registerRig(rig: RigMap): void;
    registerClip(clip: MotionClip): void;
    registerPack(pack: {
        rigs?: RigMap[];
        clips?: MotionClip[];
    }): void;
    getRig(id: string): RigMap | undefined;
    getClip(id: string): MotionClip | undefined;
    listRigs(): RigMap[];
    listClips(tags?: string[]): MotionClip[];
    removeClip(id: string): boolean;
    clear(): void;
}
