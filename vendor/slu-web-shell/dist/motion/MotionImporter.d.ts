import type { MotionImportRequest, MotionImportResult } from "./types.js";
export interface MotionProbeResult {
    duration: number;
    fps?: number;
    boneNames?: string[];
    rootBone?: string;
    clipName?: string;
    metadata?: Record<string, unknown>;
}
export interface MotionAssetProbe {
    probe(request: MotionImportRequest): Promise<MotionProbeResult>;
}
export declare class MotionImporter {
    private readonly probe;
    constructor(probe: MotionAssetProbe);
    import(request: MotionImportRequest): Promise<MotionImportResult>;
}
