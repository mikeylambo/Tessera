import { TUNING } from "../data/tuning";
import type { Cell, CubeType } from "./types";

export interface Cube {
  id: number;
  alive: boolean;
  type: CubeType;
  /** Origin cell; z decrements by 1 when a roll lands (on the tick). */
  x: number;
  z: number;
  hp: number;
  /** Ticks since spawn/landing; a cube rolls only once age ≥ 1 (fade-in tick). */
  age: number;
  /** Tick index of the last Iron damage (max 1 per tick). */
  lastHitTick: number;
  /** Phase: id of the twin half, else −1. */
  twin: number;
  /** Skyfall: tick on which it lands; −1 once grounded / never airborne. */
  landTick: number;
  /** Ticks since landing (for skyfall-on-landing bonus); −1 = never fell. */
  sinceLand: number;
  /** Owning sector / wave id (for Sector-clear bookkeeping). */
  wave: number;
}

/** Owner of cubes: cell, roll phase, HP (GDD §30). Pool with alive flags; never splice while iterating. */
export class Cubes {
  private pool: Cube[] = [];
  private nextId = 1;

  clear(): void {
    this.pool = [];
    this.nextId = 1;
  }

  spawn(type: CubeType, x: number, z: number, wave: number, landTick = -1): Cube {
    let c = this.pool.find((p) => !p.alive);
    if (!c) {
      c = { id: 0, alive: false, type, x, z, hp: 1, age: 0, lastHitTick: -1, twin: -1, landTick: -1, sinceLand: -1, wave };
      this.pool.push(c);
    }
    c.id = this.nextId++;
    c.alive = true;
    c.type = type;
    c.x = x;
    c.z = z;
    c.hp = type === "iron" ? TUNING.iron.hp : 1;
    c.age = 0;
    c.lastHitTick = -1;
    c.twin = -1;
    c.landTick = landTick;
    c.sinceLand = -1;
    c.wave = wave;
    return c;
  }

  /** Live cubes snapshot (stable order by id). Safe to iterate while killing. */
  alive(): Cube[] {
    return this.pool.filter((c) => c.alive).sort((a, b) => a.id - b.id);
  }

  get count(): number {
    let n = 0;
    for (const c of this.pool) if (c.alive) n++;
    return n;
  }

  byId(id: number): Cube | undefined {
    const c = this.pool.find((p) => p.id === id);
    return c && c.alive ? c : undefined;
  }

  kill(c: Cube): void {
    c.alive = false;
  }

  airborne(c: Cube): boolean {
    return c.landTick >= 0;
  }

  /** Whether the cube is mid-roll at frame `f` of a tick of length `tickLen`. */
  static rolling(c: Cube, f: number, tickLen: number): boolean {
    return c.alive && c.landTick < 0 && c.age >= 1 && f >= tickLen - TUNING.clock.rollFrames;
  }

  /**
   * Logical cell: origin for the first 50% of the roll, destination after (GDD §6 exceptions).
   * Airborne Skyfall cubes have no logical cell.
   */
  static logical(c: Cube, f: number, tickLen: number): Cell | null {
    if (c.landTick >= 0) return null;
    const switched = Cubes.rolling(c, f, tickLen) && f >= tickLen - TUNING.clock.rollFrames / 2;
    return { x: c.x, z: switched ? c.z - 1 : c.z };
  }

  /** Roll progress 0..1 at frame f (render uses this with interpolation). */
  static rollProgress(c: Cube, f: number, tickLen: number): number {
    if (!Cubes.rolling(c, f, tickLen)) return 0;
    return (f - (tickLen - TUNING.clock.rollFrames)) / TUNING.clock.rollFrames;
  }

  at(cell: Cell, f: number, tickLen: number): Cube | undefined {
    for (const c of this.pool) {
      if (!c.alive) continue;
      const l = Cubes.logical(c, f, tickLen);
      if (l && l.x === cell.x && l.z === cell.z) return c;
    }
    return undefined;
  }

  serialize(): string {
    return this.alive()
      .map((c) => `${c.id}${c.type[0]}${c.x},${c.z},${c.hp},${c.age},${c.landTick},${c.twin}`)
      .join(";");
  }
}
