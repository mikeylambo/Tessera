import type { ImpactRecipe } from "../impact/types.js";
import type { MotionClip, RigMap } from "./types.js";
export interface MotionImpactPackage {
    schema: "slu-motion-impact";
    version: 1;
    id: string;
    rigs: RigMap[];
    clips: MotionClip[];
    impacts: ImpactRecipe[];
    metadata?: Record<string, unknown>;
}
export interface PackageValidationIssue {
    severity: "error" | "warning";
    path: string;
    message: string;
}
export interface PackageValidationReport {
    valid: boolean;
    issues: PackageValidationIssue[];
}
export declare function validateMotionImpactPackage(pkg: MotionImpactPackage): PackageValidationReport;
export declare function createMotionImpactPackage(input: Omit<MotionImpactPackage, "schema" | "version">): MotionImpactPackage;
