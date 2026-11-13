import type { HumanoidBone, RigMap } from "./types.js";
export interface RigValidationReport {
    valid: boolean;
    missingRequired: HumanoidBone[];
    duplicateBoneNames: string[];
    warnings: string[];
    mappedCount: number;
    requiredCount: number;
    coverage: number;
}
export declare function inferHumanoidMap(boneNames: string[]): Partial<Record<HumanoidBone, string>>;
export declare function buildRigMapFromBones(id: string, boneNames: string[], rootBone?: string): RigMap;
export declare function validateRigMap(rig: RigMap): RigValidationReport;
