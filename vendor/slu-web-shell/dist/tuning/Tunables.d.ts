/**
 * Schema-driven live tuning. Gameplay, look, VFX, post, camera and feel all register parameters the
 * same way; the tuning panel is generated from the schemas and presets round-trip as JSON.
 * Renderer-neutral and dependency-free.
 */
export interface NumberParam {
    min: number;
    max: number;
    step?: number;
    default: number;
    label?: string;
}
export interface ColorParam {
    type: "color";
    default: string;
    label?: string;
}
export interface EnumParam<T extends string = string> {
    options: readonly T[];
    default: T;
    label?: string;
}
export interface BoolParam {
    type: "bool";
    default: boolean;
    label?: string;
}
export type TunableParam = NumberParam | ColorParam | EnumParam | BoolParam;
export type TunableSchema = Record<string, TunableParam>;
type ValueOf<P> = P extends NumberParam ? number : P extends ColorParam ? string : P extends BoolParam ? boolean : P extends EnumParam<infer T> ? T : never;
export type TunableValues<S extends TunableSchema> = {
    -readonly [K in keyof S]: ValueOf<S[K]>;
};
export type TunableValue = number | string | boolean;
export interface TuningPreset {
    schema: 1;
    group: string;
    name?: string;
    values: Record<string, TunableValue>;
}
export interface TunableChange {
    group: string;
    key: string;
    value: TunableValue;
}
export declare function paramKind(param: TunableParam): "number" | "color" | "enum" | "bool";
/** Clamp/validate a raw value against a param. Invalid input falls back to the param default. */
export declare function coerceTunable(param: TunableParam, raw: unknown): TunableValue;
export declare class TunableRegistry {
    private readonly groups;
    private readonly pendingCanon;
    private readonly listeners;
    /** Define (or re-open) a group. Returns a live object: read properties every frame. */
    define<S extends TunableSchema>(group: string, schema: S): TunableValues<S>;
    has(group: string): boolean;
    list(): string[];
    schema(group: string): TunableSchema | undefined;
    get(group: string, key: string): TunableValue | undefined;
    set(group: string, key: string, raw: unknown): TunableValue | undefined;
    reset(group: string): void;
    /** Reset to schema defaults, ignoring canon. */
    resetToDefaults(group: string): void;
    snapshot(group: string): Record<string, TunableValue>;
    toPreset(group: string, name?: string): TuningPreset;
    /**
     * Apply preset values. Migration-safe: unknown keys are ignored, missing keys keep their current
     * value, and every value is clamped/validated against the live schema. Returns ignored keys.
     */
    applyValues(group: string, values: Record<string, unknown>): string[];
    applyPreset(preset: unknown): string[];
    /**
     * Load canon (shipped tuning/*.json). Canon becomes the reset target. Groups that are not defined
     * yet are held and applied when they are defined, so load order never matters.
     */
    loadCanon(presets: Iterable<unknown>): void;
    /** Keys whose live value differs from canon. */
    diff(group: string): Array<{
        key: string;
        canon: TunableValue;
        value: TunableValue;
    }>;
    /** Mark the current values as canon (after a successful Save). */
    commitCanon(group: string): void;
    subscribe(listener: (change: TunableChange) => void): () => void;
    private applyPending;
}
export declare function parsePreset(raw: unknown): TuningPreset | null;
/** Process-wide default registry. Games may also create their own. */
export declare const tunables: TunableRegistry;
/**
 * Load canon presets bundled by Vite: `loadTuningCanon(import.meta.glob("/tuning/*.json", { eager: true }))`.
 * Named variants (`group.variant.json`) are skipped; only `<group>.json` is canon.
 */
export declare function loadTuningCanon(modules: Record<string, unknown>, registry?: TunableRegistry): number;
export {};
