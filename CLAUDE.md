# TESSERA — Builder Law

Source of truth: `docs/GDD.md`. Read it fully before the first change of every session. This file is the always-loaded law; when in doubt, the GDD wins on detail and this file wins on principle.

## The game in one line
A grid-tactics survival puzzle game where you mark and detonate rolling monoliths, and every kill becomes the ground you stand on.

## Pillars
1. **Every tile is earned.** Ground comes only from kills.
2. **Invites the player to get smarter.** Predictable cadence, full information, every loss explained.
3. **Cold world, warm player.** Cold void and threats; everything the player owns is warm and brightest.
Visual pillars: Minimalism · Contrast · Radiance.

## Design Laws (pass/fail)
1. Every tile is earned: no system creates walkable ground except kills and the start slab.
2. Every threat warns at least one full tick ahead, shape and motion first, color second.
3. Thinking time is sacred: tick ≥ 54 f (LOCKED). Late difficulty = complexity, not speed.
4. The game never judges rhythm. Music follows the tick; muting changes nothing.
5. No hand is unwinnable: every spawned formation passes the fairness solver.
6. Verified, not reported: a feature exists when proven in a running build.

## Anti-pillars
Never: a horde survivor with auto-attacks; free analog movement off the grid; a rhythm game; text-wall tutorials or HUD clutter; a meter instead of the floor as life; hidden rules.

## Tech law (§29–31)
- TypeScript strict + Three.js on @slu/web-shell, Shell-generated (`create-slu-game.mjs --renderer three`).
- Fixed 60 Hz sim, fully deterministic from (seed, input log); render interpolates; sim never reads render state.
- One owner per state (GDD §30). Events drive presentation. Seeded RNG in sim only.
- All tuning in `data/tuning.ts`; values provisional unless LOCKED; never change LOCKED without a DECISIONS.md entry; log tuning changes in TUNING_LOG.md.
- **Never mutate an array while iterating it.** Collect removals; pools with alive flags.
- Units: frames @ 60 fps; 1 tile = 2.0 world units; grid 7 columns (LOCKED).
- Procedural visuals and synthesized audio are final unless a manifest override exists.
- Dev hook `window.__GAME`; URL flags `?stage= ?sector= ?seed= ?quick ?daily= ?playtest ?headless`.
- Do not reuse code from prior Kimi/Gemini prototypes.

## Gate command
`npm run gates` (typecheck + lint + unit + invariants + headless boot + E2E smoke) before every commit.

## Decision rules (§44)
Preserve pillars → fantasy → readability → responsiveness. Simplest solution that serves the experience. Never add mechanics, currencies, screens or systems to fill gaps. Never remove intentional friction (Crumble, Forbidden restraint, Iron HP, hinterland cap). Reversible and minor → choose, log, continue. Prefer lifting proven foundry systems.

## Builder conduct (§45)
- Build continuously through §40 phases; keep the game playable; commit after each proven step.
- Stop and ask only for player-facing spec contradictions or unmeetable performance targets.
- Never silently substitute a mechanic. Never ship a truncated file.
- Report only what is verified: "pushed" ≠ "deployed" ≠ "playable." Say which.
- Michael playtests builds that already look nearly finished: presentation to GDD §23–27 quality before reporting a playtest build.
