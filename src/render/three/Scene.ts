import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PALETTE } from "../../data/palette";
import { TUNING } from "../../data/tuning";
import { cosmetic } from "../cosmetic";
import { dotTexture } from "./textures";

export const TILE = TUNING.grid.tileWorld;
export const HALF = TILE / 2;

/** Cell → world. Columns centred on x = 0; rows run toward −Z (forward, into the fog). */
export function wx(x: number): number {
  return (x - (TUNING.grid.columns - 1) / 2) * TILE;
}
export function wz(z: number): number {
  return -z * TILE;
}

/** Grade pass: vignette + Last Stand inversion (palette swap + 0.003 chromatic aberration). */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uInvert: { value: 0 },
    uAberration: { value: 0 },
    uVignette: { value: 0.42 },
    uFlash: { value: 0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uInvert; uniform float uAberration; uniform float uVignette; uniform float uFlash;
    varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      vec3 c;
      if (uAberration > 0.0) {
        c.r = texture2D(tDiffuse, vUv + d * uAberration).r;
        c.g = texture2D(tDiffuse, vUv).g;
        c.b = texture2D(tDiffuse, vUv - d * uAberration).b;
      } else c = texture2D(tDiffuse, vUv).rgb;
      // inversion keeps value order readable: luminance flips, hue rotates toward cold violet
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 inv = vec3(0.92, 0.9, 1.0) - c * vec3(0.85, 0.9, 0.7) + vec3(0.0, 0.0, 0.08) * (1.0 - l);
      c = mix(c, clamp(inv, 0.0, 1.0) * 0.85, uInvert);
      c += vec3(1.0, 0.85, 0.6) * uFlash;
      float v = smoothstep(0.85, 0.2, length(d) * (1.0 + uVignette));
      c *= mix(1.0, v, uVignette * 1.6);
      gl_FragColor = vec4(c, 1.0);
    }`
};

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  mobile: boolean;
}

/** Owns the WebGL renderer, scene, lights, fog, atmosphere and post stack. */
export class TesseraScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly key: THREE.DirectionalLight;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  readonly world = new THREE.Group();
  private dust: THREE.Points;
  private monoliths = new THREE.Group();
  readonly mobile: boolean;

  constructor(opts: SceneOptions) {
    this.mobile = opts.mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: !opts.mobile, powerPreference: "high-performance", preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 2 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(PALETTE.void, 1);

    this.scene.background = new THREE.Color(PALETTE.void);
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.022);
    this.camera = new THREE.PerspectiveCamera(TUNING.camera.fov, 1, 0.5, 220);
    this.scene.add(this.world);

    // one directional key (warm-neutral, upper left) + hemisphere fill (cool)
    this.key = new THREE.DirectionalLight(0xfff1de, 2.1);
    this.key.position.set(-9, 18, 6);
    this.key.castShadow = true;
    const sm = opts.mobile ? 1024 : 2048;
    this.key.shadow.mapSize.set(sm, sm);
    this.key.shadow.camera.left = -14;
    this.key.shadow.camera.right = 14;
    this.key.shadow.camera.top = 18;
    this.key.shadow.camera.bottom = -18;
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 60;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 3;
    this.scene.add(this.key, this.key.target);
    const hemi = new THREE.HemisphereLight(0x8fa3c7, 0x0a0b10, 0.55);
    this.scene.add(hemi);

    this.dust = this.makeDust();
    this.scene.add(this.dust);
    this.makeMonoliths();
    this.scene.add(this.monoliths);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const res = new THREE.Vector2(256, 256);
    this.bloom = new UnrealBloomPass(res, 0.85, 0.55, 0.85);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  private makeDust(): THREE.Points {
    const n = this.mobile ? 160 : 360;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = cosmetic.range(-26, 26);
      pos[i * 3 + 1] = cosmetic.range(-6, 16);
      pos[i * 3 + 2] = cosmetic.range(-60, 14);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size: 0.12, map: dotTexture(), transparent: true, opacity: 0.35, depthWrite: false, color: 0x9aa6bd, blending: THREE.AdditiveBlending });
    return new THREE.Points(g, m);
  }

  /** Distant monolith silhouettes drifting in the fog: dread of scale. */
  private makeMonoliths(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 18; i++) {
      const s = cosmetic.range(6, 18);
      const geo = new THREE.BoxGeometry(s, s * cosmetic.range(1, 3.2), s);
      const m = new THREE.Mesh(geo, mat);
      const side = cosmetic.sign();
      m.position.set(side * cosmetic.range(26, 70), cosmetic.range(-30, 10), cosmetic.range(-140, -20));
      m.rotation.set(cosmetic.range(-0.2, 0.2), cosmetic.range(0, Math.PI), cosmetic.range(-0.15, 0.15));
      m.userData.drift = cosmetic.range(0.02, 0.06) * cosmetic.sign();
      this.monoliths.add(m);
    }
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const half = this.mobile ? 0.5 : 1;
    this.bloom.resolution.set(w * half, h * half);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Atmosphere + shadow camera follow the focus point. */
  updateAtmosphere(focusZ: number, dt: number): void {
    this.key.position.set(-9, 18, focusZ + 6);
    this.key.target.position.set(0, 0, focusZ - 4);
    this.monoliths.position.z = focusZ * 0.6;
    for (const m of this.monoliths.children) m.rotation.y += (m.userData.drift as number) * dt;
    const p = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.12;
      if (y > 16) y = -6;
      p.setY(i, y);
      const z = p.getZ(i);
      if (z > focusZ + 14) p.setZ(i, focusZ - 60);
      if (z < focusZ - 60) p.setZ(i, focusZ + 14);
    }
    p.needsUpdate = true;
  }

  render(): void {
    this.composer.render();
  }
}
