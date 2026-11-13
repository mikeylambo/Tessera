import type { HumanoidBone, RetargetRequest } from "./types.js";
export interface BoneRetargetBinding {
    semantic: HumanoidBone;
    sourceBone: string;
    targetBone: string;
}
export interface RetargetPlan {
    sourceRigId: string;
    targetRigId: string;
    bindings: BoneRetargetBinding[];
    sourceOnly: HumanoidBone[];
    targetOnly: HumanoidBone[];
    requiredMissing: HumanoidBone[];
    scaleRatio: number;
    preserveRootMotion: boolean;
    preserveFootPlants: boolean;
    warnings: string[];
}
export declare function createRetargetPlan(request: RetargetRequest): RetargetPlan;
