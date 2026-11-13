import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import type { TunableRegistry } from "../../tuning/Tunables.js";
import type { Palette } from "../palette.js";
import { TunedUniforms } from "./TunedUniforms.js";
export type Quality = "low" | "med" | "high";
export declare const MAX_DISTORTIONS = 8;
export type PostPulseId = "chromatic.hit" | "bloom.flare" | "vignette.squeeze" | "flash" | (string & {});
export interface PostAccessibility {
    flashes: number;
    reducedMotion: boolean;
}
export declare class PostStack {
    private readonly renderer;
    private readonly palette;
    readonly composer: EffectComposer;
    readonly tuned: TunedUniforms;
    readonly pulses: TunedUniforms;
    private readonly scenePass;
    private readonly bloom;
    private readonly final;
    private readonly fxaa;
    private smaa;
    private readonly rings;
    private readonly ringState;
    private ringCursor;
    private pulseCA;
    private pulseBloom;
    private pulseVig;
    private flash;
    private width;
    private height;
    private pixelRatio;
    accessibility: PostAccessibility;
    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, registry: TunableRegistry, palette: Palette);
    setCamera(camera: THREE.Camera): void;
    setLUT(texture: THREE.Texture | null): void;
    get quality(): Quality;
    private applySettings;
    resize(width: number, height: number, pixelRatio?: number): void;
    /** Semantic post pulse. Amount 0..1 scales the tuned pulse size. */
    pulse(id: PostPulseId, amount?: number, options?: {
        token?: string;
    }): void;
    /** Full-screen token-colored flash, capped by accessibility flash setting. */
    flashColor(token: string, amount?: number): void;
    /** Screen-space distortion ring at an NDC position ([0,1] uv). */
    distort(uvX: number, uvY: number, options?: {
        strength?: number;
        life?: number;
        speed?: number;
    }): void;
    update(dt: number, time: number): void;
    render(): void;
    dispose(): void;
}
