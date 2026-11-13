import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { TunedUniforms } from "./TunedUniforms.js";
export const MAX_DISTORTIONS = 8;
/** Renders the scene into its own target (with depth) and blits to the chain, optionally with depth edges. */
class SceneEdgePass extends Pass {
    scene;
    camera;
    target;
    quad;
    material;
    constructor(scene, camera, edges) {
        super();
        this.scene = scene;
        this.camera = camera;
        this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1), samples: 0 });
        this.material = new THREE.ShaderMaterial({
            uniforms: { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 100 }, uTexel: { value: new THREE.Vector2() }, ...edges },
            vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
            fragmentShader: `uniform sampler2D tColor; uniform sampler2D tDepth; uniform float uNear; uniform float uFar; uniform vec2 uTexel;
        uniform float u_edges; uniform float u_edgeStrength; uniform vec3 u_edgeColor; uniform float u_edgeThreshold; varying vec2 vUv;
        float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return (2.0*uNear*uFar)/(uFar+uNear - z*(uFar-uNear)); }
        void main(){
          vec4 c = texture2D(tColor, vUv);
          if (u_edges > 0.5) {
            float d = lin(vUv);
            float dx = lin(vUv + vec2(uTexel.x,0.0)) + lin(vUv - vec2(uTexel.x,0.0)) - 2.0*d;
            float dy = lin(vUv + vec2(0.0,uTexel.y)) + lin(vUv - vec2(0.0,uTexel.y)) - 2.0*d;
            float e = smoothstep(u_edgeThreshold, u_edgeThreshold * 3.0, (abs(dx) + abs(dy)) / max(d, 0.001));
            c.rgb = mix(c.rgb, u_edgeColor, e * u_edgeStrength * step(d, uFar * 0.98));
          }
          gl_FragColor = c;
        }`,
            depthTest: false, depthWrite: false
        });
        this.quad = new FullScreenQuad(this.material);
    }
    setSize(w, h) { this.target.setSize(w, h); this.material.uniforms.uTexel.value.set(1 / w, 1 / h); }
    render(renderer, writeBuffer) {
        renderer.setRenderTarget(this.target);
        renderer.clear();
        renderer.render(this.scene, this.camera);
        const cam = this.camera;
        this.material.uniforms.uNear.value = cam.near ?? 0.1;
        this.material.uniforms.uFar.value = cam.far ?? 100;
        this.material.uniforms.tColor.value = this.target.texture;
        this.material.uniforms.tDepth.value = this.target.depthTexture;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        this.quad.render(renderer);
    }
    dispose() { this.target.dispose(); this.material.dispose(); this.quad.dispose(); }
}
const FINAL_FRAG = `uniform sampler2D tDiffuse; uniform vec2 uResolution; uniform float uTime; uniform sampler2D tLut; uniform float uHasLut;
uniform vec4 uRings[${MAX_DISTORTIONS}]; uniform float uFlash; uniform vec3 uFlashColor; uniform float uCAPulse; uniform float uVigPulse;
uniform float u_grade; uniform float u_lift; uniform float u_gamma; uniform float u_gain; uniform vec3 u_liftColor; uniform vec3 u_gainColor; uniform float u_saturation; uniform float u_lutStrength;
uniform float u_vignette; uniform float u_vignetteAmount; uniform float u_vignetteSoftness; uniform vec3 u_vignetteColor;
uniform float u_chromatic; uniform float u_chromaticBase; uniform float u_grain; uniform float u_grainAmount; uniform float u_distortion;
varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 lut(vec3 c){ // 16x(16*16) horizontal strip LUT
  float b = c.b * 15.0; float b0 = floor(b); float b1 = min(b0 + 1.0, 15.0);
  vec2 uv0 = vec2((b0 * 16.0 + c.r * 15.0 + 0.5) / 256.0, (c.g * 15.0 + 0.5) / 16.0);
  vec2 uv1 = vec2((b1 * 16.0 + c.r * 15.0 + 0.5) / 256.0, uv0.y);
  return mix(texture2D(tLut, uv0).rgb, texture2D(tLut, uv1).rgb, b - b0);
}
void main(){
  vec2 uv = vUv; float aspect = uResolution.x / uResolution.y;
  if (u_distortion > 0.5) for (int i = 0; i < ${MAX_DISTORTIONS}; i++) {
    vec4 r = uRings[i]; if (r.w <= 0.0) continue;
    vec2 d = uv - r.xy; d.x *= aspect; float dist = length(d);
    float band = 1.0 - smoothstep(0.0, 0.06, abs(dist - r.z));
    uv -= normalize(d + 1e-5) * band * r.w * 0.04 * vec2(1.0 / aspect, 1.0);
  }
  float ca = (u_chromatic > 0.5 ? u_chromaticBase : 0.0) + uCAPulse;
  vec2 dir = (uv - 0.5) * ca * 0.02;
  vec3 col = vec3(texture2D(tDiffuse, uv + dir).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir).b);
  if (u_grade > 0.5) {
    col = col * (u_gain * u_gainColor) + u_lift * u_liftColor;
    col = pow(max(col, 0.0), vec3(1.0 / max(u_gamma, 0.01)));
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, u_saturation);
    if (uHasLut > 0.5) col = mix(col, lut(clamp(col, 0.0, 1.0)), u_lutStrength);
  }
  if (u_vignette > 0.5 || uVigPulse > 0.0) {
    vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
    float v = smoothstep(0.85 - u_vignetteSoftness, 0.85, length(q) * (1.0 + uVigPulse));
    col = mix(col, u_vignetteColor, v * clamp(u_vignetteAmount * u_vignette + uVigPulse, 0.0, 1.0));
  }
  if (u_grain > 0.5) col += (h12(vUv * uResolution + fract(uTime) * 917.0) - 0.5) * u_grainAmount;
  col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;
export class PostStack {
    renderer;
    palette;
    composer;
    tuned;
    pulses;
    scenePass;
    bloom;
    final;
    fxaa;
    smaa = null;
    rings = Array.from({ length: MAX_DISTORTIONS }, () => new THREE.Vector4());
    ringState = Array.from({ length: MAX_DISTORTIONS }, () => ({ age: 0, life: 0, speed: 0, strength: 0, x: 0, y: 0 }));
    ringCursor = 0;
    pulseCA = 0;
    pulseBloom = 0;
    pulseVig = 0;
    flash = 0;
    width = 1;
    height = 1;
    pixelRatio = 1;
    accessibility = { flashes: 1, reducedMotion: false };
    constructor(renderer, scene, camera, registry, palette) {
        this.renderer = renderer;
        this.palette = palette;
        this.tuned = new TunedUniforms("look.post", {
            quality: { options: ["low", "med", "high"], default: "high" },
            bloom: { type: "bool", default: true }, bloomThreshold: { min: 0, max: 2, step: 0.01, default: 0.72 },
            bloomStrength: { min: 0, max: 3, step: 0.01, default: 0.85 }, bloomRadius: { min: 0, max: 1, step: 0.01, default: 0.45 },
            grade: { type: "bool", default: true }, lift: { min: -0.2, max: 0.2, step: 0.005, default: 0.02 },
            gamma: { min: 0.5, max: 2, step: 0.01, default: 1 }, gain: { min: 0.5, max: 2, step: 0.01, default: 1.04 },
            liftColor: { type: "color", default: "void" }, gainColor: { type: "color", default: "highlight" },
            saturation: { min: 0, max: 2, step: 0.01, default: 1.08 }, lutStrength: { min: 0, max: 1, step: 0.01, default: 1 },
            vignette: { type: "bool", default: true }, vignetteAmount: { min: 0, max: 1, step: 0.01, default: 0.45 },
            vignetteSoftness: { min: 0.05, max: 0.85, step: 0.01, default: 0.55 }, vignetteColor: { type: "color", default: "void.deep" },
            chromatic: { type: "bool", default: false }, chromaticBase: { min: 0, max: 2, step: 0.01, default: 0.2 },
            grain: { type: "bool", default: true }, grainAmount: { min: 0, max: 0.2, step: 0.001, default: 0.03 },
            distortion: { type: "bool", default: true },
            edges: { type: "bool", default: false }, edgeStrength: { min: 0, max: 1, step: 0.01, default: 0.8 },
            edgeColor: { type: "color", default: "void.deep" }, edgeThreshold: { min: 0.001, max: 0.2, step: 0.001, default: 0.02 },
            aa: { options: ["none", "fxaa", "smaa"], default: "fxaa" }
        }, registry, palette);
        this.pulses = new TunedUniforms("look.post.pulses", {
            chromaticHit: { min: 0, max: 6, step: 0.05, default: 2.4 }, bloomFlare: { min: 0, max: 3, step: 0.05, default: 1.2 },
            vignetteSqueeze: { min: 0, max: 1, step: 0.01, default: 0.35 }, decay: { min: 1, max: 30, step: 0.5, default: 9 },
            flashDecay: { min: 1, max: 30, step: 0.5, default: 12 }, flashColor: { type: "color", default: "highlight" }
        }, registry, palette);
        this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
        this.scenePass = new SceneEdgePass(scene, camera, this.tuned.uniforms);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.45, 0.72);
        this.final = new ShaderPass(new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: null }, uResolution: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, tLut: { value: null }, uHasLut: { value: 0 },
                uRings: { value: this.rings }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color() }, uCAPulse: { value: 0 }, uVigPulse: { value: 0 }, ...this.tuned.uniforms },
            vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
            fragmentShader: FINAL_FRAG
        }));
        this.fxaa = new ShaderPass(FXAAShader);
        this.composer.addPass(this.scenePass);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
        this.composer.addPass(this.final);
        this.composer.addPass(this.fxaa);
        this.tuned.onSync(() => this.applySettings());
    }
    setCamera(camera) { this.scenePass.camera = camera; }
    setLUT(texture) { const u = this.final.material.uniforms; u.tLut.value = texture; u.uHasLut.value = texture ? 1 : 0; }
    get quality() { return this.tuned.str("quality"); }
    applySettings() {
        const t = this.tuned;
        this.bloom.enabled = t.values.bloom === true;
        this.bloom.threshold = t.num("bloomThreshold");
        this.bloom.radius = t.num("bloomRadius");
        const aa = t.str("aa");
        this.fxaa.enabled = aa === "fxaa";
        if (aa === "smaa" && !this.smaa) {
            this.smaa = new SMAAPass();
            this.composer.addPass(this.smaa);
            this.resize(this.width, this.height, this.pixelRatio);
        }
        if (this.smaa)
            this.smaa.enabled = aa === "smaa";
        this.resize(this.width, this.height, this.pixelRatio);
    }
    resize(width, height, pixelRatio = 1) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.pixelRatio = pixelRatio;
        const q = this.quality;
        const scale = q === "high" ? 1 : q === "med" ? 0.85 : 0.7;
        this.composer.setPixelRatio(pixelRatio * scale);
        this.composer.setSize(this.width, this.height);
        // Bloom mip chain resolution is the dominant post cost; scale it with quality.
        const b = q === "high" ? 0.5 : q === "med" ? 0.35 : 0.25;
        this.bloom.setSize(Math.max(1, Math.round(this.width * pixelRatio * b)), Math.max(1, Math.round(this.height * pixelRatio * b)));
        const w = this.width * pixelRatio * scale, h = this.height * pixelRatio * scale;
        this.final.material.uniforms.uResolution.value.set(w, h);
        this.fxaa.material.uniforms.resolution.value.set(1 / w, 1 / h);
    }
    /** Semantic post pulse. Amount 0..1 scales the tuned pulse size. */
    pulse(id, amount = 1, options = {}) {
        const p = this.pulses;
        if (id === "chromatic.hit")
            this.pulseCA = Math.max(this.pulseCA, p.num("chromaticHit") * amount * (this.accessibility.reducedMotion ? 0.35 : 1));
        else if (id === "bloom.flare")
            this.pulseBloom = Math.max(this.pulseBloom, p.num("bloomFlare") * amount * this.accessibility.flashes);
        else if (id === "vignette.squeeze")
            this.pulseVig = Math.max(this.pulseVig, p.num("vignetteSqueeze") * amount);
        else if (id === "flash")
            this.flashColor(options.token ?? p.str("flashColor"), amount);
    }
    /** Full-screen token-colored flash, capped by accessibility flash setting. */
    flashColor(token, amount = 0.6) {
        this.final.material.uniforms.uFlashColor.value.set(this.palette.resolve(token));
        this.flash = Math.max(this.flash, Math.min(amount, 0.85) * this.accessibility.flashes);
    }
    /** Screen-space distortion ring at an NDC position ([0,1] uv). */
    distort(uvX, uvY, options = {}) {
        const i = this.ringCursor++ % MAX_DISTORTIONS;
        Object.assign(this.ringState[i], { age: 0, life: options.life ?? 0.6, speed: options.speed ?? 0.9, strength: (options.strength ?? 1) * (this.accessibility.reducedMotion ? 0.25 : 1), x: uvX, y: uvY });
    }
    update(dt, time) {
        const decay = Math.exp(-this.pulses.num("decay") * dt);
        this.pulseCA *= decay;
        this.pulseBloom *= decay;
        this.pulseVig *= decay;
        this.flash *= Math.exp(-this.pulses.num("flashDecay") * dt);
        const u = this.final.material.uniforms;
        u.uTime.value = time;
        u.uCAPulse.value = this.pulseCA;
        u.uVigPulse.value = this.pulseVig;
        u.uFlash.value = this.flash;
        this.bloom.strength = this.tuned.num("bloomStrength") + this.pulseBloom;
        for (let i = 0; i < MAX_DISTORTIONS; i++) {
            const s = this.ringState[i];
            const r = this.rings[i];
            if (s.age >= s.life) {
                r.w = 0;
                continue;
            }
            s.age += dt;
            const k = s.age / s.life;
            r.set(s.x, s.y, s.speed * s.age, s.strength * (1 - k) * (1 - k));
        }
    }
    render() { this.composer.render(); }
    dispose() { this.composer.dispose(); this.scenePass.dispose(); }
}
