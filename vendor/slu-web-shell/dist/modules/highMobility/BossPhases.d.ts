export interface BossArmorPlate {
    id: string;
    maxHealth: number;
    health: number;
    detached: boolean;
}
export interface BossPhaseDefinition {
    id: string;
    enterAtHealthFraction: number;
    attackRateMultiplier: number;
    moveSpeedMultiplier: number;
    damageMultiplier: number;
}
export interface BossPhaseSnapshot {
    phaseIndex: number;
    phase: BossPhaseDefinition;
    healthFraction: number;
    detachedPlates: string[];
    phaseChanged: boolean;
}
export declare const DEFAULT_BOSS_PHASES: readonly BossPhaseDefinition[];
/**
 * Pure boss phase/armor controller. Consumers decide how detached plates are
 * rendered, simulated and rewarded; this module owns only authoritative state.
 */
export declare class BossPhaseController {
    readonly maxHealth: number;
    readonly phases: readonly BossPhaseDefinition[];
    private phaseIndex;
    private readonly plates;
    constructor(maxHealth: number, plateDefinitions: readonly {
        id: string;
        maxHealth: number;
    }[], phases?: readonly BossPhaseDefinition[]);
    damagePlate(id: string, amount: number): BossArmorPlate | null;
    step(currentHealth: number): BossPhaseSnapshot;
    plateSnapshot(): BossArmorPlate[];
    reset(): void;
}
