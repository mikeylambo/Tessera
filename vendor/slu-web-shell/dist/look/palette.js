import { tunables as defaultRegistry } from "../tuning/Tunables.js";
/** Semantic color tokens. Shaders and UI read tokens, never raw colors. */
export const PALETTE_TOKENS = [
    "void", "void.deep", "soul", "ember", "ember.hot", "edge", "shadow", "highlight", "energy", "danger", "ui.accent", "ui.text"
];
/** Provisional SLU Default: deep void blues/purples, soulfire ember accent, cyan edge light. */
export const SLU_DEFAULT_PALETTE = {
    "void": "#1a1440",
    "void.deep": "#07061a",
    "soul": "#8d6bff",
    "ember": "#ff7a2f",
    "ember.hot": "#ffd08a",
    "edge": "#5ff2ff",
    "shadow": "#241a4a",
    "highlight": "#f3eaff",
    "energy": "#4fd8ff",
    "danger": "#ff3b5c",
    "ui.accent": "#5ff2ff",
    "ui.text": "#e8ecff"
};
export function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
    const n = parseInt(full, 16);
    if (!Number.isFinite(n))
        return [1, 0, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
/** Palette backed by tunables so Michael can replace token values from the tuning panel. */
export function createPalette(values = SLU_DEFAULT_PALETTE, registry = defaultRegistry, group = "look.palette") {
    const schema = {};
    for (const [token, hex] of Object.entries(values))
        schema[token] = { type: "color", default: hex };
    registry.define(group, schema);
    const listeners = new Set();
    registry.subscribe((c) => { if (c.group === group)
        for (const l of listeners)
            l(); });
    const palette = {
        group,
        get(token) { return palette.resolve(token); },
        rgb(token) { return hexToRgb(palette.resolve(token)); },
        tokens() { return Object.keys(registry.schema(group) ?? {}); },
        resolve(value) {
            if (value.startsWith("#"))
                return value;
            const v = registry.get(group, value);
            if (typeof v !== "string")
                return "#ff00ff";
            return v.startsWith("#") ? v : palette.resolve(v);
        },
        onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    };
    return palette;
}
