import type { CubeType, Dir, TileType } from "./types";

/**
 * Sim → presentation events (GDD §29.3 principle 4). The sim pushes; render/audio/UI drain once per frame.
 * Events are plain data so they can be logged, counted and replayed.
 */
export type SimEvent =
  | { t: "Tick"; tick: number; tickLen: number }
  | { t: "Roll"; id: number; x: number; z: number }
  | { t: "CubeSpawn"; id: number; type: CubeType; x: number; z: number; sky?: boolean }
  | { t: "SkyfallWarn"; id: number; x: number; z: number; type: CubeType }
  | { t: "SkyfallLand"; id: number; x: number; z: number }
  | { t: "SkyfallShatter"; id: number; x: number; z: number }
  | { t: "Kill"; id: number; type: CubeType; x: number; z: number; chain: number; index: number; blast: boolean; points: number }
  | { t: "Chain"; n: number; points: number; x: number; z: number }
  | { t: "IronHit"; id: number; hp: number; x: number; z: number }
  | { t: "Miss"; x: number; z: number }
  | { t: "TileRise"; x: number; z: number; type: TileType; delay: number; island: boolean }
  | { t: "TileFall"; x: number; z: number; delay: number; reason: "crumble" | "hinterland" | "escape" | "scar" | "glass" }
  | { t: "CrumbleWarn"; z: number; frames: number }
  | { t: "Crumble"; z: number; reason: "timer" | "escape" | "forbidden" | "hinterland" }
  | { t: "ScarTorn"; x: number; z: number }
  | { t: "Escape"; id: number; type: CubeType; x: number; z: number }
  | { t: "ForbiddenPassed"; id: number; x: number; z: number }
  | { t: "Crush"; id: number; x: number; z: number; fromZ: number }
  | { t: "Step"; from: { x: number; z: number }; to: { x: number; z: number }; dir: Dir }
  | { t: "Blocked"; dir: Dir }
  | { t: "MarkPlaced"; x: number; z: number; void: boolean; onForbidden: boolean }
  | { t: "MarkRemoved"; x: number; z: number }
  | { t: "Detonate"; marks: number }
  | { t: "BlastCharge"; x: number; z: number }
  | { t: "Blast"; x: number; z: number; w: number; h: number }
  | { t: "GlyphGained"; x: number; z: number }
  | { t: "GlassCrack"; x: number; z: number }
  | { t: "BeaconSpawn"; id: number; x: number; z: number }
  | { t: "BeaconCollected"; id: number; x: number; z: number; reward: BeaconReward }
  | { t: "BeaconExpired"; id: number }
  | { t: "LastStand"; on: boolean }
  | { t: "Purify" }
  | { t: "PerfectSector"; sector: number }
  | { t: "SectorStart"; sector: number; tickLen: number }
  | { t: "SectorClear"; sector: number; perfect: boolean }
  | { t: "Score"; amount: number; total: number; reason: string }
  | { t: "Fall"; x: number; z: number; cause: FallCause }
  | { t: "StageClear"; stage: number; marks: number; forbiddenKilled: number }
  | { t: "Announce"; line: AnnouncerLine };

export type BeaconReward = "glyph" | "shard" | "score" | "crumble";
export type FallCause = "shoved" | "crumble" | "glass" | "scar" | "void";
export type AnnouncerLine = "tessera" | "beautiful" | "holdOn" | "purified" | "again";

export class EventQueue {
  private items: SimEvent[] = [];
  push(e: SimEvent): void {
    this.items.push(e);
  }
  /** Returns and clears the pending events (swap, never mutate while iterating). */
  drain(): SimEvent[] {
    const out = this.items;
    this.items = [];
    return out;
  }
  get length(): number {
    return this.items.length;
  }
}
