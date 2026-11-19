import * as THREE from "three";
import type { LookKit, VfxHandle } from "@slu/web-shell/look/three";
import type { CubeType } from "../../sim/types";
import { PALETTE } from "../../data/palette";
import { cosmetic } from "../cosmetic";
import { dotTexture } from "./textures";
import { HALF, TILE, wx, wz } from "./Scene";

interface Shard {
  alive: boolean;
  p: THREE.Vector3;
  v: THREE.Vector3;
  r: THREE.Euler;
  w: THREE.Vector3;
  s: number;
  life: number;
  max: number;
  color: THREE.Color;
  implode: number;
}

interface Stream {
  pts: THREE.Points;
  from: THREE.Vector3;
  life: number;
}

const SHARD_MAX = 900;

const SHARD_COLOR: Readonly<Record<CubeType, number>> = {
  stone: PALETTE.stone,
  advantage: PALETTE.advantage,
  forbidden: PALETTE.forbiddenCore,
  glass: PALETTE.glass,
  iron: 0x5d636c,
  phase: 0xc9d4ff
};

const TOKEN: Readonly<Record<CubeType, string>> = { stone: "stone", advantage: "advantage", forbidden: "soul", glass: "energy", iron: "edge", phase: "highlight" };

/**
 * Effect families (GDD §25). Shared effects (shockwaves, sparks, smoke, charge) come from the shell Look Kit VFX
 * runtime; only Tessera-specific geometry lives here: the cube shard collapse-then-burst and the Beacon light stream.
 * All `update` time is presentation time from the Feel Kit, so hitstop freezes these without touching the sim.
 */
export class VfxView {
  readonly group = new THREE.Group();
  private shards: Shard[] = [];
  private mesh: THREE.InstancedMesh;
  private streams: Stream[] = [];
  private dummy = new THREE.Object3D();
  private charges = new Map<string, VfxHandle>();
  reduceFlashes = false;
  private flashes: Array<{ mesh: THREE.Mesh; left: number; max: number }> = [];

  constructor(private readonly look: LookKit) {
    const geo = new THREE.TetrahedronGeometry(0.22, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.15 });
    this.mesh = new THREE.InstancedMesh(geo, mat, SHARD_MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.group.add(this.mesh);
    const fg = new THREE.PlaneGeometry(TILE * 0.98, TILE * 0.98).rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.mark).multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.visible = false;
      this.group.add(m);
      this.flashes.push({ mesh: m, left: 0, max: 1 });
    }
    for (let i = 0; i < SHARD_MAX; i++) {
      this.shards.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1, life: 0, max: 1, color: new THREE.Color(), implode: 0 });
    }
  }

  private at(x: number, z: number, y: number): { x: number; y: number; z: number } {
    return { x: wx(x), y, z: wz(z) };
  }

  private spawnShard(at: THREE.Vector3, color: number, speed: number, implode: number, up = 1, size = 1): void {
    const s = this.shards.find((x) => !x.alive);
    if (!s) return;
    s.alive = true;
    s.p.copy(at).add(new THREE.Vector3(cosmetic.range(-HALF, HALF), cosmetic.range(-HALF, HALF), cosmetic.range(-HALF, HALF)));
    const dir = s.p.clone().sub(at).normalize();
    s.v.copy(dir).multiplyScalar(speed * cosmetic.range(0.6, 1.3));
    s.v.y += up * cosmetic.range(2, 5);
    s.r.set(cosmetic.rand() * 6, cosmetic.rand() * 6, cosmetic.rand() * 6);
    s.w.set(cosmetic.range(-8, 8), cosmetic.range(-8, 8), cosmetic.range(-8, 8));
    s.s = cosmetic.range(0.6, 1.4) * size;
    s.life = 0;
    s.max = cosmetic.range(0.7, 1.2);
    s.color.setHex(color);
    s.implode = implode;
  }

  /**
   * Signature kill: the cube shatters into `shards` heavy pieces (6–10, more as a chain climbs) that fall past the
   * floor into the void and fade, plus a short amber flash on the cell.
   */
  kill(x: number, z: number, y: number, type: CubeType, heavy: boolean, shards = 8): void {
    const at = new THREE.Vector3(wx(x), y + HALF, wz(z));
    for (let i = 0; i < shards; i++) this.spawnShard(at, SHARD_COLOR[type], heavy ? 5 : 3.5, 0.06, 0.6, 2.1);
    this.look.play("fx.impact.burst", { position: this.at(x, z, y + HALF), scale: heavy ? 0.7 : 0.4, tint: TOKEN[type] });
  }

  /** A 4-frame amber flash on the killed cell (flat, additive). Reduce Flashes halves it. */
  cellFlash(x: number, z: number, y: number, frames: number): void {
    if (frames <= 0) return;
    const f = this.flashes.find((q) => q.left <= 0);
    if (!f) return;
    f.left = f.max = frames;
    f.mesh.position.set(wx(x), y + 0.05, wz(z));
    f.mesh.visible = true;
  }

  ironSpark(x: number, z: number): void {
    this.look.play("fx.impact.burst", { position: this.at(x, z, HALF * 1.6), scale: 0.35, tint: "ember.hot" });
  }

  implode(x: number, z: number): void {
    const at = new THREE.Vector3(wx(x), HALF, wz(z));
    for (let i = 0; i < 30; i++) this.spawnShard(at, PALETTE.forbiddenCore, -6, 0, 0.2);
    this.look.play("fx.shockwave.ring", { position: this.at(x, z, 0.1), scale: 0.45, tint: "soul" });
  }

  /** Blast charge glow on the Glyph (4 f), released into the shockwave. */
  blastCharge(x: number, z: number): void {
    const key = `${x},${z}`;
    this.charges.get(key)?.stop();
    this.charges.set(key, this.look.play("fx.charge.up", { position: this.at(x, z, 0.4), scale: 0.6, tint: "advantage" }));
  }

  /** Blast shockwave across the 3×3 (or 5×3). Reduce Flashes drops the light ring; tiles still ripple. */
  blast(x: number, z: number, w: number): void {
    const key = `${x},${z}`;
    this.charges.get(key)?.release();
    this.charges.delete(key);
    this.look.play("fx.shockwave.ring", { position: this.at(x, z, 0.1), scale: (w * TILE) / 10, tint: "ember" });
    if (!this.reduceFlashes) this.look.play("fx.shockwave.ring", { position: this.at(x, z, 0.15), scale: (w * TILE) / 6, tint: "ember.hot" });
  }

  chain(x: number, z: number, n: number): void {
    if (this.reduceFlashes) return;
    this.look.play("fx.shockwave.ring", { position: this.at(x, z, 0.08), scale: 0.3 + n * 0.12, tint: "ember" });
  }

  dust(x: number, z: number): void {
    this.look.play("fx.smoke.puff", { position: this.at(x, z, -0.3), scale: 0.6, tint: "shadow" });
  }

  /** Purify: radial light wave restoring the palette. */
  lightWave(x: number, z: number): void {
    if (this.reduceFlashes) return;
    this.look.play("fx.shockwave.ring", { position: this.at(x, z, 0.12), scale: 4, tint: "ember.hot" });
  }

  /** Beacon light streams into the figure's core. */
  stream(x: number, z: number): void {
    const n = 40;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTexture(), size: 0.35, color: PALETTE.beacon, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group.add(pts);
    this.streams.push({ pts, from: new THREE.Vector3(wx(x), 1.6, wz(z)), life: 0 });
  }

  /** `dt` is presentation time (≈0 during hitstop). */
  update(dt: number, core: THREE.Vector3): void {
    for (const f of this.flashes) {
      if (f.left <= 0) continue;
      f.left -= dt * 60;
      const m = f.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, f.left / f.max) * (this.reduceFlashes ? 0.35 : 0.9);
      if (f.left <= 0) f.mesh.visible = false;
    }
    let n = 0;
    for (const s of this.shards) {
      if (!s.alive) continue;
      s.life += dt;
      if (s.life > s.max) {
        s.alive = false;
        continue;
      }
      if (s.life < s.implode) s.p.addScaledVector(s.v, -dt * 0.6);
      else {
        s.v.y -= 14 * dt;
        s.p.addScaledVector(s.v, dt);
        s.v.multiplyScalar(1 - dt * 1.2);
      }
      s.r.x += s.w.x * dt;
      s.r.y += s.w.y * dt;
      const k = 1 - s.life / s.max;
      this.dummy.position.copy(s.p);
      this.dummy.rotation.copy(s.r);
      this.dummy.scale.setScalar(s.s * (0.3 + 0.7 * k));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n, this.dummy.matrix);
      this.mesh.setColorAt(n, s.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (const s of this.streams) {
      s.life += dt;
      const attr = s.pts.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        const u = Math.max(0, Math.min(1, s.life * 1.6 - (i / attr.count) * 0.6));
        const e = u * u;
        attr.setXYZ(i, s.from.x + (core.x - s.from.x) * e, s.from.y + (core.y - s.from.y) * e + Math.sin(u * Math.PI) * 1.2, s.from.z + (core.z - s.from.z) * e);
      }
      attr.needsUpdate = true;
      (s.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - s.life / 1.1);
    }
    const done = this.streams.filter((s) => s.life > 1.1);
    for (const s of done) {
      this.group.remove(s.pts);
      s.pts.geometry.dispose();
      (s.pts.material as THREE.Material).dispose();
    }
    this.streams = this.streams.filter((s) => s.life <= 1.1);
  }
}
