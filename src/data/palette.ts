/** Colour discipline (GDD §23, LOCKED): cold void, cool mid-value threats, warm brightest player-owned things. */
export const PALETTE = {
  void: 0x050608,
  fog: 0x050608,
  ground: 0x3a3632,
  seam: 0xffa64a,
  stone: 0x9a948c,
  glass: 0x7fd8e8,
  iron: 0x2b2e33,
  advantage: 0x2fd38a,
  forbiddenBody: 0x0d0c12,
  forbiddenCore: 0x8b5cf6,
  mark: 0xffb347,
  scar: 0x1a0f2a,
  lattice: 0x8a93a3,
  figure: 0xd8d2c8,
  core: 0xffb347,
  crumbleWarn: 0xff4a2a,
  beacon: 0xffe2a8,
  shadow: 0x000000
} as const;

export type PaletteKey = keyof typeof PALETTE;
