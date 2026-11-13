import type { SimulationSpeed } from "../modules/speed/SimulationSpeed.js";
export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut";
export interface TimeStep {
    /** Feed this to the authoritative simulation. 0 during hitstop. */
    simDt: number;
    /** Feed this to presentation (animation, VFX, camera). Keeps moving during hitstop. */
    presentationDt: number;
    frozen: boolean;
    scale: number;
}
/**
 * Hitstop + slow-mo layered over SimulationSpeed. Gameplay stays deterministic: hitstop freezes the
 * simulation step, while presentation keeps rendering (optionally at `freezePresentation` scale).
 */
export declare class TimeControl {
    private readonly speed?;
    private hitstopLeft;
    private slow;
    /** Presentation speed while frozen (0 = hard freeze, ~0.05 = "animate the freeze"). */
    freezePresentation: number;
    constructor(speed?: SimulationSpeed | undefined);
    hitstop(ms: number): void;
    /** Time scale ramps from `scale` back to 1 over `ms` with the easing curve. */
    slowmo(scale: number, ms: number, easing?: Easing): void;
    get frozen(): boolean;
    currentScale(): number;
    step(realDt: number): TimeStep;
    clear(): void;
}
