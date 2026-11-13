export class InputBuffer {
    windowMs;
    clock;
    until = 0;
    constructor(windowMs, clock = () => performance.now()) {
        this.windowMs = windowMs;
        this.clock = clock;
    }
    press() { this.until = this.clock() + Math.max(0, this.windowMs); }
    consume() { if (this.clock() > this.until)
        return false; this.until = 0; return true; }
    clear() { this.until = 0; }
}
export function applyRadialDeadzone(x, y, deadzone = 0.15) {
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude <= deadzone)
        return { x: 0, y: 0, magnitude: 0 };
    const scaled = (magnitude - deadzone) / Math.max(0.0001, 1 - deadzone);
    const nx = magnitude > 0 ? x / magnitude : 0;
    const ny = magnitude > 0 ? y / magnitude : 0;
    return { x: nx * scaled, y: ny * scaled, magnitude: scaled };
}
export class AnalogHysteresis {
    enterThreshold;
    exitThreshold;
    active = false;
    constructor(enterThreshold = 0.6, exitThreshold = 0.4) {
        this.enterThreshold = enterThreshold;
        this.exitThreshold = exitThreshold;
        if (exitThreshold > enterThreshold)
            throw new Error("exitThreshold must be <= enterThreshold");
    }
    update(value) { const magnitude = Math.abs(value); if (this.active) {
        if (magnitude <= this.exitThreshold)
            this.active = false;
    }
    else if (magnitude >= this.enterThreshold)
        this.active = true; return this.active; }
    reset() { this.active = false; }
}
/** Per-action input buffer: a press is remembered for `windowMs` until consumed. */
export class ActionBuffer {
    windowMs;
    clock;
    until = new Map();
    constructor(windowMs, clock = () => performance.now()) {
        this.windowMs = windowMs;
        this.clock = clock;
    }
    press(action) { const w = typeof this.windowMs === "function" ? this.windowMs(action) : this.windowMs; this.until.set(action, this.clock() + Math.max(0, w)); }
    peek(action) { return (this.until.get(action) ?? -Infinity) >= this.clock(); }
    consume(action) { if (!this.peek(action))
        return false; this.until.delete(action); return true; }
    clear(action) { action ? this.until.delete(action) : this.until.clear(); }
}
/** Coyote time: grounded-ness survives `graceMs` after leaving the ground (once per airborne spell). */
export class CoyoteTimer {
    graceMs;
    clock;
    lastGrounded = -Infinity;
    used = false;
    constructor(graceMs, clock = () => performance.now()) {
        this.graceMs = graceMs;
        this.clock = clock;
    }
    update(grounded) { if (grounded) {
        this.lastGrounded = this.clock();
        this.used = false;
    } }
    canJump() { const g = typeof this.graceMs === "function" ? this.graceMs() : this.graceMs; return !this.used && this.clock() - this.lastGrounded <= g; }
    /** Call when the jump fires so coyote time cannot double-jump. */
    consume() { if (!this.canJump())
        return false; this.used = true; this.lastGrounded = -Infinity; return true; }
}
