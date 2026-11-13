import type { MotionImpactPackage } from "../../motion/package.js";
import type { AdapterArtifact, MotionImpactAdapterOptions, MotionImpactEngineAdapter } from "../MotionImpactAdapter.js";
export interface BlenderMotionJob {
    sourceFile: string;
    targetRigObject?: string;
    sourceArmatureObject?: string;
    actionName?: string;
    outputGlb?: string;
    applyRootMotion?: boolean;
    targetFps?: number;
}
export declare function createBlenderMotionJobScript(job: BlenderMotionJob): string;
export declare class BlenderMotionPipelineAdapter implements MotionImpactEngineAdapter {
    readonly id = "blender-motion";
    readonly displayName = "Blender Motion Pipeline";
    exportPackage(pkg: MotionImpactPackage, options?: MotionImpactAdapterOptions): AdapterArtifact[];
}
