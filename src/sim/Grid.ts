import { TUNING } from "../data/tuning";
import { cellKey, type Cell, type TileType } from "./types";

export interface Tile {
  x: number;
  z: number;
  type: TileType;
  bornTick: number;
  /** Consecutive ticks the player has stood on this tile (Glass, Bedrock). */
  standTicks: number;
  /** Tick the player stepped off (Glass); −1 = not armed. */
  leftTick: number;
}

/** Owner of tiles and Scars (GDD §30). */
export class Grid {
  private tiles = new Map<number, Tile>();
  private scars = new Set<number>();
  readonly columns = TUNING.grid.columns;

  clear(): void {
    this.tiles.clear();
    this.scars.clear();
  }

  inBounds(x: number): boolean {
    return x >= 0 && x < this.columns;
  }

  get(x: number, z: number): Tile | undefined {
    return this.tiles.get(cellKey(x, z));
  }

  has(x: number, z: number): boolean {
    return this.tiles.has(cellKey(x, z));
  }

  isScar(x: number, z: number): boolean {
    return this.scars.has(cellKey(x, z));
  }

  /** Adds a tile. Returns false if out of bounds, scarred or already ground. */
  add(x: number, z: number, type: TileType, tick: number): boolean {
    if (!this.inBounds(x)) return false;
    const k = cellKey(x, z);
    if (this.scars.has(k) || this.tiles.has(k)) return false;
    this.tiles.set(k, { x, z, type, bornTick: tick, standTicks: 0, leftTick: -1 });
    return true;
  }

  setType(x: number, z: number, type: TileType): void {
    const t = this.get(x, z);
    if (t) t.type = type;
  }

  remove(x: number, z: number): Tile | undefined {
    const k = cellKey(x, z);
    const t = this.tiles.get(k);
    if (t) this.tiles.delete(k);
    return t;
  }

  scar(x: number, z: number): void {
    const k = cellKey(x, z);
    this.tiles.delete(k);
    this.scars.add(k);
  }

  get size(): number {
    return this.tiles.size;
  }

  /** Snapshot list (safe to iterate while mutating the grid). */
  list(): Tile[] {
    return [...this.tiles.values()];
  }

  scarList(): Cell[] {
    return [...this.scars].map((k) => ({ x: ((k % 8) + 8) % 8, z: Math.floor(k / 8) }));
  }

  rearZ(): number | null {
    let min: number | null = null;
    for (const t of this.tiles.values()) if (min === null || t.z < min) min = t.z;
    return min;
  }

  frontZ(): number | null {
    let max: number | null = null;
    for (const t of this.tiles.values()) if (max === null || t.z > max) max = t.z;
    return max;
  }

  row(z: number): Tile[] {
    const out: Tile[] = [];
    for (let x = 0; x < this.columns; x++) {
      const t = this.get(x, z);
      if (t) out.push(t);
    }
    return out;
  }

  /** True if (x,z) is 4-adjacent to any existing tile. */
  touchesGround(x: number, z: number): boolean {
    return this.has(x - 1, z) || this.has(x + 1, z) || this.has(x, z - 1) || this.has(x, z + 1);
  }

  /** Tiles 4-connected to `from` (inclusive). Empty if `from` is not ground. */
  connected(from: Cell): Tile[] {
    const start = this.get(from.x, from.z);
    if (!start) return [];
    const seen = new Set<number>([cellKey(start.x, start.z)]);
    const out: Tile[] = [start];
    for (let i = 0; i < out.length; i++) {
      const t = out[i]!;
      const n: Array<[number, number]> = [[t.x - 1, t.z], [t.x + 1, t.z], [t.x, t.z - 1], [t.x, t.z + 1]];
      for (const [nx, nz] of n) {
        const k = cellKey(nx, nz);
        if (seen.has(k)) continue;
        const nt = this.tiles.get(k);
        if (!nt) continue;
        seen.add(k);
        out.push(nt);
      }
    }
    return out;
  }

  /** Deterministic serialization for state hashing. */
  serialize(): string {
    const keys = [...this.tiles.keys()].sort((a, b) => a - b);
    const t = keys.map((k) => {
      const v = this.tiles.get(k)!;
      return `${k}:${v.type[0]}${v.standTicks}/${v.leftTick}`;
    });
    const s = [...this.scars].sort((a, b) => a - b);
    return `T${t.join(",")}|S${s.join(",")}`;
  }
}
