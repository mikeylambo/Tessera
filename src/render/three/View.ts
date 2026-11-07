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
    this.scene.world.add(this.lattice.mesh, this.tiles.group, this.cubes.group, this.figure.root, this.overlay.group, this.vfx.group);
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

  /** Route sim events to presentation via the Impact Scale (GDD §10). */
  handle(events: readonly SimEvent[]): void {
    const w = this.world;
    if (!w) return;
    let kills = 0;
    let heavy = false;
    for (const e of events) {
      this.tiles.onEvent(e, w.frame);
      this.overlay.onEvent(e);
      switch (e.t) {
        case "Kill": {
          kills++;
          const isHeavy = e.chain >= 3 || e.type === "iron";
          heavy ||= isHeavy;
          this.cubes.kill(e.id);
          this.vfx.kill(e.x, e.z, this.top(e.x, e.z), e.type, isHeavy);
          if (e.type === "forbidden") {
            this.vfx.implode(e.x, e.z);
            this.feel.impact("tessera.forbidden", this.pos(e.x, e.z));
          }
          break;
        }
        case "IronHit":
          this.vfx.ironSpark(e.x, e.z);
          break;
        case "Chain":
          this.vfx.chain(e.x, e.z, e.n);
          break;
        case "BlastCharge":
          this.figure.flareToward(e.x, e.z);
          this.vfx.blastCharge(e.x, e.z);
          break;
        case "Blast":
          this.vfx.blast(e.x, e.z, e.w);
          this.feel.impact("tessera.climax", this.pos(e.x, e.z, 0.2));
          if (!this.settings.reducedMotion) this.feel.push = 1.2;
          break;
        case "MarkPlaced":
          this.figure.flareToward(e.x, e.z);
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
          break;
        case "Purify":
          this.vfx.lightWave(w.player.x, w.player.z);
          this.feel.impact("tessera.climax", this.pos(w.player.x, w.player.z, 1));
          break;
        case "Fall":
          this.feel.hold = true;
          break;
        default:
          break;
      }
    }
    if (kills > 0) {
      const head = events.find((e) => e.t === "Kill");
      const at = head && head.t === "Kill" ? this.pos(head.x, head.z) : undefined;
      this.feel.impact(heavy ? "tessera.heavy" : "tessera.kill", at);
      // presentation-only hitstop: 3 f + (kills − 1), capped at 8 f (GDD §10)
      this.feel.hitstopFrames(Math.min(TUNING.hitstop.cap, TUNING.hitstop.base + (kills - 1) * TUNING.hitstop.perExtraKill));
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
    if (this.warnLeft > 0) {
      this.warnLeft -= dtFrames;
      if (this.warnLeft <= 0) this.warnRow = null;
    }
    this.tiles.update(w, dtFrames, this.warnRow);
    this.cubes.update(w, alpha, realDt, this.cursor, this.top);
    this.figure.update(w, alpha, realDt, this.top);
    this.overlay.update(w, realDt, this.cursor, this.top);
    this.vfx.update(pdt, this.figure.corePos);
    const pz = this.figure.root.position.z;
    this.lattice.update(w, -pz / 2, this.t);
    const front = w.grid.frontZ() ?? w.player.z;
    const nearest = w.cubes.alive().reduce((m, c) => Math.min(m, c.z), Infinity);
    const fy = w.player.alive ? Math.max(0, this.figure.root.position.y) * 0.5 : 0;
    this.feel.updateCamera(this.scene.camera, { x: this.figure.root.position.x, y: fy, z: pz }, nearest - front > 10, realDt);
    this.scene.updateAtmosphere(pz, pdt);
    this.invert += (this.invertTarget - this.invert) * Math.min(1, realDt * 3);
    this.scene.setInversion(this.invert, this.settings.reducedMotion ? 0 : this.invert * 0.003);
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
