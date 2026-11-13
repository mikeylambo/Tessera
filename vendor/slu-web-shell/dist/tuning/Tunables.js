export function paramKind(param) {
    if ("options" in param)
        return "enum";
    if ("type" in param)
        return param.type;
    return "number";
}
/** Clamp/validate a raw value against a param. Invalid input falls back to the param default. */
export function coerceTunable(param, raw) {
    switch (paramKind(param)) {
        case "number": {
            const p = param;
            const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
            if (!Number.isFinite(n))
                return p.default;
            const clamped = Math.min(p.max, Math.max(p.min, n));
            if (!p.step)
                return clamped;
            const snapped = p.min + Math.round((clamped - p.min) / p.step) * p.step;
            return Number(Math.min(p.max, snapped).toFixed(6));
        }
        case "color": return typeof raw === "string" && raw.length > 0 ? raw : param.default;
        case "bool": return typeof raw === "boolean" ? raw : param.default;
        case "enum": {
            const p = param;
            return typeof raw === "string" && p.options.includes(raw) ? raw : p.default;
        }
    }
}
export class TunableRegistry {
    groups = new Map();
    pendingCanon = new Map();
    listeners = new Set();
    /** Define (or re-open) a group. Returns a live object: read properties every frame. */
    define(group, schema) {
        const existing = this.groups.get(group);
        if (existing) {
            Object.assign(existing.schema, schema);
            for (const [key, param] of Object.entries(schema))
                if (!(key in existing.values)) {
                    existing.values[key] = param.default;
                    existing.canon[key] = param.default;
                }
            this.applyPending(group);
            return existing.proxy;
        }
        const values = {};
        for (const [key, param] of Object.entries(schema))
            values[key] = param.default;
        const entry = { schema: { ...schema }, values, canon: { ...values }, proxy: {} };
        const registry = this;
        entry.proxy = new Proxy(values, {
            set(_t, key, value) { registry.set(group, String(key), value); return true; },
            deleteProperty() { return false; }
        });
        this.groups.set(group, entry);
        this.applyPending(group);
        return entry.proxy;
    }
    has(group) { return this.groups.has(group); }
    list() { return [...this.groups.keys()].sort(); }
    schema(group) { return this.groups.get(group)?.schema; }
    get(group, key) { return this.groups.get(group)?.values[key]; }
    set(group, key, raw) {
        const g = this.groups.get(group);
        const param = g?.schema[key];
        if (!g || !param)
            return undefined;
        const value = coerceTunable(param, raw);
        if (g.values[key] === value)
            return value;
        g.values[key] = value;
        for (const listener of this.listeners)
            listener({ group, key, value });
        return value;
    }
    reset(group) {
        const g = this.groups.get(group);
        if (!g)
            return;
        for (const key of Object.keys(g.schema))
            this.set(group, key, g.canon[key]);
    }
    /** Reset to schema defaults, ignoring canon. */
    resetToDefaults(group) {
        const g = this.groups.get(group);
        if (!g)
            return;
        for (const [key, param] of Object.entries(g.schema))
            this.set(group, key, param.default);
    }
    snapshot(group) { return { ...(this.groups.get(group)?.values ?? {}) }; }
    toPreset(group, name) {
        return { schema: 1, group, ...(name ? { name } : {}), values: this.snapshot(group) };
    }
    /**
     * Apply preset values. Migration-safe: unknown keys are ignored, missing keys keep their current
     * value, and every value is clamped/validated against the live schema. Returns ignored keys.
     */
    applyValues(group, values) {
        const g = this.groups.get(group);
        if (!g) {
            this.pendingCanon.set(group, { ...(this.pendingCanon.get(group) ?? {}), ...values });
            return [];
        }
        const ignored = [];
        for (const [key, raw] of Object.entries(values)) {
            if (!g.schema[key]) {
                ignored.push(key);
                continue;
            }
            this.set(group, key, raw);
        }
        return ignored;
    }
    applyPreset(preset) {
        const p = parsePreset(preset);
        return p ? this.applyValues(p.group, p.values) : [];
    }
    /**
     * Load canon (shipped tuning/*.json). Canon becomes the reset target. Groups that are not defined
     * yet are held and applied when they are defined, so load order never matters.
     */
    loadCanon(presets) {
        for (const raw of presets) {
            const preset = parsePreset(raw);
            if (!preset)
                continue;
            const g = this.groups.get(preset.group);
            if (!g) {
                this.pendingCanon.set(preset.group, { ...preset.values });
                continue;
            }
            this.applyValues(preset.group, preset.values);
            for (const key of Object.keys(g.schema))
                g.canon[key] = g.values[key];
        }
    }
    /** Keys whose live value differs from canon. */
    diff(group) {
        const g = this.groups.get(group);
        if (!g)
            return [];
        return Object.keys(g.schema).filter((k) => g.values[k] !== g.canon[k])
            .map((key) => ({ key, canon: g.canon[key], value: g.values[key] }));
    }
    /** Mark the current values as canon (after a successful Save). */
    commitCanon(group) { const g = this.groups.get(group); if (g)
        g.canon = { ...g.values }; }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    applyPending(group) {
        const pending = this.pendingCanon.get(group);
        if (!pending)
            return;
        this.pendingCanon.delete(group);
        const g = this.groups.get(group);
        this.applyValues(group, pending);
        for (const key of Object.keys(g.schema))
            g.canon[key] = g.values[key];
        // Keys not in this schema yet may belong to a later define() on the same group.
        const leftovers = Object.fromEntries(Object.entries(pending).filter(([k]) => !g.schema[k]));
        if (Object.keys(leftovers).length)
            this.pendingCanon.set(group, leftovers);
    }
}
export function parsePreset(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const r = raw;
    if (typeof r.group !== "string" || !r.values || typeof r.values !== "object")
        return null;
    return { schema: 1, group: r.group, ...(typeof r.name === "string" ? { name: r.name } : {}), values: r.values };
}
/** Process-wide default registry. Games may also create their own. */
export const tunables = new TunableRegistry();
/**
 * Load canon presets bundled by Vite: `loadTuningCanon(import.meta.glob("/tuning/*.json", { eager: true }))`.
 * Named variants (`group.variant.json`) are skipped; only `<group>.json` is canon.
 */
export function loadTuningCanon(modules, registry = tunables) {
    const presets = [];
    for (const [file, mod] of Object.entries(modules)) {
        const base = file.split("/").pop().replace(/\.json$/, "");
        const data = mod?.default ?? mod;
        const preset = parsePreset(data);
        if (preset && preset.group === base)
            presets.push(preset);
    }
    registry.loadCanon(presets);
    return presets.length;
}
