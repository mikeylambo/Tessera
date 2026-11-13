import * as THREE from "three";
import type { TunableRegistry } from "../../tuning/Tunables.js";
import type { Palette } from "../palette.js";
import { TunedUniforms } from "./TunedUniforms.js";
export type SluMaterialId = "slu.scan" | "slu.lit" | "slu.rim" | "slu.voidglass" | "slu.voidglass.ss" | "slu.dissolve" | "slu.energy" | "slu.outline";
export declare const SLU_MATERIAL_IDS: readonly SluMaterialId[];
export interface MaterialOverrides {
    /** Palette token or hex for the base color. */
    color?: string;
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    vertexColors?: boolean;
    side?: THREE.Side;
}
export interface DissolveControl {
    progress: number;
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    extent: number;
}
export interface MaterialContext {
    palette: Palette;
    registry: TunableRegistry;
    time: THREE.IUniform<number>;
    opaque: THREE.IUniform<THREE.Texture | null>;
    resolution: THREE.IUniform<THREE.Vector2>;
}
export declare class SluMaterials {
    private readonly ctx;
    readonly scan: TunedUniforms;
    readonly lit: TunedUniforms;
    readonly rim: TunedUniforms;
    readonly voidglass: TunedUniforms;
    readonly dissolve: TunedUniforms;
    readonly energy: TunedUniforms;
    readonly outline: TunedUniforms;
    private readonly glitchUniforms;
    constructor(ctx: MaterialContext);
    create(id: SluMaterialId | string, o?: MaterialOverrides): THREE.Material;
    /** 1. Scan Stylizer: photoreal scans → posterized, palette-remapped SLU surfaces. */
    createScan(o?: MaterialOverrides): THREE.MeshStandardMaterial;
    /** 2. Stylized Lit: banded toon ramp, shadow tint token, specular blob, light wrap. All Three lights + shadows. */
    createLit(o?: MaterialOverrides): THREE.MeshToonMaterial;
    /** 3. Rim / Fresnel glow layer for any lit material. */
    applyRim<M extends THREE.Material>(m: M): M;
    /** 5. Dissolve layer: noise threshold with emissive burn edge; directional/radial modes. */
    applyDissolve<M extends THREE.Material>(m: M): DissolveControl;
    /** 4a. Voidglass on MeshPhysicalMaterial (transmission + iridescence) with palette film, stars and edge glow. */
    createVoidglassPhysical(): THREE.MeshPhysicalMaterial;
    /** 4b. Voidglass with SLU screen-space refraction of the opaque pass (LookKit captures it). */
    createVoidglassScreenSpace(): THREE.ShaderMaterial;
    /** 7. Energy / Hologram: scanlines, fresnel, jitter, flicker, additive mode, glitch bursts. */
    createEnergy(): THREE.ShaderMaterial;
    /** Trigger an energy material's glitch burst. */
    glitch(m: THREE.Material, amount?: number): void;
    /** 6. Inverted-hull outline material (pair with createOutline). */
    createOutlineMaterial(): THREE.MeshBasicMaterial;
    /** Attach an inverted-hull outline to a mesh (skinned meshes share the skeleton). */
    createOutline(mesh: THREE.Mesh, material?: THREE.MeshBasicMaterial): THREE.Mesh;
    update(dt: number): void;
}
