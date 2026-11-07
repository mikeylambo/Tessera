import type { Cell } from "./types";

/** Owner of active marks (GDD §30). Placed, not tethered: marks stay valid after the player moves. */
export class Marks {
  private items: Cell[] = [];

  clear(): void {
    this.items = [];
  }

  list(): readonly Cell[] {
    return this.items;
  }

  get count(): number {
    return this.items.length;
  }

  has(c: Cell): boolean {
    return this.items.some((m) => m.x === c.x && m.z === c.z);
  }

  /** Toggle; returns "placed" | "removed" | "full". */
  toggle(c: Cell, max: number): "placed" | "removed" | "full" {
    const i = this.items.findIndex((m) => m.x === c.x && m.z === c.z);
    if (i >= 0) {
      this.items = this.items.filter((_, j) => j !== i);
      return "removed";
    }
    if (this.items.length >= max) return "full";
    this.items = [...this.items, { x: c.x, z: c.z }];
    return "placed";
  }

  /** Fire: returns the marks and clears them. */
  take(): Cell[] {
    const out = this.items;
    this.items = [];
    return out;
  }

  serialize(): string {
    return this.items.map((m) => `${m.x},${m.z}`).join(";");
  }
}
