import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { World } from "../../sim/World";
import type { SimEvent } from "../../sim/Events";
import type { TileType } from "../../sim/types";
import { PALETTE } from "../../data/palette";
import { TUNING } from "../../data/tuning";
import { cosmetic } from "../cosmetic";
import { groundTexture, seamTexture, glyphTexture, scarTexture } from "./textures";
import { TILE, wx, wz } from "./Scene";

interface TileView {
  x: number;
  z: number;
  type: TileType;
  /** Frames since birth (rise uses the first 12 + delay). */
  age: number;
  delay: number;
  falling: number; // −1 not falling; else frames into the fall
  fallDelay: number;
  spin: number;
  warn: number; // crumble warning frames remaining
  crack: number;
  bornFrame: number;
  instant: boolean;
  /** The Turn: this tile hinges down about the ledge's rear edge and stays as a cliff face. */
  wall?: { edgeZ: number; t: number };
  /** Frames of Turn warning left (cold pulse on tiles about to become wall). */
  turnWarn?: number;
}

const MAX = 320;
const THICK = 0.7;
const RISE = 12;
const FALL = 44;

/** Presentation of the ground (GDD §23 tiles, §24 rise/crumble, §25 creation/threat families). */
export class TilesView {
  readonly group = new THREE.Group();
  private views = new Map<number, TileView>();
  private body: THREE.InstancedMesh;
  private glass: THREE.InstancedMesh;
  private seams: THREE.InstancedMesh;
  private glyphs: THREE.InstancedMesh;
  private scars: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private frame = 0;
  private fallSeq = 0;
  reducedMotion = false;

  constructor() {
    const geo = new RoundedBoxGeometry(TILE * 0.97, THICK, TILE * 0.97, 2, 0.06);
    geo.translate(0, -THICK / 2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: groundTexture(), roughness: 0.88, metalness: 0.02 });
    this.body = new THREE.InstancedMesh(geo, mat, MAX);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const gmat = new THREE.MeshPhysicalMaterial({ color: PALETTE.glass, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1, emissive: PALETTE.glass, emissiveIntensity: 0.12 });
    this.glass = new THREE.InstancedMesh(geo, gmat, 64);
    this.glass.receiveShadow = true;

    const plane = new THREE.PlaneGeometry(TILE * 0.97, TILE * 0.97);
    plane.rotateX(-Math.PI / 2);
    const smat = new THREE.MeshBasicMaterial({ map: seamTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.seams = new THREE.InstancedMesh(plane, smat, MAX);
    this.seams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const glmat = new THREE.MeshBasicMaterial({ map: glyphTexture(), color: PALETTE.advantage, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.glyphs = new THREE.InstancedMesh(plane, glmat, 16);
    const scmat = new THREE.MeshBasicMaterial({ map: scarTexture(), transparent: true, depthWrite: false });
    this.scars = new THREE.InstancedMesh(plane, scmat, 64);

    this.group.add(this.body, this.glass, this.seams, this.glyphs, this.scars);
  }

  private key(x: number, z: number): number {
    return z * 8 + x;
  }

  onEvent(e: SimEvent, frame: number): void {
    if (e.t === "TurnWarn") {
      for (const v of this.views.values()) if (v.falling < 0 && !v.wall && v.z < e.edgeZ) v.turnWarn = e.frames;
      return;
    }
    if (e.t === "Turn") {
      for (const c of e.walls) {
        const k = this.key(c.x, c.z);
        const v = this.views.get(k);
        if (!v) continue;
        v.wall = { edgeZ: e.edgeZ, t: 0 };
        v.turnWarn = 0;
        this.views.delete(k);
        this.views.set(-++this.fallSeq, v); // persists as cliff; never reconciled as falling
      }
      return;
    }
    if (e.t === "TileRise") {
      const k = this.key(e.x, e.z);
      const v = this.views.get(k);
      if (v && v.falling < 0) {
        v.type = e.type;
        v.age = 0;
        v.delay = e.delay;
        return;
      }
      this.views.set(k, { x: e.x, z: e.z, type: e.type, age: 0, delay: e.delay, falling: -1, fallDelay: 0, spin: 0, warn: 0, crack: 0, bornFrame: frame, instant: false });
    } else if (e.t === "TileFall") {
      const v = this.views.get(this.key(e.x, e.z));
      if (v && v.falling < 0) {
        v.falling = 0;
        v.fallDelay = e.delay;
        v.spin = cosmetic.range(-1, 1);
        this.views.delete(this.key(e.x, e.z));
        this.views.set(-++this.fallSeq, v); // keep animating under a unique negative key
      }
    } else if (e.t === "CrumbleWarn") {
      for (const v of this.views.values()) if (v.z === e.z && v.falling < 0) v.warn = e.frames;
    } else if (e.t === "GlassCrack") {
      const v = this.views.get(this.key(e.x, e.z));
      if (v) v.crack = 1;
    }
  }

  /** Reconcile with the authoritative grid (start slab, resets) and advance animation. */
  update(w: World, dtFrames: number, warnRow: number | null): void {
    this.frame += dtFrames;
    for (const t of w.grid.list()) {
      const k = this.key(t.x, t.z);
      const v = this.views.get(k);
      if (!v) this.views.set(k, { x: t.x, z: t.z, type: t.type, age: RISE + 1, delay: 0, falling: -1, fallDelay: 0, spin: 0, warn: 0, crack: 0, bornFrame: 0, instant: true });
      else if (v.type !== t.type) v.type = t.type;
    }
    for (const [k, v] of [...this.views]) {
      if (v.falling < 0 && k >= 0 && !w.grid.has(v.x, v.z)) {
        v.falling = 0;
        this.views.delete(k);
        this.views.set(-++this.fallSeq, v);
      }
    }

    let nb = 0;
    let ng = 0;
    let ns = 0;
    let ngl = 0;
    const removals: number[] = [];
    const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.35);
    for (const [k, v] of this.views) {
      v.age += dtFrames;
      if (v.warn > 0) v.warn = Math.max(0, v.warn - dtFrames);
      let y = 0;
      let rx = 0;
      let rz = 0;
      let s = 1;
      if (v.wall) {
        // hinge 90° down about the ledge's rear edge (GDD §18: ground on one face becomes a wall on the next)
        v.wall.t += dtFrames;
        const u = Math.min(1, v.wall.t / TUNING.turn.frames);
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        const theta = (this.reducedMotion ? Math.round(u) : e) * (Math.PI / 2);
        const pivotZ = wz(v.wall.edgeZ) + TILE / 2;
        const d = wz(v.z) - pivotZ;
        this.dummy.position.set(wx(v.x), -d * Math.sin(theta), pivotZ + d * Math.cos(theta));
        this.dummy.rotation.set(theta, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        if (nb < MAX) {
          this.body.setMatrixAt(nb, this.dummy.matrix);
          this.color.setRGB(1.05, 1.0, 0.96); // reads as former ground, not void
          this.body.setColorAt(nb, this.color);
          nb++;
        }
        if (ns < MAX) {
          this.seams.setMatrixAt(ns, this.dummy.matrix);
          this.color.setHex(PALETTE.seam).multiplyScalar(0.5 * (1 - u) + 0.14);
          this.seams.setColorAt(ns, this.color);
          ns++;
        }
        continue;
      }
      if (v.turnWarn && v.turnWarn > 0) v.turnWarn = Math.max(0, v.turnWarn - dtFrames);
      if (v.falling >= 0) {
        v.falling += dtFrames;
        const t = Math.max(0, v.falling - v.fallDelay);
        if (t > FALL) {
          removals.push(k);
          continue;
        }
        y = -0.5 * 0.022 * t * t;
        rx = v.spin * t * 0.02;
        rz = v.spin * t * 0.015;
      } else if (!v.instant) {
        const t = Math.max(0, v.age - v.delay);
        if (v.age < v.delay) {
          y = -6;
          s = 0.001;
        } else if (t < RISE) {
          // rise from the void with a 5% overshoot, then settle
          const u = t / RISE;
          const e = this.reducedMotion ? u : 1 - Math.pow(1 - u, 3);
          y = -3.5 * (1 - e) + (this.reducedMotion ? 0 : Math.sin(u * Math.PI) * 0.12);
        } else if (t < RISE + 8) {
          y = Math.sin(((t - RISE) / 8) * Math.PI) * 0.035;
        }
      }
      const raised = v.type === "raised";
      this.dummy.position.set(wx(v.x), y + (raised ? TUNING.iron.raise : 0), wz(v.z));
      this.dummy.rotation.set(rx, 0, rz);
      this.dummy.scale.set(s, raised ? (THICK + TUNING.iron.raise) / THICK : 1, s);
      this.dummy.updateMatrix();
      if (v.type === "glass") {
        if (ng < 64) this.glass.setMatrixAt(ng++, this.dummy.matrix);
      } else if (nb < MAX) {
        this.body.setMatrixAt(nb, this.dummy.matrix);
        const warm = v.falling >= 0 ? 0.55 : 1;
        this.color.setRGB(warm, warm * 0.98, warm * 0.96);
        if (raised) this.color.multiplyScalar(1.12);
        this.body.setColorAt(nb, this.color);
        nb++;
      }
      // seams: amber that brightens with age; red pulse during crumble warning
      if (ns < MAX && v.type !== "glass") {
        this.dummy.position.y += 0.012;
        this.dummy.scale.y = 1;
        this.dummy.updateMatrix();
        this.seams.setMatrixAt(ns, this.dummy.matrix);
        const ageTicks = Math.max(0, (w.frame - v.bornFrame) / w.tickLen);
        let b = 0.18 + Math.min(0.55, ageTicks * 0.035);
        if (!v.instant && v.age < RISE + 20) b += (1 - (v.age - v.delay) / (RISE + 20)) * 1.6; // ignition
        this.color.setHex(PALETTE.seam).multiplyScalar(Math.max(0, b));
        const warned = v.warn > 0 || (warnRow !== null && v.z === warnRow && v.falling < 0);
        if (warned) this.color.setHex(PALETTE.crumbleWarn).multiplyScalar(0.8 + pulse * 1.4);
        else if (v.turnWarn && v.turnWarn > 0) this.color.setHex(PALETTE.glass).multiplyScalar(0.5 + pulse * 1.2); // cold: the world is about to move
        if (v.falling >= 0) this.color.multiplyScalar(0.3);
        this.seams.setColorAt(ns, this.color);
        ns++;
        if (v.type === "glyph" && ngl < 16 && v.falling < 0) {
          this.dummy.position.y += 0.004;
          this.dummy.updateMatrix();
          this.glyphs.setMatrixAt(ngl++, this.dummy.matrix);
        }
      }
    }
    for (const k of removals) this.views.delete(k);
    this.body.count = nb;
    this.glass.count = ng;
    this.seams.count = ns;
    this.glyphs.count = ngl;
    this.body.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    this.glass.instanceMatrix.needsUpdate = true;
    this.seams.instanceMatrix.needsUpdate = true;
    if (this.seams.instanceColor) this.seams.instanceColor.needsUpdate = true;
    this.glyphs.instanceMatrix.needsUpdate = true;
    (this.glyphs.material as THREE.MeshBasicMaterial).color.setHex(PALETTE.advantage).multiplyScalar(1.2 + pulse * 0.8);

    const scars = w.grid.scarList();
    let nsc = 0;
    for (const sc of scars) {
      if (nsc >= 64) break;
      this.dummy.position.set(wx(sc.x), 0.02, wz(sc.z));
      this.dummy.rotation.set(0, (sc.x * 7 + sc.z * 13) % 6, 0);
      this.dummy.scale.set(1.15, 1, 1.15);
      this.dummy.updateMatrix();
      this.scars.setMatrixAt(nsc++, this.dummy.matrix);
    }
    this.scars.count = nsc;
    this.scars.instanceMatrix.needsUpdate = true;
  }

  /** Visual top height of a cell (for figure, shadows, marks). */
  topAt(x: number, z: number, w: World): number {
    const t = w.grid.get(x, z);
    return t?.type === "raised" ? TUNING.iron.raise : 0;
  }
}
