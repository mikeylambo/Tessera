import * as THREE from "three";
import type { World } from "../../sim/World";
import type { SimEvent } from "../../sim/Events";
import type { Cell } from "../../sim/types";
import { TUNING } from "../../data/tuning";
import { TesseraScene, HALF, wx, wz } from "./Scene";
import { TilesView } from "./Tiles";
import { CubesView } from "./Cubes";
import { FigureView } from "./Figure";
import { LatticeView, OverlayView } from "./Lattice";
import { VfxView } from "./Vfx";
import { TesseraFeel } from "./Feel";
import { FEEL } from "./FeelTuning";
import { GhostView } from "./Ghost";
import { PALETTE } from "../../data/palette";

export interface ViewSettings {
  reducedMotion: boolean;
  reduceFlashes: boolean;
  shake: number;
  ghosts: boolean;
  vibration: boolean;
}

/** Presentation root: reads World, drains its events, never writes sim state. */
export class WorldView {
  readonly scene: TesseraScene;
  readonly tiles = new TilesView();
  readonly cubes = new CubesView();
  readonly figure = new FigureView();
  readonly lattice = new LatticeView();
  readonly overlay = new OverlayView();
  readonly vfx: VfxView;
  readonly ghost = new GhostView();
  /** Exit objective: a beacon line across the exit row, glowing the whole stage (DECISIONS #84). */
  private exitLine: THREE.Mesh;
  private failDim = 0;
  /** Daily ghost world (another validated run of the same seed), stepped by Game in lockstep. */
  ghostWorld: World | null = null;
  readonly feel: TesseraFeel;
  private world: World | null = null;
  private t = 0;
  private invert = 0;
  private invertTarget = 0;
  private warnRow: number | null = null;
  private warnLeft = 0;
  cursor: Cell | null = null;
  private settings: ViewSettings = { reducedMotion: false, reduceFlashes: false, shake: 1, ghosts: true, vibration: false };

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.scene = new TesseraScene({ canvas, mobile });
    this.vfx = new VfxView(this.scene.look);
    this.feel = new TesseraFeel(this.scene.look);
    const eg = new THREE.PlaneGeometry(TUNING.grid.columns * 2.0 + 0.6, 0.5).rotateX(-Math.PI / 2);
    this.exitLine = new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.beacon).multiplyScalar(2.2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.exitLine.visible = false;
    this.scene.world.add(this.exitLine);
    this.scene.world.add(this.lattice.mesh, this.tiles.group, this.cubes.group, this.figure.root, this.overlay.group, this.vfx.group, this.ghost.group);
  }

  configure(s: Partial<ViewSettings>): void {
    this.settings = { ...this.settings, ...s };
    const r = this.settings;
    this.feel.configure({ screenShake: r.shake, flashes: r.reduceFlashes ? 0 : 1, vibration: r.vibration, reducedMotion: r.reducedMotion });
    this.tiles.reducedMotion = r.reducedMotion;
    this.figure.reducedMotion = r.reducedMotion;
    this.vfx.reduceFlashes = r.reduceFlashes;
    this.overlay.ghostsEnabled = r.ghosts;
  }

  attach(world: World): void {
    this.world = world;
    for (const j of this.jobs) j.run(); // flush staggered shatters from the previous world
    this.jobs = [];
    this.feel.lastStandPush = 0;
    this.figure.guttering = false;
    this.failDim = 0;
    const o = world.config.mode === "hundred" ? world.config.stage?.objective : undefined;
    this.exitLine.visible = o?.type === "exit";
    if (o?.type === "exit") this.exitLine.position.set(0, 0.06, wz(o.z) + 1.0); // the near edge of the exit row
    this.lattice.minRow = -1e6;
    this.overlay.reset();
    this.invert = this.invertTarget = 0;
    this.feel.hold = false;
    this.feel.extraUp = 0;
    this.feel.snap();
  }

  get attached(): World | null {
    return this.world;
  }

  private top = (x: number, z: number): number => (this.world ? this.tiles.topAt(x, z, this.world) : 0);

  private pos(x: number, z: number, y = HALF): { x: number; y: number; z: number } {
    return { x: wx(x), y: this.top(x, z) + y, z: wz(z) };
  }

  /** Presentation-only delayed jobs (staggered chain shatters). Counted in real frames; never touches the sim. */
  private jobs: Array<{ at: number; run: () => void }> = [];
  private clock = 0;
  private later(frames: number, run: () => void): void {
    if (frames <= 0) run();
    else this.jobs.push({ at: this.clock + frames, run });
  }
  /** Transient post state (frames left / amounts). */
  private caLeft = 0;
  private caAmt = 0;
  private warm = 0;
  private dimLeft = 0;

  /** Chromatic pulse for `frames` (Blast, chain ≥ 4). Never constant; Reduced Motion / Flashes cut it. */
  private aberrate(frames: number, amount: number): void {
    if (this.settings.reducedMotion || this.settings.reduceFlashes) return;
    this.caLeft = Math.max(this.caLeft, frames);
    this.caAmt = Math.max(this.caAmt, amount);
  }

  /** Hit-stop for a resolving chain of `n`: base + 1 per extra kill, capped (presentation only). */
  static hitstopFor(n: number): number {
    return Math.min(FEEL.hitCap, FEEL.hitBase + Math.max(0, n - 1) * FEEL.hitPerChain);
  }

  /** Route sim events to presentation via the Impact Scale (GDD §10) and the detonation-feel spec. */
  handle(events: readonly SimEvent[]): void {
    const w = this.world;
    if (!w) return;
    let chainN = 0;
    let heavy = false;
    let blastAt: { x: number; z: number } | null = null;
    let riseOrder = 0;
    for (const e of events) {
      if (e.t === "Kill") chainN = Math.max(chainN, e.chain);
      if (e.t === "Blast") blastAt = { x: e.x, z: e.z };
    }
    const stagger = FEEL.chainStaggerFrames;
    for (const e of events) {
      // chained tiles rise in sequence (chain order) so a chain of 9 reads as a wave; Blast keeps its radial ring
      const extra = e.t === "TileRise" && !blastAt && chainN > 1 ? riseOrder++ * stagger : e.t === "TileRise" && blastAt ? e.delay * 0.5 : 0;
      this.tiles.onEvent(e, w.frame, this.settings.reducedMotion ? 0 : extra);
      this.overlay.onEvent(e);
      switch (e.t) {
        case "Kill": {
          const isHeavy = e.chain >= 3 || e.type === "iron";
          heavy ||= isHeavy;
          const delay = this.settings.reducedMotion ? 0 : e.blast && blastAt ? FEEL.blastInhaleFrames + Math.max(Math.abs(e.x - blastAt.x), Math.abs(e.z - blastAt.z)) * stagger : e.index * stagger;
          const shards = Math.min(FEEL.shardsMax, FEEL.shardsMin + e.index);
          const { x, z, type, id } = e;
          const y = this.top(x, z);
          if (delay > 0) this.cubes.hold(id);
          this.later(delay, () => {
            this.cubes.kill(id);
            this.vfx.kill(x, z, y, type, isHeavy, shards);
            this.vfx.cellFlash(x, z, y, FEEL.cellFlashFrames);
          });
          if (type === "forbidden") {
            this.vfx.implode(x, z);
            this.feel.impact("tessera.forbidden", this.pos(x, z));
          }
          break;
        }
        case "IronHit":
          this.vfx.ironSpark(e.x, e.z);
          break;
        case "Chain":
          this.vfx.chain(e.x, e.z, e.n);
          if (e.n >= FEEL.rippleChainMin) this.tiles.ripple(e.x, e.z, Math.min(2, 0.6 + e.n * 0.12));
          if (e.n >= FEEL.caChainMin) this.aberrate(FEEL.caFrames, FEEL.caAmount * (e.n >= FEEL.gradeChainMin ? 1 : 0.6));
          if (e.n >= FEEL.gradeChainMin && !this.settings.reduceFlashes) this.warm = FEEL.gradeLift;
          break;
        case "BlastCharge":
          this.figure.flareToward(e.x, e.z);
          this.vfx.blastCharge(e.x, e.z);
          break;
        case "Blast": {
          // inhale (dim) → shockwave → staggered chain → rising wave → kick → bass drop (audio)
          if (!this.settings.reducedMotion) this.dimLeft = FEEL.blastInhaleFrames;
          const { x, z, w: bw } = e;
          this.later(this.settings.reducedMotion ? 0 : FEEL.blastInhaleFrames, () => {
            this.vfx.blast(x, z, bw);
            this.feel.impact("tessera.climax", this.pos(x, z, 0.2));
            this.aberrate(FEEL.aberrationBlastFrames, FEEL.caAmount);
            if (!this.settings.reducedMotion) this.feel.push = Math.min(FEEL.kickCap, FEEL.kickBase + chainN * FEEL.kickPerKill);
          });
          break;
        }
        case "MarkPlaced":
          this.figure.flareToward(e.x, e.z);
          break;
        case "Detonate":
          if (e.marks > 0) this.figure.detonateFlare();
          break;
        case "Miss":
          this.feel.shakePx(this.settings.reducedMotion ? 0 : FEEL.missShakePx);
          break;
        case "Step":
          this.tiles.ember(e.from.x, e.from.z);
          break;
        case "Crush":
          this.feel.impact("tessera.crush", this.pos(e.x, e.z));
          break;
        case "Escape":
          this.cubes.escape(e.id);
          break;
        case "CrumbleWarn":
          this.warnRow = e.z;
          this.warnLeft = e.frames;
          break;
        case "TileFall":
          if (e.delay === 0) this.vfx.dust(e.x, e.z);
          break;
        case "Crumble":
          if (this.warnRow === e.z) this.warnRow = null;
          break;
        case "BeaconCollected":
          this.vfx.stream(e.x, e.z);
          this.feel.impact("tessera.kill", this.pos(e.x, e.z, 1.6));
          break;
        case "LastStand":
          this.invertTarget = e.on ? 1 : 0;
          this.feel.extraUp = e.on ? 2 : 0;
          this.feel.lastStandPush = e.on ? FEEL.lastStandPush : 0;
          this.figure.guttering = e.on;
          break;
        case "Purify":
          this.vfx.lightWave(w.player.x, w.player.z);
          this.feel.impact("tessera.purify", this.pos(w.player.x, w.player.z, 1));
          this.feel.lastStandPush = 0;
          this.figure.reignite();
          break;
        case "Fall":
          this.feel.hold = true;
          break;
        case "Announce":
          if (e.line === "noPath") this.failDim = 1; // kind failure: the world dims, nothing punishes
          break;
        case "Turn":
          this.lattice.minRow = e.edgeZ;
          this.cubes.departingFall();
          this.feel.impact("tessera.turn", this.pos(w.player.x, w.player.z, 0));
          break;
        case "ChamberStart":
          this.feel.extraUp = 12; // GDD §15: Chamber rises toward a near top-down view (~57° pitch)
          break;
        case "ChamberEnd":
          this.feel.extraUp = 0;
          break;
        default:
          break;
      }
    }
    if (chainN > 0) {
      const head = events.find((e) => e.t === "Kill");
      const at = head && head.t === "Kill" ? this.pos(head.x, head.z) : undefined;
      if (!blastAt) this.feel.impact(heavy ? "tessera.heavy" : "tessera.kill", at);
      // presentation-only hit-stop: 3 f + 1 per extra chain kill, capped at 6 f (DECISIONS #46, #77)
      this.feel.hitstopFrames(WorldView.hitstopFor(chainN));
    }
  }

  /** `alpha` interpolates sim state; `realDt` is wall time. The sim never sees the Feel Kit's time scale. */
  frame(alpha: number, realDt: number): void {
    const w = this.world;
    if (!w) return;
    const step = this.feel.step(realDt);
    const pdt = step.presentationDt;
    this.t += realDt;
    const dtFrames = realDt * 60;
    this.clock += dtFrames;
    if (this.jobs.length) {
      const due = this.jobs.filter((j) => j.at <= this.clock);
      this.jobs = this.jobs.filter((j) => j.at > this.clock);
      for (const j of due) j.run();
    }
    this.caLeft = Math.max(0, this.caLeft - dtFrames);
    if (this.caLeft <= 0) this.caAmt = 0;
    this.warm *= Math.exp(-realDt * 5);
    this.dimLeft = Math.max(0, this.dimLeft - dtFrames);
    if (this.exitLine.visible) (this.exitLine.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(this.t * 2.4);
    if (this.warnLeft > 0) {
      this.warnLeft -= dtFrames;
      if (this.warnLeft <= 0) this.warnRow = null;
    }
    this.tiles.update(w, dtFrames, this.warnRow);
    this.cubes.update(w, alpha, realDt, this.cursor, this.top);
    this.figure.update(w, alpha, realDt, this.top);
    this.overlay.update(w, realDt, this.cursor, this.top);
    this.ghost.update(this.ghostWorld);
    this.vfx.update(pdt, this.figure.corePos);
    const pz = this.figure.root.position.z;
    this.lattice.update(w, -pz / 2, this.t);
    const front = w.grid.frontZ() ?? w.player.z;
    const nearest = w.cubes.alive().reduce((m, c) => Math.min(m, c.z), Infinity);
    const fy = w.player.alive ? Math.max(0, this.figure.root.position.y) * 0.5 : 0;
    // Chamber: frame the frozen puzzle from above (GDD §15 "rises to 22 units, near top-down")
    const ch = w.chamber;
    const focus = ch ? { x: 0, y: 0, z: wz(ch.z0 + (ch.def.rows.length - 1) / 2) + TUNING.camera.ahead } : { x: this.figure.root.position.x, y: fy, z: pz };
    this.feel.updateCamera(this.scene.camera, focus, !ch && nearest - front > 10, realDt);
    this.scene.updateAtmosphere(pz, pdt);
    this.invert += (this.invertTarget - this.invert) * Math.min(1, realDt * 3);
    const lsCA = this.settings.reducedMotion ? 0 : this.invert * 0.003;
    this.scene.setPost({ invert: this.invert, aberration: lsCA + this.caAmt, warm: this.warm, dim: Math.max(this.dimLeft > 0 ? FEEL.blastInhaleDim : 0, this.failDim * 0.45) });
    this.scene.render(pdt);
  }

  /** Cell → CSS pixel position (dev/tests). */
  cellToScreen(x: number, z: number, w: number, h: number): { x: number; y: number } {
    const v = new THREE.Vector3(wx(x), 0, wz(z)).project(this.scene.camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  /** Screen → cell (for mouse/touch aim). */
  pick(ndcX: number, ndcY: number): Cell | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.scene.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
    const x = Math.round(hit.x / 2 + 3);
    const z = Math.round(-hit.z / 2);
    if (x < 0 || x > 6) return null;
    return { x, z };
  }
}
