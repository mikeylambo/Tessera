/** Renderer-neutral lifecycle bridge: the consumer owns its Pixi application. */
export class PixiAdapter {
    hooks;
    id = 'pixi';
    constructor(hooks) {
        this.hooks = hooks;
    }
    start() { return this.hooks.start?.(); }
    suspend() { this.hooks.suspend?.(); }
    resume() { this.hooks.resume?.(); }
    resize(w, h, dpr) { this.hooks.resize?.(w, h, dpr); }
    loadLevel(id, payload) { return this.hooks.loadLevel?.(id, payload); }
    unloadLevel() { return this.hooks.unloadLevel?.(); }
    screenshot() { return this.hooks.screenshot?.() ?? Promise.resolve(null); }
    dispose() { return this.hooks.dispose?.(); }
}
