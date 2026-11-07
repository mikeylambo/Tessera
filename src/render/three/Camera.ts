import * as THREE from "three";
import { TUNING } from "../../data/tuning";
import { cosmetic } from "../cosmetic";

/** Critically damped follow camera (GDD §15). */
export class CameraRig {
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private look = new THREE.Vector3();
  private lookVel = new THREE.Vector3();
  private shakeT = 0;
  private shakeAmp = 0;
  private shakeMax = 1;
  private initialised = false;
  extraUp = 0;
  push = 0;
  portrait = false;
  reducedMotion = false;
  shakeScale = 1;
  /** Fall: hold position and watch. */
  hold = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  shake(amp: number, frames: number): void {
    if (this.reducedMotion) return;
    const a = Math.min(0.4, amp) * this.shakeScale;
    if (a >= this.shakeAmp) {
      this.shakeAmp = a;
      this.shakeT = frames / 60;
      this.shakeMax = frames / 60;
    }
  }

  private damp(cur: THREE.Vector3, vel: THREE.Vector3, target: THREE.Vector3, smooth: number, dt: number): void {
    // critically damped spring (Game Programming Gems 4)
    const omega = 2 / smooth;
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = cur.clone().sub(target);
    const temp = vel.clone().addScaledVector(change, omega).multiplyScalar(dt);
    vel.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
    cur.copy(target).add(change.add(temp).multiplyScalar(exp));
  }

  update(focusX: number, focusZ: number, focusY: number, aheadFar: boolean, dt: number): void {
    const c = TUNING.camera;
    const pull = this.portrait ? c.portraitPullback : 1;
    const ahead = aheadFar ? c.aheadFar : c.ahead;
    const tx = focusX * c.xFollow;
    const target = new THREE.Vector3(tx, (c.up + this.extraUp) * pull + focusY, focusZ + c.back * pull - this.push);
    const lookT = new THREE.Vector3(tx, focusY, focusZ - ahead);
    if (!this.initialised) {
      this.pos.copy(target);
      this.look.copy(lookT);
      this.initialised = true;
    }
    if (!this.hold) {
      this.damp(this.pos, this.vel, target, c.damping, dt);
      this.damp(this.look, this.lookVel, lookT, c.damping, dt);
    }
    this.camera.position.copy(this.pos);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeMax);
      this.camera.position.x += cosmetic.range(-1, 1) * this.shakeAmp * k;
      this.camera.position.y += cosmetic.range(-1, 1) * this.shakeAmp * k;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.camera.lookAt(this.look);
  }

  snap(): void {
    this.initialised = false;
  }
}
