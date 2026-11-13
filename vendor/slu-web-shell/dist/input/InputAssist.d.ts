export declare class InputBuffer {
    private readonly windowMs;
    private readonly clock;
    private until;
    constructor(windowMs: number, clock?: () => number);
    press(): void;
    consume(): boolean;
    clear(): void;
}
export declare function applyRadialDeadzone(x: number, y: number, deadzone?: number): {
    x: number;
    y: number;
    magnitude: number;
};
export declare class AnalogHysteresis {
    private readonly enterThreshold;
    private readonly exitThreshold;
    private active;
    constructor(enterThreshold?: number, exitThreshold?: number);
    update(value: number): boolean;
    reset(): void;
}
/** Per-action input buffer: a press is remembered for `windowMs` until consumed. */
export declare class ActionBuffer<A extends string = string> {
    private readonly windowMs;
    private readonly clock;
    private readonly until;
    constructor(windowMs: number | ((action: A) => number), clock?: () => number);
    press(action: A): void;
    peek(action: A): boolean;
    consume(action: A): boolean;
    clear(action?: A): void;
}
/** Coyote time: grounded-ness survives `graceMs` after leaving the ground (once per airborne spell). */
export declare class CoyoteTimer {
    private readonly graceMs;
    private readonly clock;
    private lastGrounded;
    private used;
    constructor(graceMs: number | (() => number), clock?: () => number);
    update(grounded: boolean): void;
    canJump(): boolean;
    /** Call when the jump fires so coyote time cannot double-jump. */
    consume(): boolean;
}
