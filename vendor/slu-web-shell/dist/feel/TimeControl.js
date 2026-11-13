const ease = {
    linear: (t) => t, easeIn: (t) => t * t, easeOut: (t) => 1 - (1 - t) * (1 - t), easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
};
/**
 * Hitstop + slow-mo layered over SimulationSpeed. Gameplay stays deterministic: hitstop freezes the
 * simulation step, while presentation keeps rendering (optionally at `freezePresentation` scale).
 */
export class TimeControl {
    speed;
    hitstopLeft = 0;
    slow = null;
    /** Presentation speed while frozen (0 = hard freeze, ~0.05 = "animate the freeze"). */
    freezePresentation = 0.05;
    constructor(speed) {
        this.speed = speed;
    }
    hitstop(ms) { this.hitstopLeft = Math.max(this.hitstopLeft, Math.max(0, ms) / 1000); }
    /** Time scale ramps from `scale` back to 1 over `ms` with the easing curve. */
    slowmo(scale, ms, easing = "easeIn") {
        this.slow = { scale: Math.max(0, Math.min(1, scale)), total: Math.max(1, ms) / 1000, left: Math.max(1, ms) / 1000, easing };
    }
    get frozen() { return this.hitstopLeft > 0; }
    currentScale() {
        if (!this.slow)
            return 1;
        const t = 1 - this.slow.left / this.slow.total;
        return this.slow.scale + (1 - this.slow.scale) * ease[this.slow.easing](t);
    }
    step(realDt) {
        const dt = Math.max(0, Math.min(realDt, 0.25));
        const base = this.speed?.get() ?? 1;
        const scale = this.currentScale() * base;
        const frozen = this.hitstopLeft > 0;
        if (frozen)
            this.hitstopLeft = Math.max(0, this.hitstopLeft - dt);
        else if (this.slow) {
            this.slow.left -= dt;
            if (this.slow.left <= 0)
                this.slow = null;
        }
        return { simDt: frozen ? 0 : dt * scale, presentationDt: dt * (frozen ? this.freezePresentation : scale), frozen, scale };
    }
    clear() { this.hitstopLeft = 0; this.slow = null; }
}
