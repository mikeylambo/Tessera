import * as THREE from "three";
import type { World } from "../../sim/World";
import type { SimEvent } from "../../sim/Events";
import type { Cell } from "../../sim/types";
import { TUNING } from "../../data/tuning";
import { TesseraScene, wx, wz } from "./Scene";
import { TilesView } from "./Tiles";
import { CubesView } from "./Cubes";
import { FigureView } from "./Figure";
import { LatticeView, OverlayView } from "./Lattice";
import { VfxView } from "./Vfx";
import { CameraRig } from "./Camera";

export interface ViewSettings {
  reducedMotion: boolean;
  reduceFlashes: boolean;
  shake: number;
  ghosts: boolean;
}

/** Presentation root: reads World, drains its events, never writes sim state. */
export class WorldView {
  readonly scene: TesseraScene;
  readonly tiles = new TilesView();
  readonly cubes = new CubesView();
  readonly figure = new FigureView();
  readonly lattice = new LatticeView();
  readonly overlay = new OverlayView();
  readonly vfx = new VfxView();
  readonly rig: CameraRig;
  private world: World | null = null;
  private t = 0;
  private invert = 0;
  private invertTarget = 0;
  private flash = 0;
  private warnRow: number | null = null;
  private warnLeft = 0;
  cursor: Cell | null = null;
  private settings: ViewSettings = { reducedMotion: false, reduceFlashes: false, shake: 1, ghosts: true };

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.scene = new TesseraScene({ canvas, mobile });
    const w = this.scene.world;
    w.add(this.lattice.mesh, this.tiles.group, this.cubes.group, this.figure.root, this.overlay.group, this.vfx.group);
    this.rig = new CameraRig(this.scene.camera);
  }

  configure(s: Partial<ViewSettings>): void {
    this.settings = { ...this.settings, ...s };
    this.rig.reducedMotion = this.settings.reducedMotion;
    this.rig.shakeScale = this.settings.shake;
    this.tiles.reducedMotion = this.settings.reducedMotion;
    this.figure.reducedMotion = this.settings.reducedMotion;
    this.vfx.reduceFlashes = this.settings.reduceFlashes;
    this.overlay.ghostsEnabled = this.settings.ghosts;
  }

  attach(world: World): void {
    this.world = world;
    this.overlay.reset();
    this.invert = this.invertTarget = 0;
    this.rig.hold = false;
    this.rig.snap();
  }

  get attached(): World | null {
    return this.world;
  }

  private top = (x: number, z: number): number => (this.world ? this.tiles.topAt(x, z, this.world) : 0);

  /** Route sim events to presentation (impact scale, GDD §10). */
  handle(events: readonly SimEvent[]): void {
    const w = this.world;
    if (!w) return;
    let killsThisFrame = 0;
    for (const e of events) {
      this.tiles.onEvent(e, w.frame);
      this.overlay.onEvent(e);
      switch (e.t) {
        case "Kill": {
          killsThisFrame++;
          const heavy = e.chain >= 3 || e.type === "iron";
          this.cubes.kill(e.id);
          this.vfx.kill(e.x, e.z, this.top(e.x, e.z), e.type, heavy);
          if (e.type === "forbidden") this.vfx.implode(e.x, e.z);
          break;
        }
        case "IronHit":
          this.vfx.ironSpark(e.x, e.z);
          break;
        case "Chain":
          this.vfx.chain(e.x, e.z, e.n);
          if (e.n >= 3) {
            this.rig.shake(0.2, 8);
            this.flash = Math.max(this.flash, this.settings.reduceFlashes ? 0 : 0.08);
          }
          break;
        case "Blast":
          this.vfx.blast(e.x, e.z, e.w);
          this.vfx.hitstop = TUNING.hitstop.climax;
          this.rig.shake(0.4, 12);
          if (!this.settings.reducedMotion) this.rig.push = 1.2;
          this.flash = Math.max(this.flash, this.settings.reduceFlashes ? 0 : 0.18);
          break;
        case "BlastCharge":
          this.figure.flareToward(e.x, e.z);
          break;
        case "MarkPlaced":
          this.figure.flareToward(e.x, e.z);
          break;
        case "ScarTorn":
          this.rig.shake(0.2, 8);
          break;
        case "Crush":
          this.rig.shake(0.2, 8);
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
          break;
        case "LastStand":
          this.invertTarget = e.on ? 1 : 0;
          break;
        case "Purify":
          this.vfx.lightWave(w.player.x, w.player.z);
          this.rig.shake(0.4, 12);
          break;
        case "Fall":
          this.rig.hold = true;
          break;
        default:
          break;
      }
    }
    if (killsThisFrame > 0) {
      const hs = Math.min(TUNING.hitstop.cap, TUNING.hitstop.base + (killsThisFrame - 1) * TUNING.hitstop.perExtraKill);
      this.vfx.hitstop = Math.max(this.vfx.hitstop, hs);
    }
  }

  frame(alpha: number, dt: number): void {
    const w = this.world;
    if (!w) return;
    this.t += dt;
    const dtFrames = dt * 60;
    if (this.warnLeft > 0) {
      this.warnLeft -= dtFrames;
      if (this.warnLeft <= 0) this.warnRow = null;
    }
    this.tiles.update(w, dtFrames, this.warnRow);
    this.cubes.update(w, alpha, dt, this.cursor, this.top);
    this.figure.update(w, alpha, dt, this.top);
    this.overlay.update(w, dt, this.cursor, this.top);
    this.vfx.update(dt, this.figure.corePos);
    const pz = this.figure.root.position.z;
    this.lattice.update(w, -pz / 2, this.t);
    // camera: look further ahead when the next formation is far
    const front = w.grid.frontZ() ?? w.player.z;
    const nearest = w.cubes.alive().reduce((m, c) => Math.min(m, c.z), Infinity);
    const far = nearest - front > 10;
    this.rig.extraUp = this.invert * 2;
    this.rig.push *= Math.pow(0.02, dt);
    const fx = this.figure.root.position.x;
    const fy = w.player.alive ? Math.max(0, this.figure.root.position.y) * 0.5 : 0;
    this.rig.update(fx, pz, fy, far, dt);
    this.scene.updateAtmosphere(pz, dt);
    // grade: Last Stand inversion, flash decay
    this.invert += (this.invertTarget - this.invert) * Math.min(1, dt * 3);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    const g = this.scene.grade.uniforms;
    g.uInvert!.value = this.invert;
    g.uAberration!.value = this.settings.reducedMotion ? 0 : this.invert * 0.003;
    g.uFlash!.value = this.flash;
    this.scene.render();
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
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const x = Math.round(hit.x / 2 + 3);
    const z = Math.round(-hit.z / 2);
    if (x < 0 || x > 6) return null;
    return { x, z };
  }
}
