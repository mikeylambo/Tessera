import { TUNING } from "../data/tuning";

export interface Beacon {
  id: number;
  x: number;
  z: number;
  ticksLeft: number;
  alive: boolean;
}

/** Owner of Beacons (GDD §6): forward rewards hovering over the void. */
export class Beacons {
  items: Beacon[] = [];
  private nextId = 1;
  /** Remaining ticks of the ×1.5 score boost. */
  boostTicks = 0;

  reset(): void {
    this.items = [];
    this.nextId = 1;
    this.boostTicks = 0;
  }

  spawn(x: number, z: number, life: number = TUNING.beacons.lifetimeTicks): Beacon {
    const b = { id: this.nextId++, x, z, ticksLeft: life, alive: true };
    this.items = [...this.items.filter((i) => i.alive), b];
    return b;
  }

  at(x: number, z: number): Beacon | undefined {
    return this.items.find((b) => b.alive && b.x === x && b.z === z);
  }

  live(): Beacon[] {
    return this.items.filter((b) => b.alive);
  }

  serialize(): string {
    return `${this.live().map((b) => `${b.id}:${b.x},${b.z},${b.ticksLeft}`).join(";")}|${this.boostTicks}`;
  }
}
