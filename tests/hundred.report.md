# The Hundred — solvability report (stages 1–80)

Every stage below has a witness input log (`tests/witness/NNN.json`) found by the plan-search solver
(`npm run solve`, `src/dev/solver.ts`): beam search over real-sim macro-actions with a protected expert-policy lineage.
`npm run gates` replays each witness and requires: stage cleared, marks = par, rating ✦.
Par = fewest marks among solutions found (best found, not a proof of optimality). Search statistics per run: `artifacts/solve-*.md`.

| Stage | Act | Name | Objective | Ideas | Par | Witness clear time |
|---|---|---|---|---|---|---|
| 1 | 1 | First Light | clear | Stone | 1 | 4.7 s |
| 2 | 1 | Over the Void | exit z5 | Stone | 3 | 14.6 s |
| 3 | 1 | The Fall Behind | exit z7 | Crumble 5 | 6 | 12.8 s |
| 4 | 1 | Two Marks | clear | Stone | 4 | 9.6 s |
| 5 | 1 | Choose Where | exit z7 | Crumble 7 | 6 | 15.2 s |
| 6 | 1 | Islands | exit z6 | Stone | 7 | 15.8 s |
| 7 | 1 | Reach | exit z7 | Stone | 8 | 18.2 s |
| 8 | 1 | Pressure | survive 28t | Crumble 6 | 13 | 33.6 s |
| 9 | 1 | Lanes | exit z9 | Crumble 7 | 13 | 24.2 s |
| 10 | 1 | Crossing | exit z11 | Crumble 7 | 16 | 32.4 s |
| 11 | 2 | Do Not Touch | survive 18t | Forbidden | 0 | 21.6 s |
| 12 | 2 | Let It Pass | exit z6 | Forbidden | 5 | 16.4 s |
| 13 | 2 | Glyph | clear | Advantage | 4 | 18.7 s |
| 14 | 2 | Breath | clear | Advantage | 7 | 16.0 s |
| 15 | 2 | Scar | exit z7 | Forbidden, Crumble 8 | 6 | 16.7 s |
| 16 | 2 | Narrow Gate | exit z7 | Forbidden | 6 | 16.6 s |
| 17 | 2 | Restraint | clear | Forbidden | 7 | 14.3 s |
| 18 | 2 | Glyph Bank | clear | Advantage | 9 | 17.9 s |
| 19 | 2 | Ledge | survive 24t | Crumble 6 | 10 | 28.8 s |
| 20 | 2 | Hold the Line | clear | Forbidden, Advantage | 7 | 19.2 s |
| 21 | 2 | Forward Light | exit z8 | Forbidden, Crumble 8 | 7 | 21.8 s |
| 22 | 2 | Two Glyphs | clear | Advantage | 12 | 18.3 s |
| 23 | 2 | Pressure Point | survive 24t | Forbidden, Crumble 6 | 8 | 28.8 s |
| 24 | 2 | Bridge of Kings | exit z10 | Forbidden, Advantage, Crumble 7 | 8 | 26.9 s |
| 25 | 2 | The Veil | exit z11 | Forbidden, Advantage, Crumble 7 | 11 | 26.6 s |
| 26 | 3 | Glass | clear | Glass | 3 | 10.8 s |
| 27 | 3 | Temporary | exit z6 | Glass | 3 | 13.8 s |
| 28 | 3 | Shatter Line | clear | Glass | 10 | 14.4 s |
| 29 | 3 | Glass and Restraint | exit z6 | Forbidden, Glass | 5 | 18.2 s |
| 30 | 3 | Fragile Crossing | exit z9 | Glass, Crumble 7 | 11 | 30.2 s |
| 31 | 3 | Iron | clear | Iron | 6 | 8.6 s |
| 32 | 3 | High Ground | clear | Iron | 10 | 16.8 s |
| 33 | 3 | Anvils | clear | Iron | 17 | 16.7 s |
| 34 | 3 | Iron and Glass | exit z7 | Glass, Iron | 12 | 20.3 s |
| 35 | 3 | Blast the Iron | clear | Advantage, Iron | 9 | 16.8 s |
| 36 | 3 | Forge | clear | Forbidden, Advantage, Iron | 9 | 15.8 s |
| 37 | 3 | Material Crossing | exit z9 | Glass, Iron, Crumble 7 | 15 | 26.3 s |
| 38 | 3 | Watch the Sky | survive 14t | Skyfall | 4 | 16.8 s |
| 39 | 3 | Pre-mark | clear | Skyfall | 4 | 13.3 s |
| 40 | 3 | Rain | clear | Skyfall | 6 | 12.1 s |
| 41 | 3 | Glass Rain | exit z6 | Skyfall | 3 | 7.8 s |
| 42 | 3 | Iron Sky | clear | Skyfall | 10 | 13.3 s |
| 43 | 3 | Sky and Restraint | clear | Forbidden, Skyfall | 5 | 15.5 s |
| 44 | 3 | Storm Front | survive 22t | Glass, Iron, Skyfall, Crumble 7 | 13 | 26.4 s |
| 45 | 3 | Material | exit z10 | Advantage, Glass, Iron, Skyfall, Crumble 7 | 17 | 27.4 s |
| 46 | 4 | Two Halves | clear | Phase | 2 | 4.8 s |
| 47 | 4 | Tether | clear | Phase | 6 | 14.4 s |
| 48 | 4 | Split | exit z6 | Phase | 7 | 19.9 s |
| 49 | 4 | Timing | clear | Iron, Phase | 15 | 16.8 s |
| 50 | 4 | Phase and Restraint | clear | Forbidden, Phase | 5 | 16.8 s |
| 51 | 4 | Phase Bridge | exit z8 | Phase, Crumble 8 | 7 | 16.2 s |
| 52 | 4 | Last Stand | survive 22t | Forbidden, Last Stand | 8 | 26.4 s |
| 53 | 4 | Hold On | survive 24t | Forbidden, Last Stand | 9 | 28.8 s |
| 54 | 4 | Purify | survive 26t | Forbidden, Advantage, Last Stand | 11 | 31.2 s |
| 55 | 4 | Phase Storm | clear | Phase | 11 | 21.6 s |
| 56 | 4 | Glass Tether | exit z6 | Glass, Phase | 7 | 18.5 s |
| 57 | 4 | Iron Tether | clear | Iron, Phase | 15 | 19.2 s |
| 58 | 4 | Phase Sky | clear | Phase, Skyfall | 6 | 15.6 s |
| 59 | 4 | Last Phase | survive 22t | Forbidden, Phase, Last Stand | 8 | 26.4 s |
| 60 | 4 | Pressure of Two | survive 24t | Phase, Crumble 6 | 11 | 28.8 s |
| 61 | 4 | Phase Crossing | exit z9 | Phase, Crumble 7 | 8 | 16.3 s |
| 62 | 4 | Twin Glyphs | clear | Advantage, Phase | 13 | 19.5 s |
| 63 | 4 | Restless | clear | Forbidden, Phase, Skyfall | 8 | 15.5 s |
| 64 | 4 | Hold Together | survive 24t | Forbidden, Phase, Last Stand | 11 | 28.8 s |
| 65 | 4 | Phase | exit z10 | Advantage, Iron, Phase, Crumble 7 | 15 | 29.0 s |
| 66 | 5 | Every Lesson | clear | Forbidden, Advantage, Iron | 8 | 17.9 s |
| 67 | 5 | Glass Bridge | exit z7 | Glass | 5 | 14.6 s |
| 68 | 5 | Long Shadow | clear | Skyfall | 11 | 14.6 s |
| 69 | 5 | Iron Will | clear | Iron | 22 | 22.2 s |
| 70 | 5 | Seventy | exit z9 | Forbidden, Advantage, Phase, Crumble 7 | 6 | 27.2 s |
| 71 | 5 | Small Ground | survive 22t | Forbidden, Last Stand, Crumble 8 | 7 | 26.4 s |
| 72 | 5 | Glass Gauntlet | clear | Glass | 10 | 16.8 s |
| 73 | 5 | Three Ways | survive 24t | Forbidden, Crumble 6 | 9 | 28.8 s |
| 74 | 5 | Blast Chain | clear | Advantage | 17 | 18.8 s |
| 75 | 5 | Skyfall Crossing | exit z8 | Skyfall, Crumble 8 | 7 | 17.5 s |
| 76 | 5 | Tethered Iron | clear | Iron, Phase | 15 | 19.1 s |
| 77 | 5 | Veil of Glass | exit z7 | Forbidden, Glass | 6 | 19.0 s |
| 78 | 5 | Depth | exit z11 | Advantage, Iron, Phase, Crumble 7 | 10 | 26.4 s |
| 79 | 5 | Restraint Absolute | clear | Forbidden | 7 | 26.3 s |
| 80 | 5 | Mastery | exit z12 | Forbidden, Advantage, Glass, Iron, Phase, Skyfall, Crumble 7 | 17 | 30.8 s |
