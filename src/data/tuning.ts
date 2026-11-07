/**
 * TESSERA tuning — the single home of gameplay numbers (GDD §31).
 * Units: frames @ 60 fps; cells are integer (x 0–6, z rows forward); 1 tile = 2.0 world units.
 * Values are provisional unless marked LOCKED. Never change a LOCKED value without a DECISIONS.md entry.
 * Log every tuning change in TUNING_LOG.md.
 */
export const TUNING = {
  grid: {
    /** LOCKED (GDD §16, §31) */
    columns: 7,
    /** LOCKED (CLAUDE.md units) */
    tileWorld: 2.0,
    startSlabRows: 4
  },
  clock: {
    tickDefault: 72,
    /** LOCKED — Design Law 3: thinking time is sacred */
    tickFloor: 54,
    rollFrames: 24,
    tickDecrementPerSector: 2
  },
  movement: {
    stepFrames: 9,
    reverseAfterFrame: 5,
    autoRepeatDelay: 12,
    blockedNudgeFrames: 3,
    shoveSlideFrames: 12,
    hopArc: 0.15,
    fallFrames: 40
  },
  input: { bufferFrames: 8 },
  reach: { radius: 3, ironBonus: 1 },
  marks: { maxActive: 2, markLock: 4 },
  detonate: { lock: 6, recovery: 6 },
  blast: { charge: 4, active: 10, recovery: 10, radius: 1 },
  glyphs: { maxHeld: 3 },
  crumble: {
    startInterval: 10,
    floor: 4,
    /** −1 tick every N sectors */
    sectorsPerStep: 3,
    warnFrames: 30
  },
  economy: {
    hinterlandRows: 6,
    weightBase: 28,
    weightPer: 14,
    weightMinInterval: 3
  },
  beacons: {
    perSectorMin: 2,
    perSectorMax: 3,
    distMin: 6,
    distMax: 10,
    lifetimeTicks: 16,
    dimTicks: 4,
    scoreBoost: 1.5,
    scoreBoostTicks: 8,
    shardsPerRune: 3
  },
  glass: { shatterAfterLeaveTicks: 2, shatterAfterStandTicks: 4 },
  iron: { hp: 3, raise: 0.5 },
  /** LOCKED — Design Law 2 */
  skyfall: { telegraphTicks: 2 },
  lastStand: { triggerTiles: 14, durationFrames: 900, purifyTiles: 21, scoreMul: 2 },
  crush: { stunFrames: 18 },
  camera: { back: 12, up: 14, ahead: 6, aheadFar: 10, damping: 0.12, xFollow: 0.3, fov: 50, portraitPullback: 1.15 },
  spawn: { distance: 12, liveCap: 35, fadeTicks: 1 },
  sector: {
    formationsMin: 3,
    formationsMax: 5,
    firstSpawnTick: 2,
    breatherTicks: 3,
    fairnessRerolls: 8
  },
  hitstop: { base: 3, perExtraKill: 1, cap: 8, climax: 6 },
  score: {
    stone: 100,
    glass: 80,
    iron: 300,
    advantage: 200,
    phase: 400,
    skyfallLanding: 150,
    forbiddenPassed: 50,
    island: 150,
    beacon: 500,
    perfectSector: 2000,
    purify: 3000,
    depthPerRow: 10,
    chamber: 2500
  },
  onboarding: { noFailFrames: 600, ghostRetireSuccesses: 2, hintAfterFailures: 3 }
} as const;

/** tick = max(54, 72 − 2 × (Sector − 1)) — GDD §19 */
export function tickForSector(sector: number): number {
  return Math.max(TUNING.clock.tickFloor, TUNING.clock.tickDefault - TUNING.clock.tickDecrementPerSector * (sector - 1));
}

/** Base crumble interval for a sector (before weight). GDD §6 */
export function crumbleIntervalForSector(sector: number): number {
  return Math.max(TUNING.crumble.floor, TUNING.crumble.startInterval - Math.floor((sector - 1) / TUNING.crumble.sectorsPerStep));
}

/** Music tempo follows the tick: BPM = 7200 / tick (one tick = two beats). GDD §19, §26 */
export function bpmForTick(tick: number): number {
  return 7200 / tick;
}
