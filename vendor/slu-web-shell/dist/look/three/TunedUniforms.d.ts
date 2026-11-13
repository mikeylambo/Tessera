import * as THREE from "three";
import { type TunableRegistry, type TunableSchema } from "../../tuning/Tunables.js";
import type { Palette } from "../palette.js";
/**
 * Binds a tunable group to shader uniforms shared by every material instance of one semantic ID.
 * numbers → float, colors (token or hex) → Color, bools → float 0/1, enums → int index.
 */
export declare class TunedUniforms {
    readonly group: string;
    readonly schema: TunableSchema;
    private readonly registry;
    private readonly palette;
    readonly uniforms: Record<string, THREE.IUniform>;
    readonly values: Record<string, unknown>;
    private readonly hooks;
    constructor(group: string, schema: TunableSchema, registry: TunableRegistry, palette: Palette, prefix?: string);
    private readonly prefix;
    /** Run extra side effects (e.g. material.normalScale) whenever values change. */
    onSync(hook: () => void): this;
    num(key: string): number;
    str(key: string): string;
    color(key: string, target?: THREE.Color): THREE.Color;
    sync(): void;
    /** GLSL uniform declarations for this group. */
    glsl(): string;
}
