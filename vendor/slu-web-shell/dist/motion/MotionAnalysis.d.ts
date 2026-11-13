import type { MotionMarker } from "./types.js";
export interface Vec3Sample {
    time: number;
    x: number;
    y: number;
    z: number;
}
export interface FootPlantWindow {
    foot: "left" | "right";
    start: number;
    end: number;
    confidence: number;
}
export declare function estimateFootPlants(foot: "left" | "right", samples: Vec3Sample[], options?: {
    speedThreshold?: number;
    minDuration?: number;
}): FootPlantWindow[];
export declare function footPlantsToMarkers(windows: FootPlantWindow[], prefix?: string): MotionMarker[];
export interface RootMotionSummary {
    distance: number;
    displacement: {
        x: number;
        y: number;
        z: number;
    };
    averageSpeed: number;
    peakSpeed: number;
}
export declare function summarizeRootMotion(samples: Vec3Sample[]): RootMotionSummary;
