import { tunables } from "@slu/web-shell/tuning";

/**
 * Tessera detonation-feel and presentation tunables (canon: tuning/tessera.feel.json; live via `?tune`).
 * Presentation only — nothing here is read by the sim (DECISIONS #46, #47).
 */
export const FEEL = tunables.define("tessera.feel", {
  // 2.1 hit
  hitBase: { min: 0, max: 8, step: 1, default: 3, label: "hit-stop base (f)" },
  hitPerChain: { min: 0, max: 3, step: 1, default: 1, label: "hit-stop + per chain kill (f)" },
  hitCap: { min: 0, max: 10, step: 1, default: 6, label: "hit-stop cap (f)" },
  shardsMin: { min: 2, max: 24, step: 1, default: 6 },
  shardsMax: { min: 2, max: 24, step: 1, default: 10 },
  cellFlashFrames: { min: 0, max: 12, step: 1, default: 4 },
  vibrateKillMs: { min: 0, max: 60, step: 1, default: 10 },
  // 2.2 chain
  chainStaggerFrames: { min: 0, max: 8, step: 0.5, default: 3, label: "chain kill/tile stagger (f)" },
  rippleChainMin: { min: 2, max: 9, step: 1, default: 3 },
  rippleHeight: { min: 0, max: 0.4, step: 0.01, default: 0.14 },
  gradeChainMin: { min: 3, max: 12, step: 1, default: 6 },
  gradeLift: { min: 0, max: 0.2, step: 0.005, default: 0.08 },
  caChainMin: { min: 2, max: 12, step: 1, default: 4 },
  caFrames: { min: 1, max: 6, step: 1, default: 3 },
  caAmount: { min: 0, max: 0.02, step: 0.0005, default: 0.006 },
  // 2.3 blast
  blastInhaleFrames: { min: 0, max: 6, step: 1, default: 2 },
  blastInhaleDim: { min: 0, max: 0.4, step: 0.01, default: 0.18 },
  kickBase: { min: 0, max: 2, step: 0.05, default: 0.5, label: "camera kick base (units)" },
  kickPerKill: { min: 0, max: 0.4, step: 0.01, default: 0.12 },
  kickCap: { min: 0, max: 3, step: 0.05, default: 1.4 },
  // 2.4 miss
  missShakePx: { min: 0, max: 6, step: 0.5, default: 2 },
  // 1.2 ground
  riseFrames: { min: 4, max: 24, step: 1, default: 11, label: "tile rise (f) ≈ 180 ms" },
  riseBack: { min: 0, max: 3, step: 0.05, default: 1.6, label: "ease-out-back overshoot" },
  sweepFrames: { min: 4, max: 40, step: 1, default: 16, label: "warm edge-light sweep (f)" },
  frontRim: { min: 0, max: 1.5, step: 0.05, default: 0.55 },
  hinterlandCool: { min: 0, max: 1, step: 0.05, default: 0.45, label: "cooling of old ground" },
  hinterlandRows: { min: 2, max: 20, step: 1, default: 7 },
  // 1.3 figure
  coreBreath: { min: 0, max: 0.6, step: 0.01, default: 0.22 },
  emberFrames: { min: 0, max: 40, step: 1, default: 18, label: "footstep ember (f) ≈ 300 ms" },
  // 1.4 camera
  lastStandPush: { min: 0, max: 0.15, step: 0.005, default: 0.06 },
  orbitYaw: { min: 0, max: 0.6, step: 0.01, default: 0.22, label: "title/results orbit amplitude (rad)" },
  orbitSpeed: { min: 0, max: 0.3, step: 0.005, default: 0.06 },
  // 1.1 post
  aberrationBlastFrames: { min: 0, max: 6, step: 1, default: 4 }
});
