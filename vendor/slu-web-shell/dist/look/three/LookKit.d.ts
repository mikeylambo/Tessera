import * as THREE from "three";
import { type TunableRegistry } from "../../tuning/Tunables.js";
import { type Palette } from "../palette.js";
import { SluMaterials, type MaterialOverrides, type SluMaterialId, type DissolveControl } from "./materials.js";
import { PostStack, type PostPulseId } from "./PostStack.js";
import { VfxRuntime, type VfxHandle, type VfxPlayOptions } from "./vfx/VfxRuntime.js";
export interface LookAccessibility {
    flashes: number;
    reducedMotion: boolean;
    screenShake?: number;
}
export interface CreateLookOptions {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    registry?: TunableRegistry;
    palette?: Palette;
    accessibility?: LookAccessibility;
    /** Particle capacity of the shared GPU pool. */
    particles?: number;
}
/**
 * The SLU Look Kit. Gameplay speaks semantic IDs only:
 *   look.material("slu.voidglass"), look.vfx.play("fx.impact.burst", {...}), look.post.pulse("chromatic.hit", 0.6)
 */
export declare class LookKit {
    private readonly options;
    readonly palette: Palette;
    readonly materials: SluMaterials;
    readonly post: PostStack;
    readonly vfx: VfxRuntime;
    readonly registry: TunableRegistry;
    readonly time: THREE.IUniform<number>;
    private readonly opaque;
    private readonly resolution;
    private readonly opaqueTarget;
    private readonly screenSpaceMaterials;
    private readonly hidden;
    private camera;
    private size;
    private dpr;
    constructor(options: CreateLookOptions);
    /** Semantic material factory. */
    material(id: SluMaterialId | string, overrides?: MaterialOverrides): THREE.Material;
    /** Layer a dissolve onto any material; animate `control.progress` 0 → 1 (spawn: 1 → 0). */
    dissolve(material: THREE.Material): DissolveControl;
    rim<M extends THREE.Material>(material: M): M;
    outline(mesh: THREE.Mesh): THREE.Mesh;
    play(id: string, options?: VfxPlayOptions): VfxHandle;
    pulse(id: PostPulseId, amount?: number): void;
    setCamera(camera: THREE.Camera): void;
    setAccessibility(a: LookAccessibility): void;
    resize(width: number, height: number, pixelRatio?: number): void;
    /** Advance presentation time (pass the feel kit's presentation dt to keep VFX in sync with slow-mo). */
    update(dt: number): void;
    render(): void;
    /** Opaque capture for screen-space voidglass: render once without those surfaces. */
    private captureOpaque;
    dispose(): void;
}
export declare function createLook(options: CreateLookOptions): LookKit;
