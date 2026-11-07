/** Shared sim types. The sim is pure TypeScript: no DOM, no Three, no Math.random. */

export type CubeType = "stone" | "advantage" | "forbidden" | "glass" | "iron" | "phase";
export type TileType = "ground" | "glyph" | "glass" | "raised";
export type Dir = 0 | 1 | 2 | 3 | 4; // 0 none, 1 forward(+z), 2 right(+x), 3 back(−z), 4 left(−x)

export const DIR_DX: Readonly<Record<Dir, number>> = { 0: 0, 1: 0, 2: 1, 3: 0, 4: -1 };
export const DIR_DZ: Readonly<Record<Dir, number>> = { 0: 0, 1: 1, 2: 0, 3: -1, 4: 0 };
export const OPPOSITE: Readonly<Record<Dir, Dir>> = { 0: 0, 1: 3, 2: 4, 3: 1, 4: 2 };

export interface Cell {
  x: number;
  z: number;
}

export const isStandard = (t: CubeType): boolean => t !== "forbidden";

/** One frame of player intent. Device-agnostic; the only thing the sim reads from outside. */
export interface FrameInput {
  /** Currently held step direction (auto-repeat). */
  held: Dir;
  /** Direction newly pressed this frame. */
  press: Dir;
  /** Mark toggle at an absolute cell, pressed this frame. */
  mark: Cell | null;
  detonate: boolean;
  blast: boolean;
  /** Rune offer picked (0–2), −1 none. Only read while a pick is pending. */
  pick: number;
}

export const NO_INPUT: Readonly<FrameInput> = Object.freeze({ held: 0, press: 0, mark: null, detonate: false, blast: false, pick: -1 });

export function cellKey(x: number, z: number): number {
  return z * 8 + x;
}

export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}
