import type { MotionImpactPackage } from "../motion/package.js";
import type { MotionClip, RetargetRequest, RetargetResult, RigMap } from "../motion/types.js";
import type { ImpactRecipe } from "../impact/types.js";
export interface AdapterArtifact {
    path: string;
    content: string;
    kind: "manifest" | "script" | "resource" | "config" | "documentation";
}
export interface MotionImpactAdapterOptions {
    packageName?: string;
    animationPlayerPath?: string;
    skeletonPath?: string;
    rootMotion?: boolean;
}
export interface MotionImpactEngineAdapter {
    readonly id: string;
    readonly displayName: string;
    exportPackage(pkg: MotionImpactPackage, options?: MotionImpactAdapterOptions): AdapterArtifact[];
    exportRig?(rig: RigMap, options?: MotionImpactAdapterOptions): AdapterArtifact[];
    exportClip?(clip: MotionClip, options?: MotionImpactAdapterOptions): AdapterArtifact[];
    exportImpact?(recipe: ImpactRecipe, options?: MotionImpactAdapterOptions): AdapterArtifact[];
    retarget?(request: RetargetRequest): Promise<RetargetResult>;
}
