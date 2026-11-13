import * as THREE from "three";
import { tunables as defaultRegistry } from "../../tuning/Tunables.js";
import { createPalette } from "../palette.js";
import { SluMaterials } from "./materials.js";
import { PostStack } from "./PostStack.js";
import { VfxRuntime } from "./vfx/VfxRuntime.js";
/**
 * The SLU Look Kit. Gameplay speaks semantic IDs only:
 *   look.material("slu.voidglass"), look.vfx.play("fx.impact.burst", {...}), look.post.pulse("chromatic.hit", 0.6)
 */
export class LookKit {
    options;
    palette;
    materials;
    post;
    vfx;
    registry;
    time = { value: 0 };
    opaque = { value: null };
    resolution = { value: new THREE.Vector2(1, 1) };
    opaqueTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    screenSpaceMaterials = new Set();
    hidden = [];
    camera;
    size = new THREE.Vector2(1, 1);
    dpr = 1;
    constructor(options) {
        this.options = options;
        this.registry = options.registry ?? defaultRegistry;
        this.palette = options.palette ?? createPalette(undefined, this.registry);
        this.camera = options.camera;
        this.materials = new SluMaterials({ palette: this.palette, registry: this.registry, time: this.time, opaque: this.opaque, resolution: this.resolution });
        this.post = new PostStack(options.renderer, options.scene, options.camera, this.registry, this.palette);
        this.vfx = new VfxRuntime(options.scene, options.camera, this.palette, this.registry, undefined, options.particles);
        this.vfx.onDistort = (world, strength, life) => {
            const p = world.clone().project(this.camera);
            if (p.z < 1)
                this.post.distort(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5, { strength, life });
        };
        if (options.accessibility)
            this.setAccessibility(options.accessibility);
        const r = options.renderer;
        r.getSize(this.size);
        this.resize(this.size.x, this.size.y, r.getPixelRatio());
    }
    /** Semantic material factory. */
    material(id, overrides) {
        const m = this.materials.create(id, overrides);
        if (m.userData.sluNeedsOpaque)
            this.screenSpaceMaterials.add(m);
        return m;
    }
    /** Layer a dissolve onto any material; animate `control.progress` 0 → 1 (spawn: 1 → 0). */
    dissolve(material) { return this.materials.applyDissolve(material); }
    rim(material) { return this.materials.applyRim(material); }
    outline(mesh) { return this.materials.createOutline(mesh); }
    play(id, options) { return this.vfx.play(id, options); }
    pulse(id, amount) { this.post.pulse(id, amount); }
    setCamera(camera) { this.camera = camera; this.post.setCamera(camera); this.vfx.camera = camera; }
    setAccessibility(a) {
        this.post.accessibility = { flashes: a.flashes, reducedMotion: a.reducedMotion };
        this.vfx.accessibility = { flashes: a.flashes, reducedMotion: a.reducedMotion };
    }
    resize(width, height, pixelRatio = this.dpr) {
        this.dpr = pixelRatio;
        this.size.set(width, height);
        this.options.renderer.setPixelRatio(pixelRatio);
        this.options.renderer.setSize(width, height, false);
        this.post.resize(width, height, pixelRatio);
        const q = this.post.quality;
        const s = q === "high" ? 1 : q === "med" ? 0.75 : 0.5;
        this.opaqueTarget.setSize(Math.max(1, Math.round(width * pixelRatio * s)), Math.max(1, Math.round(height * pixelRatio * s)));
        // Screen UV for the screen-space voidglass is computed from gl_FragCoord in the post target.
        const pq = q === "high" ? 1 : q === "med" ? 0.85 : 0.7;
        this.resolution.value.set(width * pixelRatio * pq, height * pixelRatio * pq);
        const cam = this.camera;
        if (cam.isPerspectiveCamera) {
            cam.aspect = width / Math.max(1, height);
            cam.updateProjectionMatrix();
        }
    }
    /** Advance presentation time (pass the feel kit's presentation dt to keep VFX in sync with slow-mo). */
    update(dt) {
        this.time.value += dt;
        this.materials.update(dt);
        this.vfx.update(dt);
        this.post.update(dt, this.time.value);
    }
    render() {
        if (this.screenSpaceMaterials.size)
            this.captureOpaque();
        this.post.render();
    }
    /** Opaque capture for screen-space voidglass: render once without those surfaces. */
    captureOpaque() {
        const { renderer, scene } = this.options;
        this.hidden.length = 0;
        scene.traverseVisible((o) => { const m = o.material; if (m && !Array.isArray(m) && this.screenSpaceMaterials.has(m))
            this.hidden.push(o); });
        if (!this.hidden.length)
            return;
        for (const o of this.hidden)
            o.visible = false;
        const vfxVisible = this.vfx.root.visible;
        this.vfx.root.visible = false;
        renderer.setRenderTarget(this.opaqueTarget);
        renderer.clear();
        renderer.render(scene, this.camera);
        renderer.setRenderTarget(null);
        this.vfx.root.visible = vfxVisible;
        for (const o of this.hidden)
            o.visible = true;
        this.opaque.value = this.opaqueTarget.texture;
    }
    dispose() { this.post.dispose(); this.opaqueTarget.dispose(); }
}
export function createLook(options) { return new LookKit(options); }
