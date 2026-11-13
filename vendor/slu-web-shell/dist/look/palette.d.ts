import { type TunableRegistry } from "../tuning/Tunables.js";
/** Semantic color tokens. Shaders and UI read tokens, never raw colors. */
export declare const PALETTE_TOKENS: readonly ["void", "void.deep", "soul", "ember", "ember.hot", "edge", "shadow", "highlight", "energy", "danger", "ui.accent", "ui.text"];
export type PaletteToken = (typeof PALETTE_TOKENS)[number];
/** Provisional SLU Default: deep void blues/purples, soulfire ember accent, cyan edge light. */
export declare const SLU_DEFAULT_PALETTE: Readonly<Record<PaletteToken, string>>;
export interface Palette {
    readonly group: string;
    get(token: string): string;
    rgb(token: string): [number, number, number];
    tokens(): string[];
    /** Resolve a token name or hex literal to hex. */
    resolve(value: string): string;
    onChange(listener: () => void): () => void;
}
export declare function hexToRgb(hex: string): [number, number, number];
/** Palette backed by tunables so Michael can replace token values from the tuning panel. */
export declare function createPalette(values?: Record<string, string>, registry?: TunableRegistry, group?: string): Palette;
