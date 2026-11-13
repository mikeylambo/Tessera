import { type TunableRegistry } from "../tuning/Tunables.js";
export interface ShakeOffset {
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
    roll: number;
}
/**
 * Trauma shake: amount = trauma², sampled from Perlin noise on six channels, with linear decay.
 * Scaled by the accessibility screen-shake setting (0 disables it entirely).
 */
export declare class TraumaShake {
    readonly tune: import("../index.js").TunableValues<{
        maxTranslate: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        maxRotateDeg: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        frequency: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        decay: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
        exponent: {
            min: number;
            max: number;
            step: number;
            default: number;
        };
    }>;
    trauma: number;
    /** Accessibility multiplier (settings.screenShake). */
    scale: number;
    readonly offset: ShakeOffset;
    private t;
    constructor(registry?: TunableRegistry, group?: string);
    add(amount: number): void;
    update(dt: number): ShakeOffset;
}
