/** Hundred stage schema (GDD §16 mode-specific spaces). One JSON file per stage. */
export interface StageWave {
  /** Tick on which the wave appears. */
  at: number;
  /** Absolute z of the wave's nearest row. */
  z: number;
  /** Nearest-first row strings, same alphabet as formations. */
  rows: string[];
}

export interface StageGhost {
  /** Cell for the ghost sigil. */
  x: number;
  z: number;
  /** Visible from this tick until the ghost's cell has been marked and detonated with a kill. */
  from: number;
}

export type StageObjective =
  | { type: "exit"; z: number }
  | { type: "clear" }
  | { type: "survive"; ticks: number };

export interface StageDef {
  id: number;
  name: string;
  act: number;
  /** Rows of start ground from z = 0 upward; X = tile, . = void. */
  ground: string[];
  player: [number, number];
  tick?: number;
  /** Timed crumble interval in ticks; 0 = off. */
  crumble: number;
  waves: StageWave[];
  beacons?: Array<{ at: number; x: number; z: number }>;
  /** Skyfall cubes: telegraphed 2 ticks (LOCKED) before landing on (x, z), then they roll. */
  skyfall?: Array<{ at: number; x: number; z: number; type?: "stone" | "glass" | "iron" | "advantage" | "forbidden" }>;
  objective: StageObjective;
  /** Solver/bot-derived par in marks placed. */
  par: number;
  ghosts?: StageGhost[];
  /** Frames at the start with no failure state (GDD §22). */
  noFail?: number;
  /** Last Stand available (Act IV+). */
  lastStand?: boolean;
  /** Act VI · The Turn: on these ticks the construct rotates 90° about the front edge of the connected ground. */
  turns?: number[];
}
