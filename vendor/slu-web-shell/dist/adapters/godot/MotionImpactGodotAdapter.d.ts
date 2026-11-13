import type { ImpactRecipe } from "../../impact/types.js";
import type { MotionImpactPackage } from "../../motion/package.js";
import type { MotionClip, RigMap } from "../../motion/types.js";
import type { AdapterArtifact, MotionImpactAdapterOptions, MotionImpactEngineAdapter } from "../MotionImpactAdapter.js";
export interface GodotMotionImpactManifest {
    version: 1;
    packageId?: string;
    rigs: RigMap[];
    clips: MotionClip[];
    impacts: ImpactRecipe[];
    importHints: {
        animationPlayerNode: string;
        skeletonNode: string;
        useRootMotion: boolean;
        markerSignal: string;
    };
}
export declare function createGodotMotionImpactManifest(input: {
    packageId?: string;
    rigs?: RigMap[];
    clips?: MotionClip[];
    impacts?: ImpactRecipe[];
    useRootMotion?: boolean;
    animationPlayerNode?: string;
    skeletonNode?: string;
}): GodotMotionImpactManifest;
export declare function godotMarkerMethodTrack(clip: MotionClip): Array<{
    time: number;
    method: string;
    args: unknown[];
}>;
export declare function generateGodotRuntimeBridge(): string;
export declare function generateGodotImportGuide(manifestPath?: string): string;
export declare class GodotMotionImpactAdapter implements MotionImpactEngineAdapter {
    readonly id = "godot-4";
    readonly displayName = "Godot 4";
    exportPackage(pkg: MotionImpactPackage, options?: MotionImpactAdapterOptions): AdapterArtifact[];
}
