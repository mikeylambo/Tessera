export const DEFAULT_BOSS_PHASES = [
    { id: "phase-1", enterAtHealthFraction: 1, attackRateMultiplier: 1, moveSpeedMultiplier: 1, damageMultiplier: 1 },
    { id: "phase-2", enterAtHealthFraction: 0.6, attackRateMultiplier: 1.18, moveSpeedMultiplier: 1.08, damageMultiplier: 1.12 },
    { id: "phase-3", enterAtHealthFraction: 0.25, attackRateMultiplier: 1.38, moveSpeedMultiplier: 1.18, damageMultiplier: 1.28 }
];
/**
 * Pure boss phase/armor controller. Consumers decide how detached plates are
 * rendered, simulated and rewarded; this module owns only authoritative state.
 */
export class BossPhaseController {
    maxHealth;
    phases;
    phaseIndex = 0;
    plates = new Map();
    constructor(maxHealth, plateDefinitions, phases = DEFAULT_BOSS_PHASES) {
        this.maxHealth = maxHealth;
        this.phases = phases;
        if (maxHealth <= 0)
            throw new Error("Boss maxHealth must be positive");
        if (!phases.length)
            throw new Error("Boss requires at least one phase");
        for (const plate of plateDefinitions) {
            this.plates.set(plate.id, { ...plate, health: plate.maxHealth, detached: false });
        }
    }
    damagePlate(id, amount) {
        const plate = this.plates.get(id);
        if (!plate || plate.detached)
            return plate ? { ...plate } : null;
        plate.health = Math.max(0, plate.health - Math.max(0, amount));
        if (plate.health <= 0)
            plate.detached = true;
        return { ...plate };
    }
    step(currentHealth) {
        const healthFraction = Math.max(0, Math.min(1, currentHealth / this.maxHealth));
        let nextIndex = 0;
        for (let i = 0; i < this.phases.length; i++) {
            const phase = this.phases[i];
            if (phase && healthFraction <= phase.enterAtHealthFraction)
                nextIndex = i;
        }
        const phaseChanged = nextIndex !== this.phaseIndex;
        this.phaseIndex = nextIndex;
        return {
            phaseIndex: this.phaseIndex,
            phase: this.phases[this.phaseIndex],
            healthFraction,
            detachedPlates: [...this.plates.values()].filter((plate) => plate.detached).map((plate) => plate.id),
            phaseChanged
        };
    }
    plateSnapshot() {
        return [...this.plates.values()].map((plate) => ({ ...plate }));
    }
    reset() {
        this.phaseIndex = 0;
        for (const plate of this.plates.values()) {
            plate.health = plate.maxHealth;
            plate.detached = false;
        }
    }
}
