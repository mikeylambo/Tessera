export const DEFAULT_TARGET_SELECTION_TUNING = {
    maxRange: 900,
    softLockCone: 0.72,
    centerWeight: 0.68,
    distanceWeight: 0.24,
    priorityWeight: 0.08
};
export const DEFAULT_BREAK_TUNING = {
    breakDuration: 2.25,
    vulnerableMultiplier: 1.6,
    impactDecayPerSecond: 145,
    impactDecayDelay: 1.8
};
/**
 * Pure targeting helpers. Consumers decide visibility/occlusion and provide only
 * candidates that are currently targetable. This keeps the shell independent
 * of any renderer, physics library or scene graph.
 */
export class TargetCombatController {
    targetTuning;
    breakTuning;
    hardLockId = null;
    constructor(targetTuning = { ...DEFAULT_TARGET_SELECTION_TUNING }, breakTuning = { ...DEFAULT_BREAK_TUNING }) {
        this.targetTuning = targetTuning;
        this.breakTuning = breakTuning;
    }
    chooseSoftTarget(origin, forward, candidates) {
        const f = unit(forward);
        let best = null;
        let bestScore = -Infinity;
        for (const candidate of candidates) {
            if (candidate.alive === false)
                continue;
            const delta = sub(candidate.position, origin);
            const distance = length(delta);
            if (distance <= 0.001 || distance > this.targetTuning.maxRange)
                continue;
            const direction = scale(delta, 1 / distance);
            const alignment = dot(f, direction);
            if (alignment < this.targetTuning.softLockCone)
                continue;
            const centerScore = inverseLerp(this.targetTuning.softLockCone, 1, alignment);
            const distanceScore = 1 - distance / this.targetTuning.maxRange;
            const priorityScore = clamp(candidate.priority ?? 0, 0, 1);
            const score = centerScore * this.targetTuning.centerWeight +
                distanceScore * this.targetTuning.distanceWeight +
                priorityScore * this.targetTuning.priorityWeight;
            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        }
        return best;
    }
    setHardLock(candidate) {
        this.hardLockId = candidate?.id ?? null;
        return this.hardLockId;
    }
    resolveHardLock(candidates) {
        if (!this.hardLockId)
            return null;
        const target = candidates.find((candidate) => candidate.id === this.hardLockId && candidate.alive !== false) ?? null;
        if (!target)
            this.hardLockId = null;
        return target;
    }
    cycleHardLock(origin, forward, candidates, direction = 1) {
        const f = unit(forward);
        const valid = candidates
            .filter((candidate) => candidate.alive !== false && length(sub(candidate.position, origin)) <= this.targetTuning.maxRange)
            .sort((a, b) => signedYaw(f, unit(sub(a.position, origin))) - signedYaw(f, unit(sub(b.position, origin))));
        if (!valid.length)
            return this.setAndReturn(null);
        const current = valid.findIndex((candidate) => candidate.id === this.hardLockId);
        const next = current < 0 ? 0 : (current + Math.sign(direction || 1) + valid.length) % valid.length;
        return this.setAndReturn(valid[next] ?? null);
    }
    leadAim(origin, target, projectileSpeed, maxLeadSeconds = 1.2) {
        const velocity = target.velocity ?? { x: 0, y: 0, z: 0 };
        const distance = length(sub(target.position, origin));
        const leadTime = clamp(distance / Math.max(projectileSpeed, 1), 0, maxLeadSeconds);
        return add(target.position, scale(velocity, leadTime));
    }
    stepBreak(state, dtSeconds) {
        const dt = clamp(dtSeconds, 0, 0.05);
        const next = { ...state };
        next.brokenFor = Math.max(0, next.brokenFor - dt);
        next.recentHitFor = Math.max(0, next.recentHitFor - dt);
        if (next.brokenFor <= 0 && next.recentHitFor <= 0) {
            next.impact = Math.max(0, next.impact - this.breakTuning.impactDecayPerSecond * dt);
        }
        return next;
    }
    applyDamage(state, damage, impact) {
        const next = { ...state };
        const vulnerable = next.brokenFor > 0;
        const damageApplied = Math.max(0, damage) * (vulnerable ? this.breakTuning.vulnerableMultiplier : 1);
        next.health = Math.max(0, next.health - damageApplied);
        next.recentHitFor = this.breakTuning.impactDecayDelay;
        let broke = false;
        if (!vulnerable && next.health > 0) {
            next.impact += Math.max(0, impact);
            if (next.impact >= next.maxImpact) {
                next.impact = 0;
                next.brokenFor = this.breakTuning.breakDuration;
                broke = true;
            }
        }
        return { state: next, damageApplied, broke };
    }
    setAndReturn(candidate) {
        this.setHardLock(candidate);
        return candidate;
    }
}
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (v, amount) => ({ x: v.x * amount, y: v.y * amount, z: v.z * amount });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v) => Math.sqrt(dot(v, v));
const unit = (v) => {
    const magnitude = length(v);
    return magnitude > 0.00001 ? scale(v, 1 / magnitude) : { x: 0, y: 0, z: -1 };
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const inverseLerp = (a, b, value) => clamp((value - a) / Math.max(0.00001, b - a), 0, 1);
const signedYaw = (forward, target) => Math.atan2(forward.x * target.z - forward.z * target.x, forward.x * target.x + forward.z * target.z);
