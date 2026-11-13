import { type TunableRegistry } from "../tuning/Tunables.js";
export interface CameraVec3 {
    x: number;
    y: number;
    z: number;
}
type Vec3 = CameraVec3;
export type CameraMode = "follow2d" | "springArm" | "firstPerson" | "arena";
export interface CameraFrame {
    position: Vec3;
    target: Vec3;
    fov: number;
    roll: number;
}
export interface CameraRigInput {
    /** Followed subject (eye position for first person). */
    target: Vec3;
    velocity?: Vec3;
    /** Radians. Third/first person orbit. */
    yaw?: number;
    pitch?: number;
    /** Arena framing subjects. */
    targets?: readonly Vec3[];
    /** Collision probe for the spring arm: distance to first hit from→to, or null. */
    probe?: (from: Vec3, to: Vec3) => number | null;
    /** Viewport aspect (arena framing). */
    aspect?: number;
}
/** Frame-rate independent exponential smoothing factor. */
export declare const damp: (rate: number, dt: number) => number;
/**
 * One camera rig, four commercially proven modes, blended on mode change.
 * Renderer-neutral: outputs a CameraFrame; `applyCameraFrame` (look/three) maps it onto THREE cameras.
 */
export declare class CameraRig {
    mode: CameraMode;
    readonly follow2d: import("../index.js").TunableValues<{
        deadZoneX: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        deadZoneY: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        lookAhead: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        smoothing: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        distance: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        height: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        fov: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
    }>;
    readonly springArm: import("../index.js").TunableValues<{
        distance: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        height: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        lag: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        pullIn: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        pullOut: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        collisionMargin: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        fov: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        shoulder: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
    }>;
    readonly firstPerson: import("../index.js").TunableValues<{
        fov: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        fovKickDecay: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        dipStiffness: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        dipDamping: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
    }>;
    readonly arena: import("../index.js").TunableValues<{
        pitchDeg: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        padding: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        minDistance: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        maxDistance: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        smoothing: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        fov: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        boundsMinX: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        boundsMaxX: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        boundsMinZ: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        boundsMaxZ: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
    }>;
    readonly frame: CameraFrame;
    private readonly raw;
    private from;
    private blendT;
    private blendDur;
    private focus;
    private armDist;
    private fovKick;
    private dip;
    private dipVel;
    private initialized;
    constructor(registry?: TunableRegistry);
    /** Switch mode; the transition blends from the current frame over `blendMs`. */
    setMode(mode: CameraMode, blendMs?: number): void;
    /** First-person FOV kick in degrees (sprint, dash, fire). */
    kickFov(deg: number): void;
    /** Landing dip (metres of downward impulse velocity). */
    landingDip(amount: number): void;
    /** Snap without smoothing (spawn, teleport, cut). */
    snap(): void;
    update(dt: number, input: CameraRigInput): CameraFrame;
}
export {};
