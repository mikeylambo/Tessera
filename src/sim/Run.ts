import type { RuneId } from "../data/runes";

/** Owner of glyph order, rune shards and runes owned (GDD §30). */
export class Run {
  /** Glyph tiles in acquisition order (oldest first); count = held glyphs. */
  glyphs: Array<{ x: number; z: number }> = [];
  shards = 0;
  runes: RuneId[] = [];

  reset(): void {
    this.glyphs = [];
    this.shards = 0;
    this.runes = [];
  }

  stacks(id: RuneId): number {
    let n = 0;
    for (const r of this.runes) if (r === id) n++;
    return n;
  }

  serialize(): string {
    return `${this.glyphs.map((g) => `${g.x},${g.z}`).join(";")}|${this.shards}|${this.runes.join(",")}`;
  }
}
