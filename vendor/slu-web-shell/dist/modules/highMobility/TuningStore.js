/**
 * Small renderer-neutral live tuning store. Consumers can bind sliders/debug UI
 * without letting debug presentation become authoritative game state.
 */
export class TuningStore {
    values;
    listeners = new Set();
    constructor(initial) {
        this.values = structuredClone(initial);
    }
    get(key) {
        return this.values[key];
    }
    set(key, value) {
        if (Object.is(this.values[key], value))
            return;
        this.values[key] = value;
        const snapshot = this.snapshot();
        for (const listener of this.listeners)
            listener(snapshot, key);
    }
    patch(values) {
        for (const [key, value] of Object.entries(values)) {
            if (value !== undefined)
                this.set(key, value);
        }
    }
    snapshot() {
        return Object.freeze(structuredClone(this.values));
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
