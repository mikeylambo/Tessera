import * as THREE from "three";
import { FeelDirector, CameraRig, type ImpactBundle, type TimeStep } from "@slu/web-shell/feel";
import { applyCameraFrame } from "@slu/web-shell/feel/three";
import { tunables } from "@slu/web-shell/tuning";
import type { LookKit } from "@slu/web-shell/look/three";
import { TUNING } from "../../data/tuning";

/**
 * Tessera's Impact Scale (GDD §10) as shell impact bundles. Shake: trauma² × 0.4 units, so Heavy (0.71) ≈ 0.2 units
 * and Climax (1.0) = 0.4 units; decay 5/s gives ~8 f and ~12 f. Hitstop values are presentation-only (DECISIONS #32).
 */
export const TESSERA_BUNDLES: readonly ImpactBundle[] = [
  { id: "tessera.kill", hitstopMs: 50, vfx: [{ id: "fx.impact.burst", scale: 0.45 }], rumble: { strength: 0.2, ms: 60 } },
  { id: "tessera.heavy", hitstopMs: 67, trauma: 0.71, vfx: [{ id: "fx.shockwave.ring", scale: 0.35 }], post: [{ id: "bloom.flare", amount: 0.5 }], rumble: { strength: 0.5, ms: 120 } },
  { id: "tessera.forbidden", hitstopMs: 67, trauma: 0.71, post: [{ id: "chromatic.hit", amount: 0.5 }, { id: "vignette.squeeze", amount: 0.4 }], rumble: { strength: 0.6, ms: 150 } },
  { id: "tessera.crush", hitstopMs: 67, trauma: 0.71, post: [{ id: "vignette.squeeze", amount: 0.8 }], rumble: { strength: 0.7, ms: 180 } },
  { id: "tessera.climax", hitstopMs: 100, trauma: 1, post: [{ id: "bloom.flare", amount: 1 }], flash: { token: "ember.hot", amount: 0.15 }, rumble: { strength: 0.8, ms: 250 } }
];

/** Camera geometry from GDD §15: 12 back, 14 up, looking 6 ahead → arm 22.8 at pitch 0.661 rad. */
// arm length = hypot(back + ahead, up) = 22.8 lives in tuning/feel.camera.springArm.json (asserted by tests/canon.test.ts)
const PITCH = Math.atan2(TUNING.camera.up, TUNING.camera.back + TUNING.camera.ahead);

/**
 * Shell Game-Feel Kit wrapper: CameraRig (springArm), trauma shake, impact bundles, post pulses, flash, rumble.
 * `step(realDt)` returns presentation time only — the sim is never fed `simDt`, so hitstop can't stall the tick.
 */
export class TesseraFeel {
  readonly director: FeelDirector;
  readonly rig = new CameraRig(tunables);
  private last: THREE.Vector3 | null = null;
  private pull = 1;
  private up = 0;
  /** Extra height (Last Stand +2, loss replay high angle). */
  extraUp = 0;
  /** Title → play: the camera starts high above the slab and descends onto the figure (GDD §22.2). */
  private intro = 0;
  private introHold = false;
  /** Blast push-in (units), decays. */
  push = 0;
  portrait = false;
  /** Fall: hold position and watch. */
  hold = false;
  private reducedMotion = false;

  constructor(private readonly look: LookKit) {
    this.director = new FeelDirector(
      {
        vfx: (id, ctx) => look.play(id, { ...(ctx.position ? { position: ctx.position } : {}), scale: ctx.scale, tint: id === "fx.shockwave.ring" ? "ember" : undefined }),
        post: (id, amount) => look.pulse(id, amount),
        flash: (token, amount) => look.post.flashColor(token, amount)
      },
      { registry: tunables, bundles: TESSERA_BUNDLES }
    );
    this.rig.setMode("springArm", 0);
  }

  configure(a: { screenShake: number; flashes: number; vibration: boolean; reducedMotion: boolean }): void {
    this.director.accessibility = a;
    this.reducedMotion = a.reducedMotion;
    this.look.setAccessibility({ flashes: a.flashes, reducedMotion: a.reducedMotion, screenShake: a.screenShake });
  }

  impact(id: string, at?: { x: number; y: number; z: number }): void {
    this.director.impact(id, at ? { position: at } : {});
  }

  /** Presentation hitstop for kill events: 3 f + (kills − 1), cap 8 f (GDD §10). */
  hitstopFrames(frames: number): void {
    this.director.hitstop((frames / 60) * 1000);
  }

  /** Advance one real frame; returns the presentation step (sim time is never derived from this). */
  step(realDt: number): TimeStep {
    return this.director.step(realDt);
  }

  updateCamera(camera: THREE.PerspectiveCamera, focus: { x: number; y: number; z: number }, aheadFar: boolean, dt: number): void {
    const c = TUNING.camera;
    const ahead = aheadFar ? c.aheadFar : c.ahead;
    const target = { x: focus.x * c.xFollow, y: focus.y, z: focus.z - ahead };
    if (this.hold && this.last) Object.assign(target, { x: this.last.x, y: this.last.y, z: this.last.z });
    else this.last = new THREE.Vector3(target.x, target.y, target.z);
    const frame = this.rig.update(dt, { target, yaw: 0, pitch: PITCH });
    // Tessera framing on top of the rig: portrait pull-back 15%, Last Stand / replay rise, Blast push-in
    const k = 1 - Math.exp(-6 * dt);
    this.pull += ((this.portrait ? c.portraitPullback : 1) - this.pull) * k;
    this.up += (this.extraUp - this.up) * k;
    if (!this.introHold) this.intro *= Math.exp(-1.4 * dt);
    this.push *= Math.exp(-3.5 * dt);
    const off = new THREE.Vector3(frame.position.x - frame.target.x, frame.position.y - frame.target.y, frame.position.z - frame.target.z);
    const len = off.length();
    off.multiplyScalar((len * this.pull - (this.reducedMotion ? 0 : this.push)) / Math.max(1e-6, len));
    const framed = { ...frame, position: { x: frame.target.x + off.x, y: frame.target.y + off.y + this.up + this.intro, z: frame.target.z + off.z + this.intro * 0.35 } };
    applyCameraFrame(camera, framed, this.director.shake.offset);
  }

  /** Hold the camera high (title); `release()` lets it descend over ~3 s. Reduced Motion cuts instead. */
  holdIntro(height: number): void {
    this.intro = height;
    this.introHold = true;
  }
  releaseIntro(): void {
    this.introHold = false;
    if (this.reducedMotion) this.intro = 0;
  }

  snap(): void {
    this.rig.snap();
    this.last = null;
  }
}
