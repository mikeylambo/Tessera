import type { RendererAdapter } from '../RendererAdapter.js';
/** Renderer-neutral lifecycle bridge: the consumer owns its Pixi application. */
export declare class PixiAdapter implements RendererAdapter {
    private readonly hooks;
    readonly id = "pixi";
    constructor(hooks: Omit<RendererAdapter, 'id'>);
    start(): void | Promise<void> | undefined;
    suspend(): void;
    resume(): void;
    resize(w: number, h: number, dpr: number): void;
    loadLevel(id: string, payload?: unknown): void | Promise<void> | undefined;
    unloadLevel(): void | Promise<void> | undefined;
    screenshot(): Promise<string | Blob | null>;
    dispose(): void | Promise<void> | undefined;
}
