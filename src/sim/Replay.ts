import { World, type WorldConfig } from "./World";
import { NO_INPUT, type Dir, type FrameInput } from "./types";

/**
 * Input log: the run is fully determined by (config, log). Entries are sparse — only frames whose input differs
 * from "nothing new, same held direction" are stored.
 * Entry: [frame, held, press, markX, markZ, detonate, blast, pick]; markX = −1 when no mark.
 */
export type LogEntry = [number, number, number, number, number, number, number, number];

export interface ReplayLog {
  version: 1;
  config: Omit<WorldConfig, "stage"> & { stageId?: number };
  frames: number;
  entries: LogEntry[];
}

export class InputRecorder {
  entries: LogEntry[] = [];
  private lastHeld: Dir = 0;

  record(frame: number, i: FrameInput): void {
    const changed = i.held !== this.lastHeld || i.press || i.mark || i.detonate || i.blast || i.pick >= 0;
    if (!changed) return;
    this.lastHeld = i.held;
    this.entries.push([frame, i.held, i.press, i.mark ? i.mark.x : -1, i.mark ? i.mark.z : 0, i.detonate ? 1 : 0, i.blast ? 1 : 0, i.pick]);
  }

  reset(): void {
    this.entries = [];
    this.lastHeld = 0;
  }
}

/** Plays a log back frame by frame (frame index = World.frame before the step). */
export class InputPlayer {
  private i = 0;
  private held: Dir = 0;
  constructor(private readonly entries: readonly LogEntry[]) {}

  next(frame: number): FrameInput {
    const e = this.entries[this.i];
    if (!e || e[0] !== frame) return { ...NO_INPUT, held: this.held };
    this.i++;
    this.held = e[1] as Dir;
    return {
      held: this.held,
      press: e[2] as Dir,
      mark: e[3] >= 0 ? { x: e[3], z: e[4] } : null,
      detonate: e[5] === 1,
      blast: e[6] === 1,
      pick: e[7]
    };
  }
}

/** Re-simulate a log from scratch; returns the resulting world. */
export function resimulate(config: WorldConfig, entries: readonly LogEntry[], frames: number): World {
  const w = new World(config);
  const p = new InputPlayer(entries);
  let guard = 0;
  while (w.frame < frames && !w.ended && guard++ < frames * 4) {
    const f = w.runeOffers ? w.frame : w.frame;
    w.step(p.next(f));
  }
  return w;
}

export function encodeLog(log: ReplayLog): string {
  return JSON.stringify(log);
}
