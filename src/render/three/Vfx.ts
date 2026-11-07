import * as THREE from "three";
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

interface Ring {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  from: number;
  to: number;
  opacity: number;
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

/** Effect families (GDD §25). Gameplay information always outranks spectacle. */
export class VfxView {
  readonly group = new THREE.Group();
  private shards: Shard[] = [];
  private mesh: THREE.InstancedMesh;
  private rings: Ring[] = [];
  private streams: Stream[] = [];
  private dummy = new THREE.Object3D();
  private ringGeo = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
  private squareGeo = new THREE.RingGeometry(0.92, 1, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
  /** Hitstop: presentation-only freeze of shards/rings (frames remaining). */
  hitstop = 0;
  reduceFlashes = false;

  constructor() {
    const geo = new THREE.TetrahedronGeometry(0.22, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.15 });
    this.mesh = new THREE.InstancedMesh(geo, mat, SHARD_MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
    for (let i = 0; i < SHARD_MAX; i++) {
      this.shards.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1, life: 0, max: 1, color: new THREE.Color(), implode: 0 });
    }
  }

  private spawnShard(at: THREE.Vector3, color: number, speed: number, implode: number, up = 1): void {
    const s = this.shards.find((x) => !x.alive);
    if (!s) return;
    s.alive = true;
    s.p.copy(at).add(new THREE.Vector3(cosmetic.range(-HALF, HALF), cosmetic.range(-HALF, HALF), cosmetic.range(-HALF, HALF)));
    const dir = s.p.clone().sub(at).normalize();
    s.v.copy(dir).multiplyScalar(speed * cosmetic.range(0.6, 1.3));
    s.v.y += up * cosmetic.range(2, 5);
    s.r.set(cosmetic.rand() * 6, cosmetic.rand() * 6, cosmetic.rand() * 6);
    s.w.set(cosmetic.range(-8, 8), cosmetic.range(-8, 8), cosmetic.range(-8, 8));
    s.s = cosmetic.range(0.6, 1.4);
    s.life = 0;
    s.max = cosmetic.range(0.7, 1.2);
    s.color.setHex(color);
    s.implode = implode;
  }

  /** Shards collapse inward then burst outward (24 per cube). */
  kill(x: number, z: number, y: number, type: CubeType, heavy: boolean): void {
    const at = new THREE.Vector3(wx(x), y + HALF, wz(z));
    const n = 24;
    for (let i = 0; i < n; i++) this.spawnShard(at, SHARD_COLOR[type], heavy ? 9 : 6, 0.1, 1);
    this.ring(x, z, y + 0.05, PALETTE.seam, 0.4, 1.6, 0.35, 0.9, true);
  }

  ironSpark(x: number, z: number): void {
    const at = new THREE.Vector3(wx(x), HALF * 1.6, wz(z));
    for (let i = 0; i < 10; i++) this.spawnShard(at, 0xffd9a0, 7, 0, 0.6);
  }

  implode(x: number, z: number): void {
    const at = new THREE.Vector3(wx(x), HALF, wz(z));
    for (let i = 0; i < 30; i++) this.spawnShard(at, PALETTE.forbiddenCore, -6, 0, 0.2);
    this.ring(x, z, 0.05, PALETTE.forbiddenCore, 2.2, 0.2, 0.5, 1, false);
  }

  /** Blast shockwave: square wave across the 3×3 + radial light ring. */
  blast(x: number, z: number, w: number): void {
    this.ring(x, z, 0.08, PALETTE.seam, 0.3, (w / 2) * TILE + 0.6, 0.5, 1, true);
    if (!this.reduceFlashes) this.ring(x, z, 0.1, 0xffffff, 0.2, w * TILE * 1.4, 0.7, 0.6, false);
  }

  chain(x: number, z: number, n: number): void {
    if (this.reduceFlashes) return;
    this.ring(x, z, 0.06, PALETTE.seam, 0.5, 3 + n * 1.2, 0.6, 0.7, false);
  }

  dust(x: number, z: number): void {
    const at = new THREE.Vector3(wx(x), -0.2, wz(z));
    for (let i = 0; i < 6; i++) this.spawnShard(at, 0x2a2724, 1.5, 0, -0.3);
  }

  lightWave(x: number, z: number): void {
    if (this.reduceFlashes) return;
    this.ring(x, z, 0.12, PALETTE.beacon, 0.5, 30, 1.4, 0.8, false);
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

  private ring(x: number, z: number, y: number, color: number, from: number, to: number, life: number, opacity: number, square: boolean): void {
    const mesh = new THREE.Mesh(square ? this.squareGeo : this.ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
    mesh.position.set(wx(x), y, wz(z));
    mesh.scale.setScalar(from);
    this.group.add(mesh);
    this.rings.push({ mesh, life: 0, max: life, from, to, opacity });
  }

  update(dt: number, core: THREE.Vector3): void {
    const frozen = this.hitstop > 0;
    if (frozen) this.hitstop = Math.max(0, this.hitstop - dt * 60);
    const step = frozen ? 0 : dt;
    let n = 0;
    for (const s of this.shards) {
      if (!s.alive) continue;
      s.life += step;
      if (s.life > s.max) {
        s.alive = false;
        continue;
      }
      // implode for the first fraction, then burst
      if (s.life < s.implode) s.p.addScaledVector(s.v, -step * 0.6);
      else {
        s.v.y -= 14 * step;
        s.p.addScaledVector(s.v, step);
        s.v.multiplyScalar(1 - step * 1.2);
      }
      s.r.x += s.w.x * step;
      s.r.y += s.w.y * step;
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

    for (const r of this.rings) {
      r.life += step;
      const u = Math.min(1, r.life / r.max);
      const e = 1 - Math.pow(1 - u, 3);
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * e);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = r.opacity * (1 - u);
    }
    const doneR = this.rings.filter((r) => r.life >= r.max);
    for (const r of doneR) {
      this.group.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.rings = this.rings.filter((r) => r.life < r.max);

    for (const s of this.streams) {
      s.life += step;
      const attr = s.pts.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        const u = Math.max(0, Math.min(1, s.life * 1.6 - i / attr.count * 0.6));
        const e = u * u;
        attr.setXYZ(i, s.from.x + (core.x - s.from.x) * e, s.from.y + (core.y - s.from.y) * e + Math.sin(u * Math.PI) * 1.2, s.from.z + (core.z - s.from.z) * e);
      }
      attr.needsUpdate = true;
      (s.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - s.life / 1.1);
    }
    const doneS = this.streams.filter((s) => s.life > 1.1);
    for (const s of doneS) {
      this.group.remove(s.pts);
      s.pts.geometry.dispose();
    }
    this.streams = this.streams.filter((s) => s.life <= 1.1);
  }
}
