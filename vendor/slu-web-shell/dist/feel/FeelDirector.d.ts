import { ImpactPlayer } from "../impact/ImpactPlayer.js";
import type { ImpactSpawnContext, ImpactVector3 } from "../impact/types.js";
import { type TunableRegistry } from "../tuning/Tunables.js";
import type { SimulationSpeed } from "../modules/speed/SimulationSpeed.js";
import { TimeControl, type Easing, type TimeStep } from "./TimeControl.js";
import { TraumaShake } from "./TraumaShake.js";
import { Rumble } from "./Rumble.js";
/** Data preset for one semantic impact. Tuning the bundle tunes the whole game's feel at once. */
export interface ImpactBundle {
    id: string;
    hitstopMs?: number;
    trauma?: number;
    slowmo?: {
        scale: number;
        ms: number;
        easing?: Easing;
    };
    vfx?: Array<{
        id: string;
        scale?: number;
        at?: number;
    }>;
    post?: Array<{
        id: string;
        amount: number;
        at?: number;
    }>;
    audio?: string;
    rumble?: {
        strength: number;
        ms: number;
    };
    flash?: {
        token: string;
        amount: number;
    };
}
export declare const SLU_IMPACT_BUNDLES: readonly ImpactBundle[];
/** Where an impact goes. Every sink is optional; gameplay only calls feel.impact(id, context). */
export interface FeelSinks {
    vfx?: (id: string, ctx: {
        position?: ImpactVector3;
        direction?: ImpactVector3;
        scale: number;
    }) => void;
    post?: (id: string, amount: number) => void;
    audio?: (event: string, ctx: ImpactSpawnContext) => void;
    flash?: (token: string, amount: number) => void;
}
export interface FeelAccessibility {
    screenShake: number;
    flashes: number;
    vibration: boolean;
    reducedMotion: boolean;
}
/**
 * Game-feel kit facade: hitstop, slow-mo, trauma shake, rumble, screen flash and impact bundles,
 * built on the salvaged ImpactPlayer so cues stay timeline-driven and deterministic.
 */
export declare class FeelDirector {
    sinks: FeelSinks;
    readonly time: TimeControl;
    readonly shake: TraumaShake;
    readonly rumbler: Rumble;
    readonly player: ImpactPlayer;
    readonly bundles: Map<string, ImpactBundle>;
    private readonly tuned;
    private readonly ctx;
    accessibility: FeelAccessibility;
    constructor(sinks?: FeelSinks, options?: {
        registry?: TunableRegistry;
        speed?: SimulationSpeed;
        bundles?: readonly ImpactBundle[];
    });
    /** Register a bundle; its scalar knobs become tunables under feel.impact.<id>. */
    define(bundle: ImpactBundle, registry?: TunableRegistry): void;
    /** One semantic call: hitstop + shake + VFX + post pulse + audio event + rumble + flash. */
    impact(id: string, context?: ImpactSpawnContext): string | null;
    hitstop(ms: number): void;
    slowmo(scale: number, ms: number, easing?: Easing): void;
    addTrauma(amount: number): void;
    rumble(strength: number, ms: number): void;
    /** Advance one real frame. Returns the time step to feed simulation vs presentation. */
    step(realDt: number): TimeStep;
    private recipe;
    private dispatch;
}
