import { significanceAtLeast } from "./ImpactLibrary.js";
let nextImpactId = 1;
export class ImpactPlayer {
    hooks;
    active = new Map();
    constructor(hooks) {
        this.hooks = hooks;
    }
    play(recipe, context = {}) {
        const id = `impact:${nextImpactId++}`;
        const normalized = {
            significance: context.significance ?? "normal",
            seed: context.seed ?? 1,
            ...context,
        };
        this.active.set(id, { id, recipe: structuredClone(recipe), context: normalized, time: 0, fired: new Set() });
        this.dispatchDue(this.active.get(id), 0, 0);
        return id;
    }
    stop(instanceId) {
        this.active.delete(instanceId);
    }
    update(deltaSeconds) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
            return;
        for (const state of [...this.active.values()]) {
            const previous = state.time;
            state.time = Math.min(state.recipe.duration, state.time + deltaSeconds);
            this.dispatchDue(state, previous, state.time);
            if (state.time >= state.recipe.duration) {
                this.hooks.onComplete?.(state.id, state.recipe);
                this.active.delete(state.id);
            }
        }
    }
    dispatchDue(state, previous, current) {
        const significance = state.context.significance ?? "normal";
        for (const cue of state.recipe.cues) {
            if (state.fired.has(cue.id))
                continue;
            if (cue.at < previous || cue.at > current)
                continue;
            if (cue.minSignificance && !significanceAtLeast(significance, cue.minSignificance))
                continue;
            state.fired.add(cue.id);
            this.hooks.onCue(state.id, state.recipe, cue, state.context);
        }
    }
    getActiveCount() {
        return this.active.size;
    }
}
