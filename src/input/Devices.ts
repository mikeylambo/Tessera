import type { Cell, Dir, FrameInput } from "../sim/types";
import { NO_INPUT } from "../sim/types";

export type InputFamily = "keyboard" | "gamepad" | "touch";

export interface AimContext {
  /** Screen NDC → cell. */
  pick(ndcX: number, ndcY: number): Cell | null;
  player(): Cell & { facing: Dir };
  reach(): number;
}

const KEY_DIR: Record<string, Dir> = {
  KeyW: 1, ArrowUp: 1, KeyD: 2, ArrowRight: 2, KeyS: 3, ArrowDown: 3, KeyA: 4, ArrowLeft: 4
};

/**
 * Device layer (GDD §8). Keyboard/mouse, gamepad and touch all collapse into FrameInput — the sim never knows the device.
 * Presses are queued so nothing is lost between rAF and the fixed 60 Hz step.
 */
export class Devices {
  family: InputFamily = "keyboard";
  private held: Dir[] = [];
  private presses: Dir[] = [];
  private marks: Cell[] = [];
  private detonate = false;
  private blast = false;
  private pick = -1;
  /** Aimed cell from mouse/stick/tap; null → default (directly ahead). */
  private aim: Cell | null = null;
  private aimAt = 0;
  private padPrev: boolean[] = [];
  private padDir: Dir = 0;
  private padRepeat = 0;
  /** Gamepad action buttons (standard mapping indices), remappable in Settings → Controls (DECISIONS #74). */
  padBindings = { mark: 0, detonate: 2, blast: 3 };
  /** Right-stick cursor: an offset from the figure, nudged one cell per flick (DECISIONS #73). */
  private padAim: { dx: number; dz: number } | null = null;
  private stickDir = "";
  private stickHeld = 0;
  private touchStart: { x: number; y: number; t: number; id: number } | null = null;
  private swipeHeld: Dir = 0;
  private touchCount = 0;
  enabled = true;
  onPause: () => void = () => {};
  onAny: (family: InputFamily) => void = () => {};
  /** Remappable keyboard bindings (GDD §8 remapping). */
  bindings = { mark: ["KeyJ"], detonate: ["KeyK"], blast: ["KeyL", "Space"], pause: ["Escape", "KeyP"] };

  constructor(private readonly el: HTMLElement, private readonly ctx: AimContext) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", () => (this.held = []));
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("touchstart", this.onTouchStart, { passive: false });
    el.addEventListener("touchmove", this.onTouchMove, { passive: false });
    el.addEventListener("touchend", this.onTouchEnd, { passive: false });
  }

  private setFamily(f: InputFamily): void {
    if (this.family !== f) this.family = f;
    this.onAny(f);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.setFamily("keyboard");
    if (this.bindings.pause.includes(e.code)) {
      this.onPause();
      return;
    }
    if (!this.enabled) return;
    const d = KEY_DIR[e.code];
    if (d) {
      e.preventDefault();
      if (!e.repeat) {
        this.presses.push(d);
        this.held = [...this.held.filter((h) => h !== d), d];
      }
      return;
    }
    if (e.repeat) return;
    if (this.bindings.mark.includes(e.code)) this.marks.push(this.cursor());
    else if (this.bindings.detonate.includes(e.code)) this.detonate = true;
    else if (this.bindings.blast.includes(e.code)) {
      e.preventDefault();
      this.blast = true;
    } else if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") this.pick = Number(e.code.slice(5)) - 1;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const d = KEY_DIR[e.code];
    if (d) this.held = this.held.filter((h) => h !== d);
  };

  private ndc(clientX: number, clientY: number): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1];
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === "touch") return;
    const [x, y] = this.ndc(e.clientX, e.clientY);
    this.aim = this.ctx.pick(x, y);
    this.aimAt = performance.now();
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === "touch" || !this.enabled) return;
    this.setFamily("keyboard");
    const [x, y] = this.ndc(e.clientX, e.clientY);
    const c = this.ctx.pick(x, y);
    if (e.button === 0 && c) {
      this.aim = c;
      this.aimAt = performance.now();
      this.marks.push(c);
    } else if (e.button === 2) this.detonate = true;
  };

  // ── touch: swipe anywhere to step (hold-swipe repeats); tap a cell to mark; two-finger tap pauses
  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.setFamily("touch");
    this.touchCount = Math.max(this.touchCount, e.touches.length);
    const t = e.changedTouches[0];
    if (!t || e.touches.length > 1) return;
    this.touchStart = { x: t.clientX, y: t.clientY, t: e.timeStamp, id: t.identifier };
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    const s = this.touchStart;
    if (!s || !this.enabled) return;
    const t = [...e.changedTouches].find((c) => c.identifier === s.id);
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.hypot(dx, dy) < 28) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : dy > 0 ? 3 : 1;
    if (d !== this.swipeHeld) {
      this.presses.push(d);
      this.swipeHeld = d;
    }
    // re-anchor so a continued swipe can change direction
    this.touchStart = { ...s, x: t.clientX, y: t.clientY };
  };

  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    const s = this.touchStart;
    const t = [...e.changedTouches].find((c) => c.identifier === s?.id);
    if (e.touches.length === 0) {
      if (this.touchCount >= 2) this.onPause();
      this.touchCount = 0;
    }
    if (s && t && !this.swipeHeld && this.enabled) {
      const dist = Math.hypot(t.clientX - s.x, t.clientY - s.y);
      if (dist < 20) {
        // a touch that did not travel is a tap, however long it was held (nothing uses still long-press)
        const [x, y] = this.ndc(t.clientX, t.clientY);
        const c = this.ctx.pick(x, y);
        if (c) {
          this.aim = c;
          this.aimAt = performance.now();
          this.marks.push(c);
        }
      }
    }
    this.swipeHeld = 0;
    this.touchStart = null;
  };

  /** Touch buttons call these. */
  pressDetonate(): void {
    this.setFamily("touch");
    this.detonate = true;
  }
  pressBlast(): void {
    this.setFamily("touch");
    this.blast = true;
  }
  pressPick(i: number): void {
    this.pick = i;
  }

  /**
   * Right stick as a cell cursor, not an analog pointer: past a firm deadzone (0.55, released below 0.35) the stick
   * picks one of 8 directions; the first frame steps one cell, holding repeats after 14 f then every 7 f. The
   * cursor is kept as an offset from the figure (it walks with you), clamped to Reach and the 7 columns.
   */
  private stepStick(rx: number, ry: number): void {
    const mag = Math.hypot(rx, ry);
    if (mag < (this.stickDir ? 0.35 : 0.55)) {
      this.stickDir = "";
      this.stickHeld = 0;
      return;
    }
    const a = Math.atan2(-ry, rx);
    const oct = (Math.round(a / (Math.PI / 4)) + 8) % 8;
    const dx = [1, 1, 0, -1, -1, -1, 0, 1][oct]!;
    const dz = [0, 1, 1, 1, 0, -1, -1, -1][oct]!;
    const key = `${dx},${dz}`;
    if (key !== this.stickDir) {
      this.stickDir = key;
      this.stickHeld = 0;
    } else this.stickHeld++;
    const fire = this.stickHeld === 0 || (this.stickHeld >= 14 && (this.stickHeld - 14) % 7 === 0);
    if (!fire) return;
    const r = this.ctx.reach();
    const p = this.ctx.player();
    const cur = this.padAim ?? { dx: 0, dz: 1 };
    const nx = Math.max(-r, Math.min(r, cur.dx + dx));
    const ndz = Math.max(-r, Math.min(r, cur.dz + dz));
    // keep the cell on the board's 7 columns
    this.padAim = { dx: Math.max(-p.x, Math.min(6 - p.x, nx)), dz: ndz };
    this.aim = null;
  }

  /** The aimed cell: mouse/stick/tap if recent, else the tile directly ahead (GDD §7). */
  cursor(): Cell {
    const p = this.ctx.player();
    if (this.family === "gamepad") {
      const o = this.padAim ?? { dx: 0, dz: 1 };
      return { x: Math.max(0, Math.min(6, p.x + o.dx)), z: p.z + o.dz };
    }
    const fresh = this.aim && (this.family === "keyboard" ? performance.now() - this.aimAt < 4000 : this.family !== "touch" || performance.now() - this.aimAt < 1500);
    if (fresh && this.aim) return this.aim;
    return { x: p.x, z: p.z + 1 };
  }

  /** Cursor shown on screen (hidden on touch when not recently tapped). */
  visibleCursor(): Cell | null {
    if (this.family === "touch" && (!this.aim || performance.now() - this.aimAt > 1500)) return null;
    return this.cursor();
  }

  private pollPad(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return;
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const edge = (i: number) => b(i) && !this.padPrev[i];
    const lx = pad.axes[0] ?? 0;
    const ly = pad.axes[1] ?? 0;
    let d: Dir = 0;
    if (b(12)) d = 1;
    else if (b(13)) d = 3;
    else if (b(14)) d = 4;
    else if (b(15)) d = 2;
    else if (Math.hypot(lx, ly) > 0.25) d = Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? 2 : 4) : ly > 0 ? 3 : 1;
    const any = d !== 0 || pad.buttons.some((x) => x.pressed) || Math.hypot(pad.axes[2] ?? 0, pad.axes[3] ?? 0) > 0.55;
    if (any) this.setFamily("gamepad");
    if (this.enabled) {
      if (d && d !== this.padDir) this.presses.push(d);
      this.padDir = d;
      this.stepStick(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      if (edge(11)) this.padAim = { dx: 0, dz: 1 }; // R3: recentre on the tile ahead
      if (edge(this.padBindings.mark)) this.marks.push(this.cursor());
      if (edge(this.padBindings.detonate)) this.detonate = true;
      if (edge(this.padBindings.blast)) this.blast = true;
    }
    if (edge(9)) this.onPause();
    this.padPrev = pad.buttons.map((x) => x.pressed);
    this.padRepeat = d ? this.padRepeat + 1 : 0;
  }

  /** Build one sim frame of input (consumes queued presses: one step press per frame). */
  frame(): FrameInput {
    this.pollPad();
    if (!this.enabled) {
      this.presses = [];
      this.marks = [];
      this.detonate = this.blast = false;
      const pick = this.pick;
      this.pick = -1;
      return { ...NO_INPUT, pick };
    }
    const held: Dir = this.held.length ? this.held[this.held.length - 1]! : this.padDir || this.swipeHeld;
    const out: FrameInput = {
      held,
      press: this.presses.shift() ?? 0,
      mark: this.marks.shift() ?? null,
      detonate: this.marks.length === 0 && this.detonate,
      blast: this.blast,
      pick: this.pick
    };
    if (out.detonate) this.detonate = false;
    this.blast = false;
    this.pick = -1;
    return out;
  }

  clear(): void {
    this.padAim = null;
    this.presses = [];
    this.marks = [];
    this.detonate = this.blast = false;
    this.pick = -1;
  }
}
