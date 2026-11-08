import * as THREE from "three";
import type { World } from "../../sim/World";
import type { SimEvent } from "../../sim/Events";
import type { Cell } from "../../sim/types";
import { PALETTE } from "../../data/palette";
import { TUNING } from "../../data/tuning";
import { seamTexture, sigilTexture, dotTexture } from "./textures";
import { TILE, wx, wz } from "./Scene";

const ROWS = 64;
const COLS = TUNING.grid.columns;

/**
 * Void lattice (GDD §23 Void Readability, LOCKED): faint cool grid over the void (0.12, rising to 0.3 within Reach),
 * warm rim on cells within Reach. A tile-occupancy texture keeps grid lines off owned ground.
 */
export class LatticeView {
  readonly mesh: THREE.Mesh;
  private occ: THREE.DataTexture;
  private data = new Uint8Array(COLS * ROWS * 4);
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.occ = new THREE.DataTexture(this.data, COLS, ROWS, THREE.RGBAFormat);
    this.occ.magFilter = THREE.NearestFilter;
    this.occ.minFilter = THREE.NearestFilter;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOcc: { value: this.occ },
        uBase: { value: 0 },
        uPlayer: { value: new THREE.Vector2() },
        uReach: { value: 3 },
        uTime: { value: 0 },
        uLattice: { value: new THREE.Color(PALETTE.lattice) },
        uWarm: { value: new THREE.Color(PALETTE.mark) },
        uInvert: { value: 0 },
        fogColor: { value: new THREE.Color(PALETTE.fog) },
        fogDensity: { value: 0.022 }
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying float vFogDepth;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mv = viewMatrix * wp;
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uOcc; uniform float uBase; uniform vec2 uPlayer; uniform float uReach; uniform float uTime;
        uniform vec3 uLattice; uniform vec3 uWarm; uniform vec3 fogColor; uniform float fogDensity; uniform float uInvert;
        varying vec3 vWorld; varying float vFogDepth;
        void main() {
          float cx = vWorld.x / ${TILE.toFixed(1)} + ${((COLS - 1) / 2).toFixed(1)};
          float cz = -vWorld.z / ${TILE.toFixed(1)};
          vec2 cell = floor(vec2(cx, cz) + 0.5);
          if (cell.x < 0.0 || cell.x > ${(COLS - 1).toFixed(1)}) discard;
          vec2 f = abs(fract(vec2(cx, cz) + 0.5) - 0.5); // 0 at centre, 0.5 at edge
          float edge = max(f.x, f.y);
          float occ = texture2D(uOcc, vec2((cell.x + 0.5) / ${COLS.toFixed(1)}, (cell.y - uBase + 0.5) / ${ROWS.toFixed(1)})).r;
          vec2 d = abs(cell - uPlayer);
          float inReach = step(max(d.x, d.y), uReach);
          float line = smoothstep(0.455, 0.49, edge);
          float alpha = line * mix(0.12, 0.3, inReach) * (1.0 - occ);
          // warm rim inside the Reach boundary cells (soft) on void and ground
          float rim = inReach * smoothstep(0.36, 0.48, edge) * (0.22 + 0.06 * sin(uTime * 2.0));
          vec3 col = mix(uLattice, uWarm, clamp(rim * 3.0, 0.0, 1.0));
          alpha = max(alpha, rim * (occ > 0.5 ? 0.8 : 1.0));
          float fog = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          alpha *= 1.0 - fog;
          gl_FragColor = vec4(col, alpha);
        }`
    });
    const geo = new THREE.PlaneGeometry(COLS * TILE + 0.1, ROWS * TILE).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 2;
  }

  update(w: World, focusZ: number, t: number): void {
    const base = Math.floor(focusZ) - 20;
    this.data.fill(0);
    for (const tile of w.grid.list()) {
      const r = tile.z - base;
      if (r < 0 || r >= ROWS) continue;
      this.data[(r * COLS + tile.x) * 4] = 255;
    }
    this.occ.needsUpdate = true;
    const u = this.mat.uniforms;
    u.uBase!.value = base;
    u.uPlayer!.value.set(w.player.x, w.player.z);
    u.uReach!.value = w.reach;
    u.uTime!.value = t;
    // plane centred on the window; slightly above ground tops so the rim sits on tiles too
    this.mesh.position.set(0, 0.006, wz(base + ROWS / 2 - 0.5));
  }
}

interface MarkView {
  cell: Cell;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  age: number;
  fizzle: number;
}

/** Cursor, marks, ghost sigils, Beacons, exit row (GDD §21 HUD budget: diegetic only). */
export class OverlayView {
  readonly group = new THREE.Group();
  private cursor: THREE.Mesh;
  private marks: MarkView[] = [];
  private sigilGeo = new THREE.PlaneGeometry(TILE * 0.8, TILE * 0.8).rotateX(-Math.PI / 2);
  private ringGeo = new THREE.RingGeometry(0.6, 0.72, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2);
  private ghosts: THREE.Mesh[] = [];
  private beacons = new Map<number, THREE.Group>();
  private exit: THREE.Mesh | null = null;
  private fizzles: MarkView[] = [];
  private t = 0;
  private chamberGlyphs: THREE.Mesh[] = [];
  private chamberAreas: THREE.Mesh[] = [];
  ghostDone = new Set<string>();
  ghostsEnabled = true;

  constructor() {
    this.cursor = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.98, TILE * 0.98).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: seamTexture(), color: new THREE.Color(PALETTE.mark).multiplyScalar(2.4), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })
    );
    this.cursor.renderOrder = 4;
    this.group.add(this.cursor);
  }

  private sigilMaterial(color: number, intensity: number, opacity = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ map: sigilTexture(), color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  }

  onEvent(e: SimEvent): void {
    if (e.t === "Kill") this.ghostDone.add(`${e.x},${e.z}`);
    if (e.t === "Miss") {
      const mesh = new THREE.Mesh(this.sigilGeo, this.sigilMaterial(0x8a8070, 1, 0.6));
      const ring = new THREE.Mesh(this.ringGeo, this.sigilMaterial(0x8a8070, 0.5, 0.5));
      mesh.position.set(wx(e.x), 0.03, wz(e.z));
      ring.position.copy(mesh.position);
      this.group.add(mesh, ring);
      this.fizzles.push({ cell: { x: e.x, z: e.z }, mesh, ring, age: 0, fizzle: 1 });
    }
  }

  update(w: World, dt: number, cursor: Cell | null, tileTop: (x: number, z: number) => number): void {
    this.t += dt;
    // cursor
    this.cursor.visible = !!cursor && w.player.alive;
    if (cursor) {
      this.cursor.position.set(wx(cursor.x), tileTop(cursor.x, cursor.z) + 0.025, wz(cursor.z));
      const inReach = w.inReach(cursor);
      (this.cursor.material as THREE.MeshBasicMaterial).opacity = inReach ? 1 : 0.25;
    }
    // marks: reconcile with sim marks
    const list = w.marks.list();
    for (const m of this.marks) m.age += dt;
    const keep: MarkView[] = [];
    for (const m of this.marks) {
      if (list.some((c) => c.x === m.cell.x && c.z === m.cell.z)) keep.push(m);
      else this.group.remove(m.mesh, m.ring);
    }
    this.marks = keep;
    for (const c of list) {
      if (this.marks.some((m) => m.cell.x === c.x && m.cell.z === c.z)) continue;
      const mesh = new THREE.Mesh(this.sigilGeo, this.sigilMaterial(PALETTE.mark, 2.2));
      const ring = new THREE.Mesh(this.ringGeo, this.sigilMaterial(PALETTE.mark, 2.5));
      mesh.renderOrder = 5;
      ring.renderOrder = 5;
      this.group.add(mesh, ring);
      this.marks.push({ cell: { ...c }, mesh, ring, age: 0, fizzle: 0 });
    }
    for (const m of this.marks) {
      const y = tileTop(m.cell.x, m.cell.z) + 0.035;
      const cube = w.cubeAt(m.cell);
      const forbidden = cube?.type === "forbidden";
      const etch = Math.min(1, m.age / (4 / 60));
      m.mesh.position.set(wx(m.cell.x) + (forbidden ? Math.sin(this.t * 50) * 0.03 : 0), y, wz(m.cell.z));
      m.mesh.scale.setScalar(0.6 + 0.4 * etch);
      m.mesh.rotation.y = forbidden ? Math.sin(this.t * 31) * 0.05 : 0;
      const mat = m.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(forbidden ? PALETTE.forbiddenCore : PALETTE.mark).multiplyScalar(forbidden ? 2.6 : 1.9 + 0.5 * Math.sin(this.t * 5));
      // scan ring expands once on placement
      const r = Math.min(1, m.age / 0.35);
      m.ring.position.set(wx(m.cell.x), y + 0.002, wz(m.cell.z));
      m.ring.scale.setScalar(0.6 + r * 1.2);
      (m.ring.material as THREE.MeshBasicMaterial).opacity = 1 - r;
    }
    // miss fizzles
    for (const f of this.fizzles) {
      f.age += dt;
      const u = f.age / 0.35;
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.6 * (1 - u));
      f.mesh.scale.setScalar(1 + u * 0.3);
      f.ring.visible = false;
    }
    const doneF = this.fizzles.filter((f) => f.age > 0.35);
    for (const f of doneF) this.group.remove(f.mesh, f.ring);
    this.fizzles = this.fizzles.filter((f) => f.age <= 0.35);

    // ghost sigils (onboarding): pulse until the cell has seen a kill
    const stage = w.config.stage;
    const ghosts = this.ghostsEnabled && stage?.ghosts ? stage.ghosts.filter((g) => w.tick >= g.from && !this.ghostDone.has(`${g.x},${g.z}`)) : [];
    while (this.ghosts.length < ghosts.length) {
      const g = new THREE.Mesh(this.sigilGeo, this.sigilMaterial(PALETTE.mark, 1.2, 0.5));
      g.renderOrder = 3;
      this.group.add(g);
      this.ghosts.push(g);
    }
    this.ghosts.forEach((g, i) => {
      const gd = ghosts[i];
      g.visible = !!gd && !w.marks.has(gd);
      if (!gd) return;
      g.position.set(wx(gd.x), tileTop(gd.x, gd.z) + 0.03, wz(gd.z));
      const p = 0.5 + 0.5 * Math.sin(this.t * 4);
      (g.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.4 * p;
      g.scale.setScalar(0.9 + 0.12 * p);
    });

    // Chamber Glyph sigils (Blast centres on the void lattice) + armed 3×3 preview
    const ch = w.chamber;
    const n = ch ? ch.glyphs.length : 0;
    while (this.chamberGlyphs.length < n) {
      const g = new THREE.Mesh(this.sigilGeo, this.sigilMaterial(PALETTE.advantage, 2.2));
      const a = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 3, TILE * 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.advantage).multiplyScalar(0.6), transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      g.renderOrder = 6;
      this.group.add(g, a);
      this.chamberGlyphs.push(g);
      this.chamberAreas.push(a);
    }
    this.chamberGlyphs.forEach((g, i) => {
      const a = this.chamberAreas[i]!;
      const gl = ch?.glyphs[i];
      g.visible = !!gl;
      a.visible = !!gl && !!ch?.armed[i];
      if (!gl) return;
      g.position.set(wx(gl.x), 0.05, wz(gl.z));
      g.rotation.y = Math.PI / 4;
      const armed = !!ch!.armed[i];
      (g.material as THREE.MeshBasicMaterial).color.setHex(PALETTE.advantage).multiplyScalar(armed ? 3.2 : 1.1 + 0.4 * Math.sin(this.t * 3 + i));
      a.position.set(wx(gl.x), 0.04, wz(gl.z));
    });

    // beacons
    const live = w.beacons.live();
    for (const b of live) {
      let g = this.beacons.get(b.id);
      if (!g) {
        g = this.makeBeacon();
        this.beacons.set(b.id, g);
        this.group.add(g);
      }
      g.position.set(wx(b.x), 0, wz(b.z));
      const dim = b.ticksLeft <= TUNING.beacons.dimTicks ? (b.ticksLeft / TUNING.beacons.dimTicks) * (0.6 + 0.4 * Math.abs(Math.sin(this.t * 13))) : 1;
      g.userData.level = dim;
      g.children.forEach((c, i) => {
        if (i === 1) c.rotation.y += dt * 1.5;
        if (i === 1) c.position.y = 1.6 + Math.sin(this.t * 2) * 0.15;
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (m && "opacity" in m) m.opacity = (i === 0 ? 0.09 : i === 2 ? 0.55 : 1) * dim;
      });
    }
    for (const [id, g] of [...this.beacons]) {
      if (!live.some((b) => b.id === id)) {
        this.group.remove(g);
        this.beacons.delete(id);
      }
    }

    // exit row of light (Hundred exit objective)
    const obj = stage?.objective;
    if (obj?.type === "exit") {
      if (!this.exit) {
        const geo = new THREE.PlaneGeometry(COLS * TILE, 3.2);
        geo.translate(0, 1.6, 0);
        const mat = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(PALETTE.beacon) } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 2.2) * (0.55 + 0.15 * sin(uT * 2.0 + vUv.x * 12.0)); gl_FragColor = vec4(uC * 1.6, a); }`
        });
        this.exit = new THREE.Mesh(geo, mat);
        this.group.add(this.exit);
      }
      this.exit.position.set(0, 0, wz(obj.z) + TILE / 2);
      ((this.exit.material as THREE.ShaderMaterial).uniforms.uT!).value = this.t;
    } else if (this.exit) {
      this.group.remove(this.exit);
      this.exit = null;
    }
  }

  private makeBeacon(): THREE.Group {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.18, 6, 10, 1, true).translate(0, 3, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.beacon).multiplyScalar(0.7), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
    );
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.beacon).multiplyScalar(3), toneMapped: false, transparent: true }));
    gem.position.y = 1.6;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: PALETTE.beacon, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.y = 1.6;
    glow.scale.setScalar(3);
    g.add(shaft, gem, glow);
    return g;
  }

  reset(): void {
    for (const m of this.marks) this.group.remove(m.mesh, m.ring);
    this.marks = [];
    for (const g of this.ghosts) this.group.remove(g);
    this.ghosts = [];
    for (const g of this.beacons.values()) this.group.remove(g);
    this.beacons.clear();
    this.ghostDone.clear();
    if (this.exit) this.group.remove(this.exit);
    this.exit = null;
  }
}
