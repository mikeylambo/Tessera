/**
 * Renderer-neutral full-screen flash (DOM overlay). Color comes from a palette token resolver and
 * peak opacity is capped by the accessibility flash setting. Three games can use look.post.flash instead.
 */
export declare class ScreenFlash {
    private readonly resolve;
    /** Accessibility cap (settings.flashes, 0..1). */
    cap: number;
    private readonly el;
    private value;
    private decay;
    constructor(root?: HTMLElement | null, resolve?: (token: string) => string);
    flash(token: string, amount?: number, decayPerSecond?: number): void;
    update(dt: number): number;
    dispose(): void;
}
