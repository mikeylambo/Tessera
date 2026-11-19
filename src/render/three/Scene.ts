import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { createLook, createPalette, type LookKit } from "@slu/web-shell/look/three";
import { tunables } from "@slu/web-shell/tuning";
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

const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

/**
 * Tessera's palette as Look Kit tokens (GDD §23 colour discipline, LOCKED). Shell post/VFX read tokens;
 * Tessera materials read the same PALETTE constants, so there is one source of colour.
 */
export const TESSERA_TOKENS: Readonly<Record<string, string>> = {
  void: hex(PALETTE.void),
  "void.deep": "#020203",
  soul: hex(PALETTE.forbiddenCore),
  ember: hex(PALETTE.mark),
  "ember.hot": hex(PALETTE.beacon),
  edge: hex(PALETTE.lattice),
  shadow: "#0c0d12",
  highlight: "#f4efe6",
  energy: hex(PALETTE.glass),
  danger: hex(PALETTE.crumbleWarn),
  "ui.accent": hex(PALETTE.mark),
  "ui.text": "#e9e3d8",
  stone: hex(PALETTE.stone),
  advantage: hex(PALETTE.advantage),
  ground: hex(PALETTE.ground)
};

/**
 * Tessera's own pass after the shell grade: Last Stand inversion (palette swap that keeps value order readable +
 * 0.003 chromatic aberration, GDD §25), plus three transients — chromatic pulse (Blast / chain ≥ 4, 2–4 f, never
 * constant), warm grade lift (chain ≥ 6, ~8%) and the Blast inhale dim. All are zeroed under Reduced Motion / Flashes.
 */
const TesseraPostShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uInvert: { value: 0 },
    uAberration: { value: 0 },
    uWarm: { value: 0 },
    uDim: { value: 0 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uInvert; uniform float uAberration; uniform float uWarm; uniform float uDim; varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      vec3 c = uAberration > 0.0
        ? vec3(texture2D(tDiffuse, vUv + d * uAberration).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * uAberration).b)
        : texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 inv = vec3(0.92, 0.9, 1.0) - c * vec3(0.85, 0.9, 0.7) + vec3(0.0, 0.0, 0.08) * (1.0 - l);
      c = mix(c, clamp(inv, 0.0, 1.0) * 0.85, uInvert);
      // warm lift: brighten toward amber in proportion to luminance (void stays void)
      c += uWarm * vec3(1.0, 0.72, 0.38) * l * 1.6;
      c *= 1.0 - uDim * (0.6 + 0.4 * length(d) * 2.0);
      gl_FragColor = vec4(c, 1.0);
    }`
};

/** Void depth: a starless vertical gradient sphere — never pure black, reads as infinite (no fog, no depth write). */
const BackdropShader = {
  uniforms: { uTop: { value: new THREE.Color(0x07080c) }, uHorizon: { value: new THREE.Color(0x10131a) }, uBottom: { value: new THREE.Color(0x020203) } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom; varying vec3 vDir;
    void main(){
      float y = vDir.y;
      vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(y, 0.6)) : mix(uHorizon, uBottom, pow(-y, 0.45));
      gl_FragColor = vec4(c, 1.0);
    }`
};

/** A faint lattice far below the play plane; scrolls at half speed (parallax) and fades with distance. */
const DeepLatticeShader = {
  uniforms: { uOffset: { value: 0 }, uColor: { value: new THREE.Color(PALETTE.lattice) }, uCenter: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform float uOffset; uniform vec3 uColor; uniform vec2 uCenter; varying vec2 vW;
    void main(){
      vec2 p = vec2(vW.x, vW.y + uOffset) / 8.0;
      vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
      float line = 1.0 - min(min(g.x, g.y), 1.0);
      float dist = length(vW - uCenter);
      float fade = exp(-dist * 0.028);
      gl_FragColor = vec4(uColor * line * fade * 0.16, 1.0);
    }`
};

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  mobile: boolean;
}

/** Owns the WebGL renderer, scene, lights, fog and atmosphere; post + VFX come from the shell Look Kit. */
export class TesseraScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly key: THREE.DirectionalLight;
  readonly look: LookKit;
  private readonly post: ShaderPass;
  private readonly deep: THREE.Mesh;
  private readonly backdrop: THREE.Mesh;
  readonly world = new THREE.Group();
  private dust: THREE.Points;
  private monoliths = new THREE.Group();
  readonly mobile: boolean;

  constructor(opts: SceneOptions) {
    this.mobile = opts.mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
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
    Object.assign(this.key.shadow.camera, { left: -14, right: 14, top: 18, bottom: -18, near: 1, far: 60 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 3;
    this.scene.add(this.key, this.key.target);
    this.scene.add(new THREE.HemisphereLight(0x8fa3c7, 0x0a0b10, 0.55));

    // void depth (§1.1): gradient backdrop + parallax lattice far below
    this.backdrop = new THREE.Mesh(new THREE.SphereGeometry(170, 24, 16), new THREE.ShaderMaterial({ ...BackdropShader, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.backdrop.renderOrder = -10;
    this.scene.add(this.backdrop);
    const deepMat = new THREE.ShaderMaterial({ ...DeepLatticeShader, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.deep = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), deepMat);
    this.deep.position.y = -34;
    this.scene.add(this.deep);

    this.dust = this.makeDust();
    this.scene.add(this.dust);
    this.makeMonoliths();
    this.scene.add(this.monoliths);

    // Look Kit: post stack (bloom → ACES output → grade/vignette/pulses/flash → AA) + pooled VFX, Tessera palette
    const palette = createPalette({ ...TESSERA_TOKENS }, tunables);
    if (opts.mobile) tunables.set("look.post", "quality", "low"); // mobile post at half resolution (GDD §45 platform constraint)
    this.look = createLook({ renderer: this.renderer, scene: this.scene, camera: this.camera, palette, particles: opts.mobile ? 1500 : 4000 });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.post = new ShaderPass(TesseraPostShader);
    const passes = this.look.post.composer.passes;
    this.look.post.composer.insertPass(this.post, Math.max(0, passes.length - 1));
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
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * cosmetic.range(1, 3.2), s), mat);
      m.position.set(cosmetic.sign() * cosmetic.range(26, 70), cosmetic.range(-30, 10), cosmetic.range(-140, -20));
      m.rotation.set(cosmetic.range(-0.2, 0.2), cosmetic.range(0, Math.PI), cosmetic.range(-0.15, 0.15));
      m.userData.drift = cosmetic.range(0.02, 0.06) * cosmetic.sign();
      this.monoliths.add(m);
    }
  }

  resize(w: number, h: number): void {
    this.look.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
  }

  /** Last Stand inversion 0..1, total chromatic aberration (Last Stand + transient), warm lift, inhale dim. */
  setPost(p: { invert: number; aberration: number; warm: number; dim: number }): void {
    const u = this.post.uniforms;
    u.uInvert!.value = p.invert;
    u.uAberration!.value = p.aberration;
    u.uWarm!.value = p.warm;
    u.uDim!.value = p.dim;
  }

  /** Atmosphere + shadow camera follow the focus point. `dt` is presentation time. */
  updateAtmosphere(focusZ: number, dt: number): void {
    this.key.position.set(-9, 18, focusZ + 6);
    this.key.target.position.set(0, 0, focusZ - 4);
    this.monoliths.position.z = focusZ * 0.6;
    this.backdrop.position.set(0, 0, focusZ);
    this.deep.position.z = focusZ;
    const dm = this.deep.material as THREE.ShaderMaterial;
    dm.uniforms.uOffset!.value = -focusZ * 0.5; // half-speed parallax against the play plane
    dm.uniforms.uCenter!.value.set(0, focusZ - 10);
    for (const m of this.monoliths.children) m.rotation.y += (m.userData.drift as number) * dt;
    const p = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, p.getY(i) + dt * 0.12 > 16 ? -6 : p.getY(i) + dt * 0.12);
      const z = p.getZ(i);
      if (z > focusZ + 14) p.setZ(i, focusZ - 60);
      if (z < focusZ - 60) p.setZ(i, focusZ + 14);
    }
    p.needsUpdate = true;
  }

  render(presentationDt: number): void {
    this.look.update(presentationDt);
    this.look.render();
  }
}
