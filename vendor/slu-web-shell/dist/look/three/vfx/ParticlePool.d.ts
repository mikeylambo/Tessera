import * as THREE from "three";
/** Particle shapes understood by the GPU particle shader. */
export declare const enum ParticleShape {
    Glow = 0,
    Spark = 1,
    Smoke = 2,
    Ring = 3,
    Fire = 4
}
export interface ParticleSpawn {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    size0: number;
    size1: number;
    color0: THREE.Color;
    color1: THREE.Color;
    alpha?: number;
    /** 1 = additive glow, 0 = alpha-blended (smoke). Premultiplied blend handles both in one draw. */
    additive?: number;
    gravity?: number;
    drag?: number;
    shape?: ParticleShape;
    stretch?: number;
    delay?: number;
}
/**
 * One instanced draw for every particle in the game. Motion is evaluated on the GPU from spawn
 * parameters, so the CPU only writes a ring-buffer slot on spawn: zero allocation during play.
 */
export declare class ParticlePool {
    readonly capacity: number;
    readonly mesh: THREE.Mesh;
    readonly uniforms: {
        uTime: {
            value: number;
        };
        uFlashCap: {
            value: number;
        };
    };
    private cursor;
    private readonly a;
    private dirtyMin;
    private dirtyMax;
    constructor(capacity?: number);
    spawn(s: ParticleSpawn, time: number): void;
    /** Upload only the touched instance range once per frame. */
    flush(): void;
    /** Living particles (approximate, for stats). */
    alive(time: number): number;
}
