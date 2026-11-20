# TESSERA — Tuning Log

Every change to `src/data/tuning.ts` or authored pacing data is logged here with the measurement that motivated it.

| # | Date | Value | From → To | Evidence | By |
|---|---|---|---|---|---|
| 1 | 2026-11-07 | crumble.startInterval | 8 → 10 ticks | Economy sweep (competent bot, 8 seeds, 12 min cap). At 8 ticks the slab is consumed before formations arrive (first contact ≈ tick 13; the first crumble lands at tick 8). Avg connected ground: 8 → 11.6 tiles, 10 → 20.8 tiles (target 28–49). | Claude |
| 2 | 2026-11-07 | BAND_GAP (formations.ts) band 1 / band 2 | 6 / 5 → 4 / 4 ticks | Same sweep: gap 4 raised competent avg connected ground from 15.5 to 20.8 tiles and median Sector reached from 2.5 to 3.5. Pacing curve's "~1 formation per 8 ticks" is now ~1 per 6–7 ticks. | Claude |
| 3 | 2026-11-07 | crumble.holdUntilContact (new) | none → sector | Crumble timer (and its warning) only runs once a live cube is within Reach of the connected front row; re-armed at every Endless/Daily Sector start (Hundred keeps authored pacing). Sweep `npm run sweep`, competent bot, seeds 1–8: **none** 20.2 avg connected / 4 of 8 survive 3 Sectors · **run** (first contact of the run only) 24.1 / 7 of 8 · **sector** 29.1 / 7 of 8. Chosen: sector. | Claude |
| 4 | 2026-11-07 | competent bot restraint (src/dev/bot.ts — verification bot, not game tuning) | dodges a Forbidden in its lane (≤ 3 rows) before marking/detonating; lane danger for Forbidden covers 0–5 rows (Standards keep 0–2) | Remaining failures were the bot standing in or backing down a Forbidden's lane into a crush, not economy. Attribution: bot change alone with hold off = 19.6 avg / 4 of 8 (no economic effect). Final, hold = sector: seeds 1–8 **30.1 avg, 8/8 survive**; fresh seeds 9–16 **30.9 avg, 8/8 survive**. Act I stays expert-bot-solvable. | Claude |

## Balance status
- **Met:** average connected ground in band (30.1 on seeds 1–8, 30.9 on seeds 9–16; target 28–49) and every seed survives 3 Sectors (16/16). Gate test now requires 8/8.
- **Watch:** the average sits near the low edge of the band; the lowest single-seed average was ~24. Levers held in reserve, in Michael's order: denser band-1 formations, then spawn distance. Human playtest should confirm before further changes.

| 5 | 2026-11-10 | camera.aheadFar | 10 → 8 units | Turn prototype capture (1280×720): with look-ahead 10 the figure sits ~22° below centre against a 25° half-FOV and is clipped at the frame's bottom edge, breaking GDD §15 camera priority #1 (player cell + Reach). At 8 the figure sits ~17° below centre and the hinged cliff below the ledge is in frame. Geometry: camera 14 up / 18 behind the look target. | Claude |
| 6 | 2026-11-19 | look.post bloomThreshold / vignetteAmount / grain / grainAmount | 0.85 / 0.42 / off / — → 1.0 / 0.32 / on / 0.012 | Visual bar §1.1; before/after stills in docs/evidence/visual-bar (DECISIONS #76) | Claude |
| 7 | 2026-11-19 | hitstop cap (presentation) | 8 → 6 f (now `tessera.feel.hitCap`; `TUNING.hitstop` no longer read by View) | Brief §2.2 (DECISIONS #77) | Claude |
| 8 | 2026-11-19 | new group `tessera.feel` (33 values, see tuning/tessera.feel.json) | — | Brief §1–2; all presentation-only | Claude |
| 9 | 2026-11-19 | Climax flash (tessera.climax bundle) | 0.15 → 0.08 | Chain/Blast after-stills: the full-screen ember flash lifted the void to brown for ~6 f, against "void is the darkest value" (§23) | Claude |

## §36 perf re-measure (2026-11-19, `node tools/perf.mjs`, bot Daily, 600 frames after 40 s of play)
| Target | Sim step p50 / p99 | CPU per rendered frame p50 | Heap |
|---|---|---|---|
| Desktop 1280×720 | 0.1 / 0.5 ms (≤ 1 ms ✓) | 0.8 ms | 16 MB |
| Pixel 7 emulation, 4× CPU throttle | 0.1 / 3.4 ms (p99 over budget under 4× throttle) | 2.9 ms | 16 MB |
Shortfall, honestly: GPU frame time cannot be measured in this container (SwiftShader software GL); its p99 frames of 2–3 s are shader-compile stalls in software GL, not representative. A device check on real hardware (MacBook Pro 5300M, iPhone 13 / Pixel 7) is still required for the 8 / 14 ms frame-time targets — the new post cost is one extra full-screen pass (Tessera post) + grain and a backdrop sphere + one plane.
| 10 | 2026-11-20 | stage 9 exit / par | z9 / 13 → z8 / 11 | human-bot clear rate 76% → 100% (50 seeds); Crumble 7 → 9 alone: 76% (no effect) | Claude |
| 11 | 2026-11-20 | stage 10 exit / par | z11 / 16 → z10 / 15 | human-bot clear rate 24% → 86% (50 seeds); Crumble 7 → 9 alone: 24% | Claude |
