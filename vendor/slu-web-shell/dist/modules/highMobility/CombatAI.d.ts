import type { Vec3 } from "./BoostMotion.js";
export type HighMobilityAIState = "idle" | "acquire" | "approach" | "strafe" | "attack" | "evade" | "recover" | "retreat" | "broken";
export interface EnemyArchetypeProfile {
    id: string;
    maxHealth: number;
    maxImpact: number;
    moveSpeed: number;
    preferredRange: number;
    rangeTolerance: number;
    aggression: number;
    evasion: number;
    canFly?: boolean;
}
export interface AIObservation {
    selfPosition: Vec3;
    targetPosition?: Vec3;
    distanceToTarget?: number;
    lineOfSight: boolean;
    incomingThreat: boolean;
    broken: boolean;
    healthFraction: number;
    attackReady: boolean;
}
export interface AICommand {
    state: HighMobilityAIState;
    move: "hold" | "approach" | "strafe" | "retreat" | "evade";
    attack: boolean;
}
/** Deterministic nine-state combat FSM. Rendering/nav implementation stays in the consumer. */
export declare class HighMobilityEnemyBrain {
    readonly profile: EnemyArchetypeProfile;
    state: HighMobilityAIState;
    stateTime: number;
    constructor(profile: EnemyArchetypeProfile);
    reset(): void;
    step(observation: AIObservation, dtSeconds: number): AICommand;
    private transition;
}
export declare const DEFAULT_MECH_ARCHETYPES: readonly EnemyArchetypeProfile[];
