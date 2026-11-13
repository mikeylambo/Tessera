import type { Vec3 } from "./BoostMotion.js";
export type RuntimeEventMap = Record<string, unknown>;
export type RuntimeEventListener<T> = (payload: T) => void;
export declare class RuntimeEventBus<Events extends RuntimeEventMap = RuntimeEventMap> {
    private listeners;
    on<K extends keyof Events>(event: K, listener: RuntimeEventListener<Events[K]>): () => void;
    emit<K extends keyof Events>(event: K, payload: Events[K]): void;
    clear(): void;
}
export declare class ObjectPool<T> {
    private readonly create;
    private readonly reset;
    private free;
    private used;
    constructor(create: () => T, reset?: (item: T) => void, prewarm?: number);
    acquire(): T;
    release(item: T): boolean;
    releaseAll(): void;
    get activeCount(): number;
    get availableCount(): number;
}
export interface SpatialEntry {
    id: string;
    position: Vec3;
    radius?: number;
}
/** XZ spatial hash for broad-phase combat/world queries. */
export declare class SpatialHashXZ<T extends SpatialEntry> {
    readonly cellSize: number;
    private cells;
    private memberships;
    constructor(cellSize?: number);
    upsert(entry: T): void;
    remove(id: string): void;
    queryRadius(position: Vec3, radius: number): T[];
    clear(): void;
}
export declare class HeightField {
    readonly cellSize: number;
    private readonly sampleHeight;
    constructor(cellSize: number, sampleHeight: (gridX: number, gridZ: number) => number);
    heightAt(x: number, z: number): number;
}
export interface PerformanceSnapshot {
    fps: number;
    frameMs: number;
    worstFrameMs: number;
    samples: number;
}
export declare class PerformanceSampler {
    private elapsed;
    private frames;
    private worst;
    private current;
    sample(dtSeconds: number): PerformanceSnapshot | null;
    snapshot(): PerformanceSnapshot;
}
