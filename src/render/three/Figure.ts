import * as THREE from "three";
import type { World } from "../../sim/World";
import { TUNING } from "../../data/tuning";
import { PALETTE } from "../../data/palette";
import { DIR_DX, DIR_DZ } from "../../sim/types";
import { dotTexture } from "./textures";
import { wx, wz } from "./Scene";

/** The figure (GDD §13, §23, §24): slim obelisk 0.5 × 1.4 with a floating amber core. */
export class FigureView {
  readonly root = new THREE.Group();
  private body: THREE.Mesh;
  private core: THREE.Mesh;
  private halo: THREE.Sprite;
  readonly light: THREE.PointLight;
  private pips: THREE.Mesh[] = [];
  private glyphs: THREE.Mesh[] = [];
  private t = 0;
  private flare = 0;
  private flareDir = new THREE.Vector3();
  /** World position of the core (for streams and camera). */
  readonly corePos = new THREE.Vector3();
  coreLevel = 1;
  reducedMotion = false;

  constructor() {
    const geo = new THREE.CylinderGeometry(0.16, 0.25, 1.4, 4, 1);
    geo.rotateY(Math.PI / 4);
    geo.translate(0, 0.7, 0);
    this.body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: PALETTE.figure, roughness: 0.92, metalness: 0 }));
    this.body.castShadow = true;
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.core).multiplyScalar(4), toneMapped: false }));
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: PALETTE.core, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.halo.scale.setScalar(1.4);
    this.light = new THREE.PointLight(PALETTE.core, 6, 9, 1.6);
    this.root.add(this.body, this.core, this.halo, this.light);
    const pipGeo = new THREE.PlaneGeometry(0.22, 0.22).rotateX(-Math.PI / 2);
    const pipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.mark).multiplyScalar(2), toneMapped: false, transparent: true });
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(pipGeo, pipMat.clone());
      this.root.add(p);
      this.pips.push(p);
    }
    const gGeo = new THREE.OctahedronGeometry(0.09, 0);
    const gMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.advantage).multiplyScalar(2.2), toneMapped: false });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Mesh(gGeo, gMat);
      this.root.add(g);
      this.glyphs.push(g);
    }
  }

  /** Mark gesture: the core flares toward the marked cell. */
  flareToward(x: number, z: number): void {
    this.flare = 1;
    this.flareDir.set(wx(x) - this.root.position.x, 0, wz(z) - this.root.position.z).normalize();
  }

  update(w: World, alpha: number, dt: number, tileTop: (x: number, z: number) => number): void {
    this.t += dt;
    const p = w.player;
    const fr = p.t + alpha;
    let x = wx(p.x);
    let z = wz(p.z);
    let y = tileTop(p.x, p.z);
    let lean = 0;
    let spin = 0;
    let wobble = 0;
    const from = { x: wx(p.fromX), z: wz(p.fromZ), y: tileTop(p.fromX, p.fromZ) };
    if (p.state === "stepping") {
      const u = Math.min(1, fr / TUNING.movement.stepFrames);
      const e = 1 - Math.pow(1 - u, 3);
      x = from.x + (x - from.x) * e;
      z = from.z + (z - from.z) * e;
      y = from.y + (y - from.y) * e + Math.sin(u * Math.PI) * TUNING.movement.hopArc;
      lean = Math.sin(u * Math.PI) * 0.16;
    } else if (p.state === "shoved") {
      const u = Math.min(1, fr / TUNING.movement.shoveSlideFrames);
      const e = 1 - Math.pow(1 - u, 2);
      x = from.x + (x - from.x) * e;
      z = from.z + (z - from.z) * e;
      lean = -0.3 * (1 - u);
    } else if (p.state === "stunned") {
      wobble = Math.sin(this.t * 30) * 0.08 * (p.stun / TUNING.crush.stunFrames);
    } else if (p.state === "falling") {
      const u = fr / TUNING.movement.fallFrames;
      y -= 0.5 * 9.8 * Math.pow(fr / 60, 2) * 2.2;
      spin = u * 5;
    }
    if (p.nudge > 0 && p.state === "idle") {
      const d = (p.nudge / TUNING.movement.blockedNudgeFrames) * 0.12;
      x += DIR_DX[p.facing] * d;
      z -= DIR_DZ[p.facing] * d;
    }
    this.root.position.set(x, y, z);
    // facing lean toward movement direction
    const fx = DIR_DX[p.facing];
    const fz = -DIR_DZ[p.facing];
    this.body.rotation.set(fz * lean + wobble, spin, -fx * lean + wobble * 0.6);
    // idle hover of the core; brightness follows ground (core hum "brightens with ground")
    const hover = this.reducedMotion ? 0 : Math.sin(this.t * 2.2) * 0.06;
    this.flare = Math.max(0, this.flare - dt * 6);
    const fd = this.flare * 0.35;
    this.core.position.set(this.flareDir.x * fd, 1.75 + hover, this.flareDir.z * fd);
    const conn = w.connected().length;
    const target = p.state === "falling" ? Math.max(0, 1 - fr / TUNING.movement.fallFrames) : 0.75 + Math.min(0.5, conn / 60);
    this.coreLevel += (target - this.coreLevel) * Math.min(1, dt * 4);
    const k = this.coreLevel * (1 + this.flare * 0.8);
    (this.core.material as THREE.MeshBasicMaterial).color.setHex(PALETTE.core).multiplyScalar(2.2 + 3 * k);
    this.halo.position.copy(this.core.position);
    this.halo.scale.setScalar(1.1 + 0.6 * k);
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.5 + 0.4 * Math.min(1, k);
    this.light.position.copy(this.core.position);
    this.light.intensity = 3 + 5 * k;
    this.core.rotation.y += dt * 1.2;
    this.core.getWorldPosition(this.corePos);
    // mark pips under the figure: one per allowed mark, lit when placed
    const max = w.maxMarks;
    const used = w.marks.count;
    this.pips.forEach((pip, i) => {
      pip.visible = i < max && p.alive;
      const ang = ((i - (max - 1) / 2) * 0.55) + Math.PI / 2;
      pip.position.set(Math.cos(ang) * 0.55, 0.03, Math.sin(ang) * 0.55);
      const m = pip.material as THREE.MeshBasicMaterial;
      m.opacity = i < max - used ? 0.95 : 0.18;
    });
    // glyphs orbit the figure
    const n = w.run.glyphs.length;
    this.glyphs.forEach((g, i) => {
      g.visible = i < n && p.alive;
      const a = this.t * 1.3 + (i / Math.max(1, n)) * Math.PI * 2;
      g.position.set(Math.cos(a) * 0.62, 1.1 + Math.sin(this.t * 2 + i) * 0.08, Math.sin(a) * 0.62);
      g.rotation.y += dt * 3;
    });
  }
}
