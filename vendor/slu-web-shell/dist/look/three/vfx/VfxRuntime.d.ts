import * as THREE from "three";
import type { TunableRegistry } from "../../../tuning/Tunables.js";
import type { Palette } from "../../palette.js";
import { ParticlePool } from "./ParticlePool.js";
import { type VfxPreset } from "./presets.js";
export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}
export interface VfxPlayOptions {
    position?: Vec3Like;
    direction?: Vec3Like;
    scale?: number;
    /** Palette token or hex overriding the effect's main color. */
    tint?: string;
    /** Second endpoint (lightning, beam). */
    end?: Vec3Like;
    /** Object to wrap/follow (aura, trail socket). */
    target?: THREE.Object3D;
    /** Aura intensity level 1–3. */
    level?: number;
    /** Lightning: keep re-rolling until stop(). */
    sustain?: boolean;
}
export interface VfxHandle {
    readonly id: string;
    readonly alive: boolean;
    set(options: Partial<VfxPlayOptions>): void;
    /** Graceful end (beam/portal close, aura fade). */
    stop(): void;
    /** Charge-up release: fires the payoff burst and ends. */
    release(): void;
}
export interface VfxAccessibility {
    flashes: number;
    reducedMotion: boolean;
}
/**
 * Pooled VFX runtime: one GPU particle draw plus fixed pools of mesh effects. Nothing is allocated
 * during play; exhausted pools steal their oldest instance.
 */
export declare class VfxRuntime {
    private readonly scene;
    camera: THREE.Camera;
    private readonly palette;
    readonly particles: ParticlePool;
    readonly root: THREE.Group<THREE.Object3DEventMap>;
    readonly time: THREE.IUniform<number>;
    readonly presets: Map<string, VfxPreset>;
    accessibility: VfxAccessibility;
    /** Screen-space distortion hook (LookKit routes it to the post stack). */
    onDistort: ((world: THREE.Vector3, strength: number, life: number) => void) | null;
    private readonly params;
    private readonly active;
    private readonly pools;
    private readonly ribbons;
    private readonly lights;
    private nextId;
    constructor(scene: THREE.Scene, camera: THREE.Camera, palette: Palette, registry: TunableRegistry, presets?: readonly VfxPreset[], capacity?: number);
    ids(): string[];
    play(id: string, opts?: VfxPlayOptions): VfxHandle;
    update(dt: number): void;
    activeCount(): number;
    stopAll(): void;
    private col;
    private main;
    private num;
    private spawn;
    private pool;
    private take;
    private give;
    private createRibbon;
    private takeRibbon;
    /** Rebuild camera-facing ribbon vertices from points (segment 0 = newest/start). */
    private buildRibbon;
    private flashLight;
    private glow;
    private sparks;
    private orient;
    private start;
}
/** Arc strip from inner→outer radius; uv.x along the arc, uv.y across. */
export declare function arcGeometry(outer: number, inner: number, theta: number, segments: number): THREE.BufferGeometry;
