import type { Vec3 } from "./BoostMotion.js";
export interface StreamCellId {
    x: number;
    z: number;
}
export interface StreamCellContext {
    id: StreamCellId;
    key: string;
    center: Vec3;
    detail: "full" | "far";
}
export interface StreamedWorldHooks {
    load(cell: StreamCellContext): void;
    unload(cell: StreamCellContext): void;
}
export interface WorldStreamingTuning {
    cellSize: number;
    fullRadiusCells: number;
    farRadiusCells: number;
    velocityBiasSeconds: number;
}
export declare const DEFAULT_WORLD_STREAMING_TUNING: WorldStreamingTuning;
/**
 * Renderer-neutral streamed grid manager. The load center is biased in the
 * travel direction so high-speed movement cannot trivially outrun cell loads.
 */
export declare class StreamedWorldGrid {
    tuning: WorldStreamingTuning;
    private readonly hooks;
    private loaded;
    constructor(tuning: WorldStreamingTuning | undefined, hooks: StreamedWorldHooks);
    update(position: Vec3, velocity: Vec3): {
        loaded: string[];
        unloaded: string[];
    };
    clear(): void;
    snapshot(): StreamCellContext[];
}
