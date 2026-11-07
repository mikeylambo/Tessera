# TESSERA — Tuning Log

Every change to `src/data/tuning.ts` or authored pacing data is logged here with the measurement that motivated it.

| # | Date | Value | From → To | Evidence | By |
|---|---|---|---|---|---|
| 1 | 2026-11-07 | crumble.startInterval | 8 → 10 ticks | Economy sweep (competent bot, 8 seeds, 12 min cap). At 8 ticks the slab is consumed before formations arrive (first contact ≈ tick 13; the first crumble lands at tick 8). Avg connected ground: 8 → 11.6 tiles, 10 → 20.8 tiles (target 28–49). | Claude |
| 2 | 2026-11-07 | BAND_GAP (formations.ts) band 1 / band 2 | 6 / 5 → 4 / 4 ticks | Same sweep: gap 4 raised competent avg connected ground from 15.5 to 20.8 tiles and median Sector reached from 2.5 to 3.5. Pacing curve's "~1 formation per 8 ticks" is now ~1 per 6–7 ticks. | Claude |

## Open balance findings (not yet met)
- **Competent bot survives 3 Sectors: 4/8 seeds** (seeds 3, 4, 6, 8 survive; 1, 7 fall in Sector 2; 2, 5 in Sector 3). GDD Phase 2 exit wants every seed. Deaths are dominated by escaped Standards (each costs a full rear row) and Glass footing; the bot is a heuristic, so this mixes bot weakness with economy tightness. Needs human playtest before further tuning.
- **Connected ground 20.8 avg vs 28–49 target.** Structural cause: kills are column-locked, so income per lane is ~0.1 tiles/tick while the Crumble removes 1 row per interval. Candidate levers (not applied): spawn distance 12 → 9 rows (dead time at Sector start), Crumble counter starting at first contact, denser band-1 formations.
