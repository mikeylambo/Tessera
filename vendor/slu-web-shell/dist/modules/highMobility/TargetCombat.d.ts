import type { Vec3 } from "./BoostMotion.js";
export interface TargetCandidate {
    id: string;
    position: Vec3;
    velocity?: Vec3;
    radius?: number;
    alive?: boolean;
    priority?: number;
}
export interface TargetSelectionTuning {
    maxRange: number;
    softLockCone: number;
    centerWeight: number;
    distanceWeight: number;
    priorityWeight: number;
}
export declare const DEFAULT_TARGET_SELECTION_TUNING: TargetSelectionTuning;
export interface BreakState {
    health: number;
    impact: number;
    maxImpact: number;
    brokenFor: number;
    recentHitFor: number;
}
export interface BreakTuning {
    breakDuration: number;
    vulnerableMultiplier: number;
    impactDecayPerSecond: number;
    impactDecayDelay: number;
}
export declare const DEFAULT_BREAK_TUNING: BreakTuning;
export interface DamageResult {
    state: BreakState;
    damageApplied: number;
    broke: boolean;
}
/**
 * Pure targeting helpers. Consumers decide visibility/occlusion and provide only
 * candidates that are currently targetable. This keeps the shell independent
 * of any renderer, physics library or scene graph.
 */
export declare class TargetCombatController {
    targetTuning: TargetSelectionTuning;
    breakTuning: BreakTuning;
    hardLockId: string | null;
    constructor(targetTuning?: TargetSelectionTuning, breakTuning?: BreakTuning);
    chooseSoftTarget(origin: Vec3, forward: Vec3, candidates: TargetCandidate[]): TargetCandidate | null;
    setHardLock(candidate: TargetCandidate | null): string | null;
    resolveHardLock(candidates: TargetCandidate[]): TargetCandidate | null;
    cycleHardLock(origin: Vec3, forward: Vec3, candidates: TargetCandidate[], direction?: number): TargetCandidate | null;
    leadAim(origin: Vec3, target: TargetCandidate, projectileSpeed: number, maxLeadSeconds?: number): Vec3;
    stepBreak(state: BreakState, dtSeconds: number): BreakState;
    applyDamage(state: BreakState, damage: number, impact: number): DamageResult;
    private setAndReturn;
}
