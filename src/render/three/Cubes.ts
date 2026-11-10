import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { World } from "../../sim/World";
import { Cubes } from "../../sim/Cubes";
import type { CubeType, Cell } from "../../sim/types";
import { PALETTE } from "../../data/palette";
import { TUNING } from "../../data/tuning";
import { rollPose } from "../rollMath";
import { stoneTexture, crackTexture, ironTexture, chevronTexture } from "./textures";
import { HALF, TILE, wx, wz } from "./Scene";

interface CubeView {
  id: number;
  type: CubeType;
  root: THREE.Group;
  body: THREE.Group;
  pips: THREE.Mesh[];
  core: THREE.Mesh | null;
  shadow: THREE.Mesh;
  escaping: number; // −1 alive; else frames into the escape tumble
  seen: boolean;
}

const SCALE = 0.95;

/** Builds and poses cube presentation from sim state (GDD §13 silhouettes, §10 roll, §23 cell shadows). */
export class CubesView {
  readonly group = new THREE.Group();
  private views = new Map<number, CubeView>();
  private geo = new RoundedBoxGeometry(TILE, TILE, TILE, 3, 0.12);
  private mats: Record<string, THREE.Material>;
  private shadowGeo = new THREE.PlaneGeometry(TILE * 0.92, TILE * 0.92).rotateX(-Math.PI / 2);
  private shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false });
  private skyMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, depthWrite: false });
  private chevron: THREE.Mesh;
  private tethers = new Map<number, THREE.Mesh>();
  private tetherGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6).rotateZ(Math.PI / 2);
  private tetherMat = new THREE.MeshBasicMaterial({ color: 0xd9e4ff, toneMapped: false, transparent: true, opacity: 0.85 });
  private t = 0;

  constructor() {
    this.mats = {
      stone: new THREE.MeshStandardMaterial({ color: PALETTE.stone, map: stoneTexture(), roughness: 0.82, metalness: 0.02 }),
      advantage: new THREE.MeshStandardMaterial({ color: 0x5f6a66, map: stoneTexture(), roughness: 0.75, emissive: PALETTE.advantage, emissiveMap: crackTexture(), emissiveIntensity: 1.6 }),
      glass: new THREE.MeshPhysicalMaterial({ color: PALETTE.glass, roughness: 0.06, transparent: true, opacity: 0.42, clearcoat: 1, emissive: PALETTE.glass, emissiveIntensity: 0.08, depthWrite: false }),
      iron: new THREE.MeshStandardMaterial({ color: 0x6b717b, map: ironTexture(), roughness: 0.38, metalness: 0.85 }),
      phase: new THREE.MeshPhysicalMaterial({ color: 0xc9d4ff, roughness: 0.2, transparent: true, opacity: 0.32, emissive: 0x9fb2ff, emissiveIntensity: 0.25, depthWrite: false }),
      forbiddenFrame: new THREE.MeshStandardMaterial({ color: 0x2a2633, roughness: 0.3, metalness: 0.5, emissive: 0x6e6680, emissiveIntensity: 0.28 }),
      forbiddenCore: new THREE.MeshBasicMaterial({ color: PALETTE.forbiddenCore, toneMapped: false }),
      pip: new THREE.MeshStandardMaterial({ color: 0x8e939b, metalness: 0.6, roughness: 0.55 }) // matte: must fog with its cube, never outshine it
    };
    const chev = new THREE.PlaneGeometry(TILE * 0.6, TILE * 0.6).rotateX(-Math.PI / 2);
    this.chevron = new THREE.Mesh(chev, new THREE.MeshBasicMaterial({ map: chevronTexture(), color: 0xdfe6f2, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
    this.chevron.visible = false;
    this.group.add(this.chevron);
  }

  private build(id: number, type: CubeType): CubeView {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const pips: THREE.Mesh[] = [];
    let core: THREE.Mesh | null = null;
    if (type === "forbidden") {
      // the only hollow silhouette: 12 edge beams around an open interior, violet core floating inside
      const t = 0.34;
      const L = TILE;
      const beam = new THREE.BoxGeometry(L, t, t);
      for (const [ax, a, b] of [["x", 1, 1], ["x", 1, -1], ["x", -1, 1], ["x", -1, -1], ["y", 1, 1], ["y", 1, -1], ["y", -1, 1], ["y", -1, -1], ["z", 1, 1], ["z", 1, -1], ["z", -1, 1], ["z", -1, -1]] as const) {
        const m = new THREE.Mesh(beam, this.mats.forbiddenFrame);
        const o = (L - t) / 2;
        if (ax === "x") m.position.set(0, a * o, b * o);
        if (ax === "y") {
          m.rotation.z = Math.PI / 2;
          m.position.set(a * o, 0, b * o);
        }
        if (ax === "z") {
          m.rotation.y = Math.PI / 2;
          m.position.set(a * o, b * o, 0);
        }
        m.castShadow = true;
        body.add(m);
      }
      core = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), this.mats.forbiddenCore);
      body.add(core);
    } else {
      const m = new THREE.Mesh(this.geo, this.mats[type]);
      m.castShadow = type !== "glass" && type !== "phase";
      m.receiveShadow = true;
      body.add(m);
      if (type === "iron") {
        const g = new THREE.SphereGeometry(0.14, 10, 8);
        for (let i = 0; i < TUNING.iron.hp; i++) {
          const p = new THREE.Mesh(g, this.mats.pip);
          p.position.set((i - 1) * 0.5, HALF + 0.02, 0);
          body.add(p);
          pips.push(p);
        }
      }
      if (type === "advantage") {
        core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: PALETTE.advantage, toneMapped: false }));
        body.add(core);
      }
    }
    body.scale.setScalar(SCALE);
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.renderOrder = 1;
    this.group.add(root, shadow);
    const v: CubeView = { id, type, root, body, pips, core, shadow, escaping: -1, seen: true };
    this.views.set(id, v);
    return v;
  }

  /** Called on Kill: hide immediately (VFX takes over). */
  kill(id: number): void {
    const v = this.views.get(id);
    if (!v) return;
    this.dispose(v);
  }

  private fallAll = false;
  /** The Turn: every cube that leaves the sim this frame tumbles into the void instead of vanishing. */
  departingFall(): void {
    this.fallAll = true;
  }

  /** Called on Escape: the cube tumbles over the rear edge into the void. */
  escape(id: number): void {
    const v = this.views.get(id);
    if (v) v.escaping = 0;
  }

  private dispose(v: CubeView): void {
    this.group.remove(v.root, v.shadow);
    this.views.delete(v.id);
    const t = this.tethers.get(v.id);
    if (t) {
      this.group.remove(t);
      this.tethers.delete(v.id);
    }
  }

  get(id: number): THREE.Object3D | undefined {
    return this.views.get(id)?.root;
  }

  update(w: World, alpha: number, dt: number, cursor: Cell | null, tileTop: (x: number, z: number) => number): void {
    this.t += dt;
    for (const v of this.views.values()) v.seen = false;
    const live = w.cubes.alive();
    for (const c of live) {
      const v = this.views.get(c.id) ?? this.build(c.id, c.type);
      v.seen = true;
      const fr = w.f + alpha;
      let y = 0;
      let zOff = 0;
      let rot = 0;
      if (c.landTick >= 0) {
        // Skyfall: falls from above over its telegraph; shadow grows on the target
        const totalF = TUNING.skyfall.telegraphTicks * w.tickLen;
        const left = (c.landTick - w.tick) * w.tickLen - fr;
        const u = Math.max(0, Math.min(1, 1 - left / totalF));
        y = HALF + (1 - u * u) * 34;
        const s = 0.25 + 0.75 * u;
        v.shadow.scale.set(s, 1, s);
        this.skyMat.opacity = 0.35 + 0.5 * u;
        v.shadow.material = this.skyMat;
      } else {
        v.shadow.material = this.shadowMat;
        v.shadow.scale.set(1, 1, 1);
        const p = Cubes.rolling(c, w.f, w.tickLen) ? Math.min(1, (fr - (w.tickLen - TUNING.clock.rollFrames)) / TUNING.clock.rollFrames) : 0;
        const pose = rollPose(p, HALF);
        y = pose.y;
        zOff = -pose.z;
        rot = -pose.angle;
        if (c.age === 0 && c.sinceLand < 0) y -= (1 - Math.min(1, fr / w.tickLen)) * 3; // rises out of the fog on spawn
        if (c.sinceLand === 0 && w.f < 10) v.body.scale.set(SCALE * (1 + 0.12 * (1 - w.f / 10)), SCALE * (1 - 0.16 * (1 - w.f / 10)), SCALE * (1 + 0.12 * (1 - w.f / 10)));
        else v.body.scale.setScalar(SCALE);
      }
      v.root.position.set(wx(c.x), y, wz(c.z) + zOff);
      v.root.rotation.set(rot, 0, 0);
      // crisp square shadow on the logical cell, independent of lighting (LOCKED)
      const l = w.logical(c) ?? { x: c.x, z: c.z };
      v.shadow.position.set(wx(l.x), tileTop(l.x, l.z) + 0.015, wz(l.z));
      // Iron HP pips
      v.pips.forEach((p, i) => (p.visible = i < c.hp));
      if (v.core) {
        const k = v.type === "forbidden" ? 1 + 0.25 * Math.sin(this.t * 4 + c.id) : 1 + 0.1 * Math.sin(this.t * 3 + c.id);
        v.core.scale.setScalar(k);
        v.core.rotation.y += dt * 1.4;
      }
      // Phase tether
      if (c.type === "phase" && c.twin > c.id) {
        const twin = w.cubes.byId(c.twin);
        let t = this.tethers.get(c.id);
        if (twin) {
          if (!t) {
            t = new THREE.Mesh(this.tetherGeo, this.tetherMat);
            this.tethers.set(c.id, t);
            this.group.add(t);
          }
          t.position.set((wx(c.x) + wx(twin.x)) / 2, v.root.position.y, v.root.position.z);
          t.scale.set(Math.abs(wx(twin.x) - wx(c.x)), 1 + 0.3 * Math.sin(this.t * 9), 1);
        }
      }
    }
    // unseen: escaped (tumble) or killed elsewhere
    for (const v of [...this.views.values()]) {
      if (v.seen) continue;
      if (v.escaping < 0 && this.fallAll) v.escaping = 0;
      if (v.escaping < 0) {
        this.dispose(v);
        continue;
      }
      v.escaping += dt * 60;
      const t = v.escaping;
      v.shadow.visible = false;
      v.root.position.y -= 0.004 * t * t * 0.1 + 0.05;
      v.root.position.z += 0.06;
      v.root.rotation.x += 0.05;
      if (t > 60) this.dispose(v);
    }
    this.fallAll = false;
    // next-cell chevron when the cursor is on a cube's cell
    this.chevron.visible = false;
    if (cursor) {
      const c = w.cubeAt(cursor);
      if (c && c.landTick < 0) {
        const n = w.nextCell(c);
        this.chevron.position.set(wx(n.x), tileTop(n.x, n.z) + 0.03, wz(n.z));
        this.chevron.visible = true;
        (this.chevron.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.3 * Math.sin(this.t * 6);
      }
    }
    for (const [id, t] of [...this.tethers]) {
      if (!w.cubes.byId(id)) {
        this.group.remove(t);
        this.tethers.delete(id);
      }
    }
  }
}
