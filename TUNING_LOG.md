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
