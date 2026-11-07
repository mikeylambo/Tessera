import { TUNING } from "../data/tuning";
import { DIR_DX, DIR_DZ, OPPOSITE, type Dir } from "./types";
import type { EventQueue } from "./Events";

export type PlayerState = "idle" | "stepping" | "shoved" | "stunned" | "falling";

export interface MoveContext {
  /** Cell has a tile and no cube in it. */
  canEnter(x: number, z: number): boolean;
}

/** Owner of player cell, stun, facing (GDD §30). */
export class Player {
  x = 3;
  z = 1;
  /** Previous cell (render interpolates from → x,z over the current step/slide). */
  fromX = 3;
  fromZ = 1;
  state: PlayerState = "idle";
  facing: Dir = 1;
  /** Frames into the current step / slide / fall. */
  t = 0;
  stun = 0;
  /** Buffered step press and its remaining buffer frames. */
  buffered: Dir = 0;
  bufferLeft = 0;
  heldFrames = 0;
  lastHeld: Dir = 0;
  /** Blocked-nudge animation frames remaining (presentation hint, no gameplay effect). */
  nudge = 0;
  maxZ = 1;

  reset(x: number, z: number): void {
    this.x = this.fromX = x;
    this.z = this.fromZ = z;
    this.state = "idle";
    this.facing = 1;
    this.t = 0;
    this.stun = 0;
    this.buffered = 0;
    this.bufferLeft = 0;
    this.heldFrames = 0;
    this.lastHeld = 0;
    this.nudge = 0;
    this.maxZ = z;
  }

  get canAct(): boolean {
    return this.state === "idle" || this.state === "stepping";
  }

  get alive(): boolean {
    return this.state !== "falling";
  }

  /** Advance step/shove/stun timers; consume buffered or held movement. */
  update(press: Dir, held: Dir, ctx: MoveContext, events: EventQueue): void {
    if (this.nudge > 0) this.nudge--;
    if (press) {
      this.buffered = press;
      this.bufferLeft = TUNING.input.bufferFrames;
    } else if (this.bufferLeft > 0) {
      this.bufferLeft--;
      if (this.bufferLeft === 0) this.buffered = 0;
    }

    // held auto-repeat
    if (held && held === this.lastHeld) this.heldFrames++;
    else this.heldFrames = 0;
    this.lastHeld = held;

    switch (this.state) {
      case "falling":
        this.t++;
        return;
      case "shoved":
        this.t++;
        if (this.t >= TUNING.movement.shoveSlideFrames) {
          this.state = "stunned";
          this.t = 0;
          this.stun = TUNING.crush.stunFrames;
        }
        return;
      case "stunned":
        this.stun--;
        if (this.stun <= 0) this.state = "idle";
        return;
      case "stepping": {
        this.t++;
        // reversal mid-step after frame 5 snaps back
        if (this.buffered && this.buffered === OPPOSITE[this.facing] && this.t > TUNING.movement.reverseAfterFrame && this.t < TUNING.movement.stepFrames) {
          const bx = this.fromX;
          const bz = this.fromZ;
          if (ctx.canEnter(bx, bz)) {
            this.fromX = this.x;
            this.fromZ = this.z;
            this.x = bx;
            this.z = bz;
            this.facing = this.buffered;
            this.t = TUNING.movement.stepFrames - this.t;
            this.buffered = 0;
            this.bufferLeft = 0;
            events.push({ t: "Step", from: { x: this.fromX, z: this.fromZ }, to: { x: this.x, z: this.z }, dir: this.facing });
          }
          return;
        }
        if (this.t >= TUNING.movement.stepFrames) {
          this.state = "idle";
          this.t = 0;
          this.fromX = this.x;
          this.fromZ = this.z;
        } else return;
        break;
      }
      default:
        break;
    }

    // idle: take buffered press, else auto-repeat held
    let dir: Dir = 0;
    if (this.buffered) dir = this.buffered;
    else if (held && this.heldFrames >= TUNING.movement.autoRepeatDelay) dir = held;
    if (!dir) return;
    this.buffered = 0;
    this.bufferLeft = 0;
    this.tryStep(dir, ctx, events);
  }

  private tryStep(dir: Dir, ctx: MoveContext, events: EventQueue): void {
    this.facing = dir;
    const nx = this.x + DIR_DX[dir];
    const nz = this.z + DIR_DZ[dir];
    if (!ctx.canEnter(nx, nz)) {
      this.nudge = TUNING.movement.blockedNudgeFrames;
      events.push({ t: "Blocked", dir });
      return;
    }
    this.fromX = this.x;
    this.fromZ = this.z;
    this.x = nx;
    this.z = nz;
    this.state = "stepping";
    this.t = 0;
    if (nz > this.maxZ) this.maxZ = nz;
    events.push({ t: "Step", from: { x: this.fromX, z: this.fromZ }, to: { x: nx, z: nz }, dir });
  }

  /** Crush: shove 1 tile back (−z). Caller decides whether the target has ground. */
  shove(): void {
    this.fromX = this.x;
    this.fromZ = this.z;
    this.z -= 1;
    this.state = "shoved";
    this.t = 0;
    this.buffered = 0;
    this.bufferLeft = 0;
  }

  /** Crumble rescue: pushed forward one tile. */
  pushForward(): void {
    this.fromX = this.x;
    this.fromZ = this.z;
    this.z += 1;
    this.state = "shoved";
    this.t = 0;
    if (this.z > this.maxZ) this.maxZ = this.z;
  }

  fall(): void {
    if (this.state === "falling") return;
    this.state = "falling";
    this.t = 0;
  }

  serialize(): string {
    return `${this.x},${this.z},${this.state},${this.t},${this.stun},${this.facing},${this.buffered},${this.bufferLeft},${this.heldFrames}`;
  }
}
