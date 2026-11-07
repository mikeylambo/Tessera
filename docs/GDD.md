# TESSERA
## Game Design & Build Handoff Document

**Version:** 1.3
**Status:** Production-Ready
**Last Updated:** 2026-11-06
**Primary Platform:** Web (PC + mobile browsers); premium wrappers for Steam (Tauri) and iOS/Android (Capacitor); YouTube Playables build
**Engine / Stack:** TypeScript + Three.js on @slu/web-shell
✚ **Base Repo:** Shell-generated (`create-slu-game.mjs`, see §29.2), new repo `mikeylambo/tessera`
✚ **Universe:** Standalone
✚ **Pipeline Triage Score:** __ / 30 (Michael to fill from `TRIAGE.md`)

**Purpose:** This document is the source of truth for the game's intended player experience, systems, content, presentation, and completion criteria.

If implementation details conflict with the intended player experience, preserve the player experience unless a documented technical constraint prevents it.

**Units used throughout:** time in frames @ 60 fps (ms in parentheses where useful); 1 tile = 2.0 world units; the grid is 7 columns wide (x = 0–6); rows (z) increase toward the threat ("forward"). A **tick** is one cube roll step (default 72 f / 1,200 ms).

---

## 0. Executive Summary

### One-Sentence Pitch
A grid-tactics survival puzzle game where players mark and detonate rolling monoliths to carve the ground they stand on, distinguished by every kill becoming terrain: the threat is your future floor.

✚ **Tagline:** Every tile is earned.

**North star:** Puzzle Game of the Year 2026.

### Player Fantasy
The player should feel like a lone light on a shrinking ledge over an infinite void, building a path forward out of the very thing trying to crush it.

### Core Experience
The game is fundamentally about:
1. Reading a cadence-locked wave and committing to a plan.
2. Choosing *where* each cube dies: safety now vs. a foothold ahead.
3. Advancing ahead of the Crumble that eats your ground from behind.

The player should spend most of their time stepping across a tile grid, placing marks within Reach (including over the void), and detonating them as cubes roll onto them.

### ✚ The Bet
> *Does choosing where each cube dies, building your path out of the threat, under the pressure of a crumbling ledge, feel unlike anything else?*

Phase 0 (§40) exists to answer this and nothing more.

### ✚ Competitive Position
| | Closest existing game: Intelligent Qube (1997) | How we differ |
|---|---|---|
| Verb | Mark a tile, detonate a cube on it | Marks project over the void within Reach; every kill **creates ground** where it died |
| Payoff | Cube removed; stage only ever shrinks | Territory grows; islands, bridges, raised high ground for range |
| Space / structure | Fixed box arena, 9 stages | Advancing frontier over an abyss; 100-stage slow-unveiling campaign + Endless + Daily |

### Target Experience
- **Session length:** 5–10 min (The Hundred), 15–25 min (Endless), 5–15 min (Daily)
- **Players:** 1
- **Perspective:** Elevated third-person, camera follows forward
- **Genre:** Action-puzzle / grid tactics, roguelite structure in Endless
- **Audience:** 12+; puzzle and action-puzzle players (Intelligent Qube, Tetris Effect, Into the Breach, Baba Is You audiences)
- **Complexity:** Low input complexity, high decision depth (midcore)
- **Primary input:** Keyboard/mouse, gamepad and touch, all first-class

---

## 1. Design Pillars

### Pillar 1 — Every Tile Is Earned
- **Meaning:** All ground beyond the starting slab is made from kills. The map is a record of the player's precision.
- **Player consequence:** Kill placement is the core decision; the player's path across the void is uniquely theirs.
- **Reject features that:** grant free terrain, auto-generate walkable ground, or let ground accumulate without cost.

### Pillar 2 — Invites the Player to Get Smarter
- **Meaning:** A fixed, predictable roll cadence and full information; marks are deliberate; every loss teaches.
- **Player consequence:** Planning beats reflexes; skill visibly compounds over sessions.
- **Reject features that:** require twitch aim, judge rhythm, hide rules, randomize after a wave is visible, or auto-attack.

### Pillar 3 — Cold World, Warm Player
- **Meaning:** The universe is cold, monolithic and testing; everything that belongs to the player is warm, and the game visibly cares.
- **Player consequence:** The player feels challenged, never mocked; every loss is explained.
- **Reject features that:** punish without teaching, put warm colors on threats, or obscure why something happened.

**Visual pillars:** **Minimalism** (nothing on screen without purpose) · **Contrast** (cold void vs. warm player light; threats readable in grayscale) · **Radiance** (light is reward: kills, ground and marks glow).

### ✚ Design Laws
1. **Every tile is earned.** No system creates walkable ground except kills (and the starting slab).
2. **Every threat warns at least one full tick ahead,** by shape and motion first, color second.
3. **Thinking time is sacred.** The tick never drops below 54 f; late difficulty comes from complexity, not speed.
4. **The game never judges rhythm.** Music follows the tick; muting it changes nothing.
5. **No hand is unwinnable.** Every spawned formation is solver-checked fair.
6. **Verified, not reported.** A feature exists when it is proven in a running build.

---

## 2. Anti-Pillars
The game should not become:
- a horde survivor with auto-attacks and stat creep
- free analog 3D movement off the grid
- a rhythm game
- text-wall tutorials or a cluttered HUD
- a game where a meter, not the floor, decides your life
- dependent on memorizing hidden rules

---

## 3. Reference DNA

| Reference | Take | Do Not Take |
|---|---|---|
| Intelligent Qube (PS1) | Mark/detonate; Standard / Advantage / Forbidden; edge-pivot rolling monoliths; rear-row loss; perfect-wave reward; dread of scale; tiny figure vs. vast geometry | Fixed box arena; the "IQ" score label; long dead waits between waves |
| Tetris Effect / Lumines | Visual-audio unity; kills as music | Judged rhythm; block-dropping |
| Into the Breach | Full information; deterministic consequences; telegraphed threats | Turn-based pausing |
| Slay the Spire / Hades | Run structure; pick 1 of 3 upgrades | Meta-currency grind |
| Baba Is You / The Witness | Slow unveiling: one idea at a time, shown in isolation before combined | Obscure solutions |

### Reference Weighting
- Intelligent Qube: 40% (core verb and dread)
- Tetris Effect / Lumines: 10% (audio-visual unity)
- Into the Breach + Baba Is You: 15% (readability, unveiling)
- Roguelite structure: 10%
- Original direction: 25% (kills-become-terrain, Reach over void, islands, Crumble, Beacons, The Turn)

### ✚ Calibration Data
Intelligent Qube rolls cubes at a steady cadence of roughly 1–1.5 s per step with an edge-pivot roll. **Target the feel, not the exact values:** our default tick is 72 f (1.2 s) with a 24 f roll; we deliberately cap speed at 54 f because our Reach-over-void decisions need more reading time than IQ's on-floor marks.

---

## 4. Core Loop

### Moment-to-Moment Loop
Read incoming formation → step to a vantage tile → place 1–2 marks (ground or projected into void) → cube rolls onto mark → detonate → cube becomes a tile → step onto new ground → REPEAT

### Match / Mission Loop
**The Hundred:** 1. Enter stage → 2. Read the authored setup → 3. Resolve formations and Skyfall → 4. Meet the objective (reach exit row / clear all Standards / survive N ticks) → 5. Rating ◇ ◆ ✦ vs. solver par.

**Endless:** 1. Sector begins (3–5 formations, 2–3 Beacons) → 2. Build forward, collect Beacons, let Forbidden pass → 3. Sector clears → 4. Pick 1 of 3 Runes (every 4th Sector: a Chamber puzzle first) → 5. Repeat until you fall → Results.

### Session Loop
Enter → play a Hundred stage or an Endless/Daily run → learn a cube, a Rune synergy, a route → retry instantly or advance → beat best Depth/Score/par.

### Long-Term Loop
Clear Hundred acts → each act unlocks its ideas into Endless and its puzzle stages as Chambers → harder, richer Endless runs → Daily leaderboard mastery → Finale update (Act VI, The Turn).

### ✚ Fiction ↔ Mechanics Map
Standalone and wordless. The fiction is minimal and environmental: a small light crosses an indifferent void of monoliths.

| Mechanic / Mode | Fiction meaning |
|---|---|
| Kills become ground | The light can only stand on what it has transformed |
| Crumble | The void reclaims everything left behind |
| Forbidden cubes | Things that must not be touched; destroying one tears the world (Scar) |
| Advantage / Glyph | Stored resonance; released as a wave of creation (Blast) |
| Beacons | Distant lights worth reaching |
| Last Stand / Purify | The world inverts when the light is nearly extinguished; surviving restores it |
| The Hundred | A long crossing; the construct reveals more of itself |
| The Turn (Act VI) | The construct was a cube all along; the light walks its faces |
| Daily Tessera | Everyone crosses the same void today |

---

## 5. Player Goals

### Immediate Goals
- Which cube dies where, and which do I let pass?
- Where will I stand next tick?
- Can I reach that Beacon before it fades?

### Match / Mission Goal
Hundred: meet the stage objective. Endless/Daily: advance as deep as possible and score as high as possible before falling.

### Secondary Goals
- Chains of 3+ kills in one detonation; Perfect Sectors; Purify after a Last Stand.
- Hit par (◆) and flawless (✦) ratings.

### Long-Term Goals
- Clear The Hundred; top the Daily board; unlock all palettes (Depth 100 / 250 / 500).

---

## 6. Game Rules

- **Win:** Hundred stages have explicit objectives (reach the exit row / clear all Standard cubes / survive N ticks). Endless and Daily have no win; you score Depth and Score.
- **Loss:** the run ends when the figure is over a cell with no tile (falls). Causes: shoved off the rear edge by a crushing cube; standing on Glass when it shatters; standing on a crumbling rear row with no free tile ahead to be pushed onto.
- **Draw / Failure / Reset:** Hundred failure → loss replay → instant retry. No lives, no continues.

**Crush:** a cube rolling into the player's cell shoves the player 1 tile backward (−z) with an 18 f stun. If no tile exists there, the player falls. Crushes do nothing else.

**Cube resolution:**
- **Standard** cubes (Stone, Glass, Iron) must be killed. A Standard cube that rolls off the rear edge of player ground → the rear row crumbles immediately.
- **Forbidden** cubes must be let through (rolling off the rear costs nothing). Killing one leaves a **Scar** (permanent hole) in its cell **and** crumbles the rear row.
- **Advantage** cubes leave a **Glyph tile** when killed.

**Crumble:** the rearmost row of player ground falls every **8 ticks** in Sector 1, −1 tick every 3 Sectors, floor **4 ticks**. A 30 f warning glow precedes it. The figure is never crumbled with a tile: it is shoved forward one tile first if possible, else falls.

**Ground economy (anti-hoarding):**
- **Hinterland cap:** ground more than **6 rows behind the player** crumbles automatically, one row per tick, rear first.
- **Weight:** Crumble interval −1 tick per 14 connected tiles behind the player beyond 28 (minimum 3 ticks).
- **Target curve:** a competent player holds 28–49 connected tiles; experts advance faster rather than hoard.

**Beacons:** each Endless/Daily Sector spawns 2–3 Beacons over void cells 6–10 rows ahead of the front edge. Collected by stepping onto the cell (you must build to it). Expire after 16 ticks (dim over the last 4). Reward (seeded random): +1 Glyph · Rune shard (3 shards = extra Rune pick) · ×1.5 score for 8 ticks · Crumble timer reset.

**Perfect Sector:** no Standard escaped and no Forbidden killed → +2,000 and the Crumble timer resets.

**Last Stand:** triggers when connected ground ≤ 14 tiles. For 15 s (900 f): Forbidden cubes are killable and leave Stone tiles, score ×2, grid inverts visually. End it with ≥ 21 connected tiles = **Purify** (+3,000). Max once per Sector.

### Scoring
| Action | Result |
|---|---|
| Stone kill | 100 |
| Glass kill | 80 |
| Iron kill (final hit) | 300 |
| Advantage kill | 200 |
| Phase kill | 400 |
| Skyfall killed on landing | +150 |
| Forbidden let through | 50 |
| Chain of n kills in one detonation/Blast | sum × n |
| Island created (tile not 4-adjacent to ground) | +150 |
| Beacon collected | +500 |
| Perfect Sector | +2,000 |
| Purify | +3,000 |
| Depth | 10 per row of max z reached |

### Important Exceptions
- Marks outside Reach after the player moves remain valid (placed, not tethered).
- A rolling cube's logical cell is its origin for the first 50% of the roll and its destination after; detonation hits the logical cell.
- During Last Stand, Forbidden kills cause no Scar and no crumble.

✚ **Rule budget:** a new player holds **four** rules: kill the pale cubes; let the hollow violet cubes pass; kills become ground; don't fall. Three buttons: Mark, Detonate, Blast. Everything else is unveiled one at a time.

---

## 7. Player Verbs

| Verb | Input | Function | Commitment | Major Interaction |
|---|---|---|---|---|
| Step | Move input | Move 1 tile | 9 f, interruptible by next buffered step | Blocked by void and cubes; islands via 4-adjacency |
| Aim Reach | Mouse / R-stick / tap | Choose target cell within Reach | none | Defaults to the tile directly ahead |
| Mark | Mark input | Place a mark at the cursor cell (ground or void) | 4 f lock | Max 2 active (Rune → 3); re-press removes |
| Detonate | Detonate input | Fire **all** active marks at once | 6 f lock | Kills cubes on marked logical cells; Phase needs both halves marked |
| Blast | Blast input | Trigger the oldest Glyph: 3×3 detonation centered on it | 10 f lock | Every cube caught becomes ground |
| Pause | Pause input | Pause | — | Freezes sim and music |

---

## 8. Controls

### Keyboard / Mouse
| Input | Context | Action |
|---|---|---|
| WASD / Arrows | Play | Step |
| Mouse hover | Play | Aim Reach |
| J / Left click | Play | Mark |
| K / Right click | Play | Detonate |
| L / Space | Play | Blast |
| Esc / P | Any | Pause |

### Gamepad
| Input | Context | Action |
|---|---|---|
| D-pad / L-stick (8-way snapped to 4) | Play | Step |
| R-stick | Play | Aim Reach |
| A | Play | Mark |
| X | Play | Detonate |
| Y | Play | Blast |
| Start | Any | Pause |

### Touch (landscape and portrait)
| Input | Context | Action |
|---|---|---|
| Swipe anywhere | Play | Step (one tile per swipe; hold-swipe repeats) |
| Tap a cell within Reach | Play | Mark (tap again removes) |
| Bottom-right thumb button | Play | Detonate |
| Button above it (shows glyph count) | Play | Blast |
| Two-finger tap | Play | Pause |

Hand split (pad/touch): left hand moves, right hand marks and fires. Touch targets ≥ 48 px. In portrait the camera pulls back 15% so the full grid and Reach are visible.

### Input Philosophy
- **Buffering:** 8 f for all verbs.
- **Simultaneous:** Mark and Detonate are allowed during a Step.
- **Held:** held direction auto-repeats steps after 12 f.
- **Repeated:** Mark on an existing mark removes it.
- **Remapping:** full, per device, in Settings.
- **Analog thresholds:** 0.25 radial deadzone; snap to 4 directions for Step.
- **Controller disconnect / focus loss:** auto-pause with reconnect prompt.
- **Input during transitions:** 12 f guard after any menu opens so a gameplay press can't confirm it; Rune pick accepts only menu navigation.
- **Pause:** freezes sim and music at the current frame; music resumes on the same beat.

---

## 9. Movement Specification

### Base Movement
- **Top speed:** 1 tile per 9 f (13.3 units/s equivalent); grid-stepped
- **Acceleration / Deceleration:** none (stepped); ease-out-cubic within a step, 0.15-unit hop arc
- **Turn behavior:** instant facing change on input
- **Air control:** n/a (except Leap Rune: 2-tile jump over 1 gap, 18 f)
- **Momentum:** none

### Movement Feel
- **Movement should feel:** precise, weighty, a chess piece with intent.
- **Movement should not feel:** floaty, slidey or analog.

### Key Behaviors
- **Starting/stopping:** on input, within one frame.
- **Reversing:** allowed mid-step after frame 5 (snaps back).
- **Running into obstacles:** void or cube → 3 f nudge toward the target + soft thud; no movement.
- **Ledges:** cannot step into void.
- **Raised tiles (Iron):** stepping up/down costs the same 9 f; the figure rises 0.5 units.
- **Falling:** 40 f fall into fog with spin, then loss replay.
- **Shoved:** 12 f slide back, then 18 f stun.

---

## 10. Game Feel Bible

### Mark
- **Fantasy:** drawing a line in stone with light.
- **Startup:** 0 f; the figure's core flares toward the cell.
- **Active moment:** 4 f; an amber sigil etches into the tile or the void lattice with a scan ring.
- **Impact:** soft glass tick pitched to the column.
- **Recovery:** none.
- **Success should feel:** decisive and clean.
- **Failure should feel:** a mark on empty air is quieter; nothing punishes it.
- **Must never feel:** like a cursor click.

### Detonate (hit)
- **Fantasy:** a note landing; ground born where the threat died.
- **Startup:** 0 f.
- **Active moment:** 6 f; the cube flashes white, shards collapse inward then burst outward (24 shards).
- **Impact:** Light tier (§10 Impact Scale); the tile **rises** from the void in 12 f; column-pitched note.
- **Recovery:** 6 f.
- **Success should feel:** inevitable and satisfying.
- **Must never feel:** like popping a balloon.

### Detonate (miss)
- **Impact:** sigil fizzles; muted dead click; no hitstop.
- **Failure should feel:** clearly wasted, not punished.
- **Must never feel:** ambiguous.

### Chain (n ≥ 3)
- **Impact:** Heavy tier; notes stack into a chord; bloom pulse; screen-space ripple.
- **Success should feel:** a chord resolving.
- **Must never feel:** noisy.

### Blast
- **Fantasy:** terraforming a room in one breath.
- **Startup:** 4 f charge glow on the Glyph.
- **Active moment:** 10 f 3×3 shockwave; tiles rise in a staggered 2 f ripple from the center.
- **Impact:** Climax tier; low choir swell.
- **Recovery:** 10 f.
- **Must never feel:** like a generic explosion.

### Forbidden killed
- **Impact:** Heavy tier; violet implosion; dissonant tritone; the cell tears into a Scar; rear row cracks and falls with a sub thud.
- **Failure should feel:** sickening and clear.
- **Must never feel:** random.

### Crush / shove
- **Impact:** Heavy tier; figure skids back.
- **Recovery:** 18 f stun.
- **Failure should feel:** fair and readable.
- **Must never feel:** cheap.

### Crumble
- **Startup:** 30 f warning: rear row glows red and hums, rising in pitch.
- **Impact:** tiles drop left→right 2 f apart into fog; deep stone groan.
- **Should feel:** pressure, not surprise.

### Roll (every tick)
- **Active moment:** 24 f edge-pivot roll (apex √2/2 × tile above the floor), landing exactly on the tick.
- **Impact:** low stone thud, ducked under music.
- **Should feel:** the world's heartbeat.

### Beacon collected
- **Impact:** Light tier + a rising three-note arpeggio; the Beacon's light streams into the figure's core.

### Purify
- **Impact:** Climax tier; major resolution chord; light sweeps across the grid restoring the palette.

### Fall (death)
- **Impact:** the figure's core dims as it falls; all music drops to drone; loss replay begins after 40 f.
- **Must never feel:** abrupt or unexplained.

### ✚ Impact Scale
Hitstop = 3 f + (kills in event − 1), capped at 8 f; Climax events are fixed at 6 f. Shake only on Heavy and Climax.

| Event tier | Examples | Hitstop | Shake | Flash | Audio | Haptic |
|---|---|---|---|---|---|---|
| Light | single kill, Beacon | 3 f | none | cube white flash 2 f | transient + note | 0.2 weak, 60 ms |
| Heavy | chain ≥ 3, Iron kill, Forbidden kill, crush | 4–8 f | 0.2 units, 8 f | bloom pulse | chord / tritone / impact | 0.5–0.7 strong, 120–180 ms |
| Climax | Blast, Purify | 6 f | 0.4 units, 12 f | radial light wave | choir swell / resolution | 0.8 both, 250 ms |

---

## 11. Combat / Interaction Model

### Core Relationship
**Read → position → mark → commit → claim.** The player wins by placing kills where the resulting ground helps the next decision.

### ✚ Counter Matrix
| Threat | Answer | Fails when |
|---|---|---|
| Stone | One detonation | Not marked before it passes |
| Glass | One detonation; step off quickly | You linger on its tile |
| Iron | Three detonations or one Blast | You commit late; it reaches your ground still standing |
| Forbidden | Restraint: let it pass, step aside | You mark it in panic or stand in its lane |
| Skyfall | Step out of the shadow, or pre-mark the cell to kill on landing | You ignore the sky |
| Phase | Mark both halves, detonate once | You only mark one half |

### ✚ Tell Table
| Threat / ability | Windup (min) | Visual tell (shape / motion) | Audio tell | Counterplay |
|---|---|---|---|---|
| Any rolling cube | 1 tick (72 f) | Cell shadow on lattice + next-cell chevron | Roll thud | Mark the next cell |
| Forbidden | Entire approach | **Hollow-cut face**, violet core pulse; a mark on it cracks violet before detonation | Low dissonant hum when marked | Don't detonate; step aside |
| Skyfall | 2 ticks (144 f) | Growing square shadow on the target cell | Rising whistle | Leave the cell or pre-mark it |
| Crumble | 30 f | Rear row red glow | Rising hum | Move forward |
| Phase | Entire approach | Two translucent halves joined by a tether beam | Two-note interval | Mark both halves |
| Glass tile shattering | 2 ticks after stepping off | Cracks spread across the tile | Crackle | Don't return to it |
| Beacon expiring | 4 ticks | Dims and flickers | Fading tone | Build faster or let it go |

✚ **Threat focus rule:** at peak density, cubes more than 4 rows beyond your Reach render at 80% brightness; cells within Reach get full contrast. Only Skyfall shadows and Forbidden cores are never dimmed.

### States
| State | Can Move | Can Act | Vulnerable | Exit |
|---|---|---|---|---|
| Idle | Yes | Yes | Yes | Input |
| Stepping | Buffered | Yes | Yes | 9 f |
| Shoved | No | No | Yes | 12 f slide |
| Stunned | No | Buffered | Yes | 18 f |
| Falling | No | No | — | Loss replay |
| Last Stand | Yes | Yes | Yes | 900 f or fall |

### Timing
| Action | Startup | Active | Recovery | Cooldown |
|---|---|---|---|---|
| Step | 0 | 9 f | 0 | — |
| Mark | 0 | 4 f | 0 | — |
| Detonate | 0 | 6 f | 6 f | — |
| Blast | 4 f | 10 f | 10 f | needs a Glyph |
| Cube roll | — | 24 f | — | 1 tick |

### Hit Resolution
Detonation resolves on the frame pressed against each marked cell's logical occupant. Iron takes 1 damage per detonation tick (max 1 per tick). Phase dies only if both halves are marked in the same detonation. Blast hits every cube in its 3×3 (Iron dies outright). Kills resolve, then tiles spawn, then Scars and crumbles, in that order within the frame. No i-frames; shoves are the only knockback.

---

## 12. Resources

### Ground (connected tiles)
- **Range:** 0 – unbounded (practically 7 × 7 under the hinterland cap)
- **Generated by:** kills (1 tile each; Phase 2)
- **Spent on:** nothing directly; it is life and position
- **Lost by:** Crumble, hinterland cap, escaped Standards, Forbidden kills, Glass shattering
- **Regeneration:** none
- **Purpose:** the life bar and the map. Decision: kill for safety vs. kill for reach.

### Marks
- **Range:** 0–2 active (Third Eye: 3)
- **Generated by:** free; placed at will
- **Spent on:** Detonate (all fire)
- **Purpose:** commitment; placing two marks is a two-part plan.

### Glyphs
- **Range:** 0–3 held (extra are lost)
- **Generated by:** Advantage kills (+1), Beacons (+1), Resonance Rune (+1 per chain ≥ 3)
- **Spent on:** Blast (1)
- **Purpose:** banked terraform; when to spend is the decision.

### Rune shards (Endless/Daily)
- **Generated by:** Beacons. **Spent:** 3 → extra Rune pick at Sector end.

---

## 13. Cube Taxonomy (Units)

### Roster Philosophy
Each cube type teaches exactly one lesson and leaves exactly one kind of tile.

### ✚ Content Unit Definition
A new cube type is exactly: **one kill rule + one tile it leaves + one silhouette + one sound family.** Nothing else changes.

### Readability Rules
✚ **Measurable test:** every cube type is identifiable **in grayscale** by silhouette and surface alone, at **40 px tall** on a phone screen at default zoom. Forbidden is always the only hollow silhouette.

| Cube | First seen | HP | Kill by | Leaves | Silhouette / surface | Lesson |
|---|---|---|---|---|---|---|
| Stone | Hundred 1 | 1 | Detonate / Blast | Ground tile | Solid bevelled block, etched runes | Kills make ground |
| Advantage | Hundred 13 | 1 | Detonate | Glyph tile | Solid block, emerald core through cracks | Plan big terraforms |
| Forbidden | Hundred 11 | — | Must pass | (if killed) Scar + rear crumble | **Hollow-cut face**, obsidian, violet core | Restraint |
| Glass | Hundred 26 | 1 | Detonate / Blast | Glass tile (shatters 2 ticks after you step off it, or after you stand on it 4 ticks) | Translucent, fresnel edges | Ground can be temporary |
| Iron | Hundred 31 | 3 | 3 detonations (separate ticks) or 1 Blast | Raised tile (+0.5 units; +1 Reach while standing on it) | Ribbed gunmetal, rivet pips = HP | Invest for range |
| Skyfall | Hundred 38 | as its type | as its type, or on landing | as its type | Falls from above with a shadow | Watch the sky |
| Phase | Hundred 46 | 1 | Both halves marked, one detonation | 2 ground tiles | Two translucent halves + tether beam | Dual planning |

### The Figure
- **Role:** the player. **Visual identity:** a slim obelisk (0.5 × 1.4 units) with a floating amber core. **Audio identity:** soft step ticks, core hum that brightens with ground.

---

## 14. AI / NPC Design
No adversarial AI; cubes follow deterministic formations. **Bot players** exist for verification and the Daily ghost data path (§33):
- **Novice:** random fair marks, 40% miss rate.
- **Competent:** greedy (mark the nearest Standard's next-tick cell within Reach; never mark Forbidden; step toward the forward-most safe tile).
- **Expert:** greedy + Beacon seeking + Blast timing.
Bots use the same input layer and timings as humans.

---

## 15. Camera

### Default Camera
- **Perspective:** perspective, FOV 50°
- **Position:** 12 units behind and 14 above the player, looking 6 units ahead
- **Tracking:** x at 30% (mostly centered on the grid), z at 100%, critically damped (0.12 s)
- **Forward bias:** look-ahead extends to 10 units when the next formation is > 10 rows away

### Camera Priorities
1. The player's cell and Reach area
2. The next two rows of incoming cubes
3. Beacons and Skyfall shadows ahead

### Special Camera States
| Event | Camera Response |
|---|---|
| Blast | 0.4-unit shake 12 f, slight push-in |
| Last Stand | Pulls up 2 units, inverted grade |
| Chamber | Rises to 22 units, near top-down |
| Turn rotation (Act VI) | Follows the figure over 60 f, horizon stays level |
| Fall | Holds position, watches the figure drop, then the loss replay cuts to a high angle |
| Portrait | Pulls back 15% |

Shake max 0.4 units; Reduced Motion removes it.

---

## 16. Levels / Arenas / World

### Level Design Philosophy
Space is created by the player. Stages and formations are authored as **pressure patterns**, not maps: what arrives, when, and from where.

### Standard Metrics
- **Grid width:** 7 columns (LOCKED)
- **Start slab:** 7 × 4 tiles
- **Spawn distance:** formations enter from fog 12 rows ahead of the front edge
- **Reach:** Chebyshev radius 3 (7 × 7), +1 on Iron tiles
- **Encounter density:** 3–5 formations per Sector; 2–6 rows each

### Formations (Endless/Daily)
Authored as 7-wide row strings in `data/formations.ts`, seed-selected and randomly mirrored, never free-generated:
```
"S.SAS.S"
".FSSF.."
"SSI.ISS"
```
Each formation passes the fairness solver (§19) before spawning.

### Mode-specific spaces
- **The Hundred:** each stage is a JSON file (start ground, scripted formations and Skyfall per tick, objective, par). Act VI stages are built on a six-faced construct.
- **Chambers:** frozen one-shot variants of cleared Hundred puzzle stages.

---

## 17. Progression

### Within-Session Progression (Endless/Daily)
**Runes:** pick 1 of 3 after each Sector.

| Rune | Effect | Stack |
|---|---|---|
| Long Arm | +1 Reach | ×2 |
| Third Eye | +1 max active mark | ×1 |
| Tempered Glass | Glass tiles last +2 ticks | ×2 |
| Slow Earth | Crumble interval +2 ticks | ×2 |
| Sledge | Iron HP −1 | ×1 |
| Leap | Jump 1 gap (2 tiles) | ×1 |
| Absolution | First Forbidden kill each Sector: no Scar, no crumble | ×1 |
| Resonance | Chains of ≥ 3 refund a Glyph | ×1 |
| Wide Blast | Blast becomes 5 × 3 | ×1 |
| Bedrock | Ground you stand on 4+ ticks can't crumble | ×1 |
| Echo Mark | Marks persist 1 tick after detonation | ×1 |
| Last Word | Last Stand lasts 25 s | ×1 |

**Chambers (every 4th Sector):** time frozen; N marks, G glyphs, **one** Detonate. Kill every Standard, kill no Forbidden. Success → 1 of 3 from a Rare-weighted pool (Third Eye, Leap, Absolution, Resonance, Wide Blast, Bedrock) + 2,500. Failure → no penalty, normal Rune pick.

### Permanent Progression
Hundred progress and ratings; Endless unlocks after Act I; Daily unlocks after Act I; each cleared act adds its cubes to Endless bands and its puzzle stages to the Chamber pool; cosmetic palettes at Depth 100 / 250 / 500 (Dawn, Rust, Abyssal).

### Unlock Philosophy
- **Unlocks should provide:** new ideas and new looks.
- **Unlocks should not:** add power outside a run.

### Economy
| Currency | Earned From | Spent On |
|---|---|---|
| Glyphs (in-run) | Advantage kills, Beacons, Resonance | Blast |
| Rune shards (in-run) | Beacons | Extra Rune pick (3) |

---

## 18. Modes

### The Hundred (campaign) — v1: stages 1–80; Finale update: 81–100
- **Players:** 1. **Objective:** per stage. **Length:** 1–4 min per stage.
- **Slow unveiling:** each stage introduces at most one new idea; every idea is shown in isolation before it is combined.

| Act | Stages | Unveils |
|---|---|---|
| I · Ground | 1–10 | Step, Mark, Detonate, kills make ground, void marks, islands |
| II · Restraint | 11–25 | Forbidden, Scars, Crumble, Advantage + Blast |
| III · Material | 26–45 | Glass, Iron + raised Reach, Skyfall |
| IV · Phase | 46–65 | Phase cubes, multi-mark timing, Last Stand |
| V · Mastery | 66–80 | Combinations, par-tight stages |
| VI · The Turn | 81–100 | The construct rotates 90° between ticks over 60 f; play continues on another face; ground on one face can become a wall or ledge on the next; stage 100 uses all six faces. Cubes on the departing face fall into the void (no penalty). |

- **Rating:** ◇ cleared · ◆ within par marks · ✦ within par and no Forbidden killed. Par is solver-derived.
- **Unlocks:** sequential; 3 skips available at any time.

### Endless — v1
- **Objective:** Depth + Score. **Length:** 15–25 min. Unlocks after Act I.
- **Differences:** procedural Sectors, Runes, Beacons, Chambers every 4th Sector.

### Daily Tessera — v1
- One shared seed per UTC day; same formations, Beacons and Rune offers for everyone.
- One ranked attempt; unlimited unranked practice after.
- Results share card: a PNG of your path's silhouette across the void (every map is different) with Depth and Score.
- Global and friends leaderboards.

### YouTube Playables build — v1
Endless + Daily only, touch-first, behind the platform module.

---

## 19. Difficulty

### Philosophy
- **Difficulty should test:** planning under time pressure; spatial reading; restraint.
- **It should not require:** twitch aim, rhythm accuracy, memorizing random layouts, or more than 2 simultaneous inputs.

### Difficulty Variables
Tick length (to the 54 f floor), Crumble interval, formation depth and gap, cube mix, Skyfall count, Phase count.

### Speed
tick = max(54, 72 − 2 × (Sector − 1)) frames (floor at Sector 10). Music BPM = 7200 / tick. Beyond Sector 10, difficulty rises only through complexity: +1 Skyfall per formation every 3 Sectors (max 4), band 10+ mix.

### Cube mix by Sector band (Endless/Daily)
| Sectors | Stone | Glass | Iron | Adv | Forbidden | Phase | Formation rows | Gap between formations (ticks) |
|---|---|---|---|---|---|---|---|---|
| 1–2 | 70 | 0 | 0 | 15 | 15 | 0 | 2–3 | 6 |
| 3–5 | 45 | 15 | 10 | 12 | 18 | 0 | 3–4 | 5 |
| 6–9 | 35 | 15 | 12 | 10 | 20 | 8 | 3–5 | 4 |
| 10+ | 30 | 15 | 14 | 9 | 22 | 10 | 4–6 | 3 |

### ✚ Pacing Curve (Endless)
| Time | Active cube cap | Spawn cadence | New threats introduced | Player should be learning |
|---|---|---|---|---|
| 0:00–1:00 | 12 | 1 formation per ~8 ticks | none beyond unlocked | Find the rhythm of build-and-advance |
| 1:00–5:00 | 20 | per band | Glass/Iron if unlocked | Route toward Beacons |
| 5:00–12:00 | 28 | per band | Skyfall, Phase | Plan two formations ahead |
| 12:00+ | 35 | per band, tick at floor | complexity only | Rune synergies, Blast economy |
| Last Stand | unchanged | unchanged | Forbidden become killable | Comeback |

✚ **Spawn rules:** cubes enter **only** from the fog 12 rows ahead of the front edge, fading in over 1 tick. Nothing appears on or adjacent to the player except Skyfall, which is telegraphed 2 ticks ahead. Hard cap 35 live cubes.

✚ **Formation fairness (Design Law 5):** before spawning, a fast solver checks the formation against current ground, Reach and marks: at least one plan must kill every Standard, kill no Forbidden and keep the player on ground. Fail → mirror/reroll (max 8) → fall back to a known-fair formation from the same band.

---

## 20. UX Flow

### Master Flow
```
BOOT
 ↓
TITLE ("Press any key" — unlocks audio)
 ↓  (first launch → THE HUNDRED stage 1 directly)
MAIN MENU: The Hundred · Endless* · Daily* · Settings · Credits   (*after Act I; Resume appears if a run was suspended)
 ↓
THE HUNDRED: act/stage select → stage → rating → next / retry / select
ENDLESS / DAILY: run (Sector ⇄ Rune pick, Chamber every 4th) → fall → loss replay → RESULTS
 ├─ RETRY (1 press, instant)
 └─ MENU
```
Built on the Web Shell flow; differences: first launch skips the menu; loss replay sits between gameplay and results.

### Edge Cases
- **Controller disconnect / focus loss / tab hidden:** auto-pause.
- **App switch / page killed (mobile):** run auto-serializes (seed + input log + tick index); Title offers **Resume**; re-simulation restores the exact state.
- **Quit / restart:** confirm from pause.
- **Failed load / corrupted save:** fall back to defaults, keep a backup copy, show a quiet notice.
- **No input device:** touch fallback.
- **Offline:** play fully; leaderboard submissions queue.

---

## 21. UI / HUD

### Information Hierarchy
1. Where I stand and what I can reach
2. What arrives next (cells, shadows)
3. My marks and glyphs
4. Score / Depth

### HUD Elements
| Element | Purpose | Location | Visibility |
|---|---|---|---|
| Marks | Active marks | Sigils on cells + 2 pips under the figure | Always |
| Glyphs | Blast charges | Small glyphs orbiting the figure | When ≥ 1 |
| Crumble | Timer | Rear row glow + hum | Last 30 f |
| Score | Score | Faintly etched into the fog plane above the horizon | Always, pulses on gain |
| Sector · Depth | Progress | Small top-left monospace | Endless/Daily |
| Runes | Build | Icons bottom-left | Always (tooltips on pause) |
| Touch buttons | Detonate, Blast | Bottom-right | Touch only |

✚ **HUD budget:** marks, glyphs, score, Sector·Depth, Rune icons, touch buttons. **Nothing else.**

### UI Style
- **Shape language:** thin etched lines, squares, no rounded pills
- **Typography:** JetBrains Mono (numerals); Cinzel or similar engraved serif (titles)
- **Motion:** slow fades, 12 f eases; menus rise like tiles
- **Sound:** glass ticks
- **Menu philosophy:** minimal, one decision per screen

### ✚ Glossary
| Term | Meaning |
|---|---|
| Tile | One cell of walkable ground |
| Ground | All tiles you can stand on |
| Island | A tile or group not connected to your ground |
| Reach | Cells you can mark (radius 3) |
| Mark | Amber sigil placed on a cell |
| Detonate | Fire all marks |
| Glyph | Stored Blast charge from an Advantage kill |
| Blast | 3 × 3 detonation from a Glyph |
| Tick | One roll step |
| Crumble | The rear row falling away |
| Scar | Permanent hole left by killing a Forbidden cube |
| Beacon | Reward light hovering over the void ahead |
| Sector | One Endless wave set |
| Rune | Run upgrade |
| Chamber | Frozen one-shot puzzle |
| Last Stand | Inversion when your ground is nearly gone |
| Purify | Surviving Last Stand with ground restored |
| The Hundred | 100-stage campaign |
| The Turn | Act VI; the construct rotates |

### ✚ Callouts & Copy
Callouts are spoken by the announcer (calm, warm, never a judge) and shown as faint subtitles only: "Tessera." (title) · "Beautiful." (Perfect Sector) · "Hold on." (Last Stand) · "Purified." · "Again." (after a fall). No other in-run text. Tone rules: short, kind, no exclamation marks, no scolding.

---

## 22. Tutorial / Onboarding

### Player Should Learn
Within 60 seconds (Hundred stages 1–3): 1. kills make ground; 2. marks can be placed over the void; 3. the ground behind you falls away.

### Teaching Order (The Hundred, stages 1–3 — the First 60 Seconds)
1. **0–3 s:** black; one drone; TESSERA fades in, etched; "Press any key".
2. **3–6 s:** camera descends to the figure on a 7 × 4 slab over endless fog; a soft kick begins.
3. **6–15 s:** one Stone cube rolls toward the figure's column. A ghost amber sigil pulses on the tile 2 ahead with the Mark glyph. Player marks; cube arrives; Detonate glyph pulses; player detonates → the cube's cell becomes a tile, extending the slab.
4. **15–25 s:** two Stone cubes, one 2 tiles into the void. A ghost sigil appears **over the void**; detonate → island.
5. **25–35 s:** one cube between slab and island; killing it bridges them. The player steps onto the island.
6. **35–45 s:** the rear row glows and crumbles. No text.
7. **45–60 s:** stage 3 ends at an exit row of light; the player walks into it. Rating appears.

Forbidden (stage 11) and Advantage/Blast (stage 13) are taught the same way in Act II.

**Prompt retirement:** ghost sigils appear until each verb has succeeded twice, then never again; after that, only hint sigils appear, and only after 3 repeated failures. Onboarding ends with stage 10, a full small crossing using everything from Act I.

**The game cares:** loss replay (3 s slow-motion high-angle replay with the cause highlighted, skippable); hint sigils (after 3 repeats of the same failure, one faint ghost sigil on a useful cell; toggleable); results lead with something done well before the score; first Hundred stages have no failure state for their first 10 s.

---

## 23. Visual Direction

### Visual Thesis
Brutalist monoliths drifting through infinite fog. Concrete, light and silence. The only warm things in the universe are the ground you've made and the amber of your intent.

### Character Art (the figure)
- **Proportions:** slim obelisk 0.5 × 1.4 units
- **Shape language:** vertical, sharp
- **Detail density:** minimal; one floating core
- **Materials:** pale matte stone body, emissive amber core
- **Silhouette:** the only vertical shape on the grid

### Environment Art
- **Geometry:** bevelled boxes (bevel 0.06 units), ≤ 500 tris per type, instanced
- **Texture density:** procedural etched runes (512² canvas textures, seeded per type)
- **Lighting:** one directional key + hemisphere fill; PCF soft shadows
- **Color (LOCKED discipline):**
  - Void #050608, exponential fog
  - Player ground: warm grey concrete #3a3632 with amber seams that brighten with age
  - Stone #9a948c · Glass #7fd8e8 (translucent) · Iron #2b2e33 · Advantage core #2fd38a · Forbidden obsidian with violet core #8b5cf6
  - Marks amber #ffb347 · Scars violet-black rifts
- **Atmosphere:** fog, drifting dust motes, distant monolith silhouettes

✚ **Value contrast rule:** the void is the darkest value; threats are cool and mid-value; everything the player owns is warm and the brightest value on screen. The figure's core is always the single brightest point.

### Void Readability (LOCKED)
- **Lattice:** a faint cool-grey grid (opacity 0.12, rising to 0.3 within Reach) over the void across the threat zone, aligned to cells.
- **Cell shadows:** every cube projects a crisp square shadow onto its logical cell, independent of lighting.
- **Reach glow:** cells within Reach have a soft warm rim; the cursor cell has a solid amber outline.
- **Next-cell chevron:** shows where a cube will be next tick when the cursor is on that cell.

### Rendering
✚ **Recipe:** Three.js MeshStandardMaterial (PBR, roughness 0.6–0.9 for stone, 0.1 for Glass with fresnel); one directional key light (warm-neutral, from upper left) + hemisphere fill (cool); PCF soft shadows 2048 (mobile 1024); exponential fog; UnrealBloom on emissives only (threshold 0.85, mobile half-res); ACES tonemapping; subtle vignette; no depth of field, no motion blur. Instanced meshes for tiles and cubes.

### ✚ Asset Pipeline
All visuals are **procedural and final**: primitives + materials + procedural canvas textures generated at boot and cached. No Meshy, no rigging. Fonts are open-license WOFF2. `assets/manifest.ts` maps keys → files or `synth:` presets; a dropped file overrides with no code change.

### Visual Anti-Targets
- neon cyberpunk glow everywhere
- cute or toy-like cubes
- busy textures or noisy particles at peak density
- warm colors on threats

---

## 24. Animation Direction

### Animation Philosophy
1. gameplay readability 2. responsiveness 3. weight 4. personality

### Style
- **Pose exaggeration:** low; the figure leans into steps
- **Anticipation:** core flare on Mark, glow on Blast charge
- **Follow-through:** tile rise overshoots 5% and settles
- **Holds:** hitstop per Impact Scale
- **Cancel behavior:** steps reversible after frame 5

### Required Animation Set
Figure: idle hover, step lean, blocked nudge, mark gesture, shove skid, stun wobble, fall spin, Purify rise. Cubes: edge-pivot roll, Skyfall drop + land squash, Phase shimmer, shatter. Tiles: rise, crumble drop, Glass crack, Scar tear.

---

## 25. VFX Direction

### VFX Philosophy
Effects communicate state, impact, direction, importance and reward. Gameplay information always outranks spectacle.

### Effect Families
- **Impact:** shard burst per cube color
- **Creation:** tile rise from the void with amber seam ignition
- **Heavy:** chain ripple, bloom pulse
- **Climax:** Blast shockwave with staggered tile ripple; Purify light sweep
- **Threat:** Forbidden violet implosion, Scar tear; Skyfall shadow growth; crumble drop + dust
- **Reward:** Beacon light stream into the core
- **Critical state:** Last Stand inversion (palette swap + chromatic aberration 0.003)
- **Environment:** fog drift, dust motes

✚ **Signature effect:** the **Blast terraform**: a 3 × 3 wave of monoliths shattering and rising back as warm ground in a 2 f ripple. It must read in a silent 3-second clip. **Reduce Flashes alternative:** no bloom pulse, no radial light wave; tiles still ripple.

---

## 26. Audio Direction

### Audio Thesis
The grid is the score, but the score never grades you. Kills are notes, chains are chords; good play sounds good.

### Music
- **Genres:** dark ambient, neo-classical strings, minimal electronic pulse
- **Energy curve and adaptive behavior:**

| State | Layers |
|---|---|
| Title | Drone + distant bell |
| Early (Sector / stage) | Kick, drone, sparse pads |
| Mid (formation 3+) | + bass, + hats |
| Ground ≤ 4 rows | + tension strings; pad low-pass opens |
| Last Stand | Reversed pads, double-time hats, distortion |
| Purify | Major resolution chord; layers reset |
| Chamber | Time frozen: solo cello + drone, no kick |
| Results | Drone + the run's best chain replayed as a chord |

✚ **Escalation driver:** the tick (music tempo BPM = 7200 / tick) and ground state, never wall-clock time. Separate music and SFX buses.

### SFX
✚ **Distinct timbre rule:** every event has its own sound; no shared generic alert.

| Category | Cue sheet |
|---|---|
| Roll | Low stone thud on every tick (ducked) |
| Mark | Glass tick pitched by column; mark removed: reverse tick |
| Kill | Column → D Dorian degree (cols 0–6 = D E F G A B C); octave by type (Glass high, Stone mid, Iron low). **Two layers:** instant transient (0 ms) + tonal note quantized to the next 16th. Max 4 tonal voices per 16th; extra kills thicken the chord. |
| Iron hit (non-lethal) | Metallic clank |
| Miss | Muted dead click |
| Blast | Charge shimmer → choir swell + sub |
| Forbidden kill | Tritone + rift tear |
| Skyfall | Rising whistle → impact |
| Crush | Heavy impact + skid |
| Crumble | Rising hum → stone groan |
| Beacon | Rising three-note arpeggio |
| Glass tile | Crackle → shatter |
| Fall | Core dims to silence; drone |
| UI | Glass ticks, low confirm tone |

### Voice
Announcer only: calm, warm synthetic voice; ≤ 1 line per 20 s; never interrupts another line; subtitles optional. **Source:** ElevenLabs (placeholder via manifest until recorded). Lines in §21.

### ✚ Mix
Target −14 LUFS. Kill notes always above music. Rolls duck −6 dB under kill notes. Music ducks 4 dB for 500 ms on Climax events. Announcer ducks everything −8 dB.

---

## 27. Haptics
| Event | Intensity | Duration | Pattern |
|---|---|---|---|
| Kill | 0.2 weak | 60 ms | single |
| Chain ≥ 3 | 0.5 strong | 120 ms | single |
| Blast | 0.8 both | 250 ms | ramp down |
| Crush | 0.7 strong | 180 ms | single |
| Crumble | 0.3 weak | 400 ms | ramp up |
Mobile: Vibration API equivalents where supported; off by default on web mobile, on in native wrappers.

---

## 28. Content Matrix

### Cubes
| Cube | Mesh/material | Animation | FX | Audio | UI | Complete |
|---|---|---|---|---|---|---|
| Stone | ✓ | roll | grey shards, tile rise | thud, mid note | — | ☐ |
| Glass | ✓ | roll | cyan shards, cracking tile | high note, crackle | crack overlay | ☐ |
| Iron | ✓ | roll (deeper thud) | sparks per hit, dark shards | clank, low note | rivet HP pips | ☐ |
| Advantage | ✓ | roll | emerald burst, glyph etch | note + bell | glyph orbit | ☐ |
| Forbidden | ✓ | roll | violet implosion, Scar | tritone | violet mark warning | ☐ |
| Skyfall | ✓ | drop + land squash | shadow decal, dust ring | whistle, impact | — | ☐ |
| Phase | ✓ (two halves) | roll + shimmer | dual burst, bridge | two-note interval | tether beam | ☐ |
| Figure | ✓ | full set §24 | core flare, fall | steps, shove, fall | mark pips | ☐ |
| Tiles: ground / island / raised / glyph / glass / scar | ✓ | rise, crumble | seams, dust | groan | crumble glow | ☐ |
| Beacon | ✓ | hover, dim | light stream | arpeggio | — | ☐ |

### Levels
| Level | Layout | Gameplay | Art | Lighting | Audio | Complete |
|---|---|---|---|---|---|---|
| The Hundred 1–80 (v1) | ☐ | ☐ solver-verified | procedural | ☐ | ☐ | ☐ |
| The Hundred 81–100 (Finale) | ☐ | ☐ | ☐ construct faces | ☐ | ☐ | ☐ |
| Endless formations ≥ 40 | ☐ | ☐ fairness-checked | — | — | — | ☐ |

### UI
| Screen | Layout | Art | Navigation | Audio | Complete |
|---|---|---|---|---|---|
| Title | ☐ | ☐ | ☐ | ☐ | ☐ |
| Main menu (+ Resume) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Hundred act/stage select | ☐ | ☐ | ☐ | ☐ | ☐ |
| Rune pick | ☐ | ☐ | ☐ | ☐ | ☐ |
| Pause | ☐ | ☐ | ☐ | ☐ | ☐ |
| Settings (remap, accessibility, audio) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Results (+ share card) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Leaderboards | ☐ | ☐ | ☐ | ☐ | ☐ |
| Chambers library | ☐ | ☐ | ☐ | ☐ | ☐ |

### Additional Content
12 Runes; 3 palettes (Dawn, Rust, Abyssal); 5 announcer lines; 8 music layers.

---

## 29. Technical Design

### 29.1 Technology
- **Engine:** none; web stack (stays on web per `slu-engine-decision`)
- **Language:** TypeScript (strict)
- **Renderer:** Three.js (latest stable)
- **Physics:** none; grid sim
- **Audio:** Web Audio via the shell's audio core; lookahead scheduler driven by the sim clock
- **Networking:** Supabase (leaderboards, replay validation edge function)
- **Persistence:** localStorage via the shell save module
- **Build/test:** Vite, Vitest, ESLint, Playwright
- **Deploy:** Vercel (web); Tauri (Steam); Capacitor (iOS/Android); YouTube Playables SDK

### ✚ 29.2 Foundation & Reuse
**Base:** Shell-generated.
```bash
node tools/create-slu-game.mjs --id tessera --name "Tessera" --renderer three --frames <title,menu,pause,settings,results>
```
**Shell Frames:** use the shell's title, menu, pause, settings and results frames (confirm exact frame names from the shell's `create-slu-game.mjs --help`; log in DECISIONS.md). **Shell modules:** fixed-step loop, input (keyboard/gamepad/touch/remap), pause/focus, save, audio core, dev panel, scene shell, Look Kit (bloom/tonemap/tuning panel) if present in v1.3.

**Systems to lift.** Port the design and data model, rebuild the integration. Never copy a donor file without reading it.

| System | Donor → path | Keep | Change |
|---|---|---|---|
| Shell runtime | `Web-Game-Shell-v1.02` (canonical branch; v1.3 if landed) | everything listed above | — |
| Leaderboard / Supabase pattern | any existing SLU Supabase integration in the reuse map, else new | anonymous ids, offline queue | add replay validation |
| Edge-pivot roll kinematics | Gemini MONOLITH 3D prototype (idea only) | math: rotate about the leading bottom edge, apex √2/2 × tile | re-derive and unit-test; do not copy code |

**Do not reuse:** Kimi's Gridfall prototype code or Gemini's MONOLITH / Topological Wave Survivor code (the latter froze from mutating arrays during iteration).

**Contributes back** (built generic, Tessera as first consumer, upstreamed to @slu/web-shell after ship):
- Deterministic replay recorder + re-simulation validator
- Daily seed service + leaderboard client (Supabase)
- Suspend/resume via seed + input log
- Grid puzzle solver harness + in-game stage editor pattern
- Quantized musical SFX scheduler (transient + quantized tone)

### 29.3 Architecture Principles
1. Gameplay simulation independent from rendering (fixed 60 Hz step; render interpolates).
2. One source of truth for mutable state (§30).
3. Data-driven tuning (§31).
4. Events drive presentation (`Kill`, `Chain`, `TileRise`, `Crumble`, `Crush`, `ScarTorn`, `Beacon`, `LastStand`, `Purify`, `Fall`).
5. Inputs abstracted from devices (shell input).
6. Fixed timestep, fully deterministic from (seed, input log).
7. Systems testable without rendering.
8. Seeded RNG only inside the sim; `Math.random()` for cosmetics only.
9. One file per system, reachable from the import graph; no runtime monkey-patching.
10. Procedural art and synthesized audio are final unless overridden via the manifest.
11. Dev hook `window.__GAME` exposes state and controls (§32).
12. **Never mutate an array while iterating it** (collect removals; pools with alive flags).

Folder map:
```
src/
  main.ts
  data/      tuning.ts formations.ts runes.ts palette.ts audio.ts hundred/NNN.json hundred/index.ts
  sim/       Clock Grid Cubes Player Marks Resolve Crumble Economy Beacons Score Run Fairness Rng Events Replay
  render/    three/Scene Camera Tiles Cubes Figure Lattice Vfx Post
  audio/     Music Sfx Announcer manifest
  ui/        Title Menu Hud RunePick Pause Settings Results Leaderboards Chambers Hundred
  online/    supabase leaderboards daily validate
  platform/  web tauri capacitor playables
  dev/       gameApi bot editor solver
tests/
```

---

## 30. Source-of-Truth Rules
| Data | Owner |
|---|---|
| Tick / beat clock | `sim/Clock` (music follows, never the reverse) |
| Tiles (type, state) | `sim/Grid` |
| Cubes (cell, roll phase, HP) | `sim/Cubes` |
| Player cell, stun, facing | `sim/Player` |
| Marks | `sim/Marks` |
| Glyphs, shards | `sim/Run` |
| Score, depth, chain | `sim/Score` |
| Runes owned | `sim/Run` |
| Gameplay numbers | `data/tuning.ts` |
| Stages | `data/hundred/` |
| Save data | shell save module |
| UI state | screen controllers |

---

## 31. Tuning
Numbers are provisional unless marked **LOCKED**.

### ✚ Tuning Table
| Group | Name | Value | Status | Why / reference |
|---|---|---|---|---|
| Grid | columns | 7 | LOCKED | IQ-like width; fits phone portrait |
| Clock | tick (default) | 72 f | provisional | ~IQ cadence; 100 BPM music |
| Clock | tick floor | 54 f | LOCKED | Design Law 3: thinking time |
| Clock | roll duration | 24 f | provisional | weighty but leaves ⅔ of the tick to read |
| Clock | tick decrement | 2 f per Sector | provisional | floor at Sector 10 |
| Movement | step | 9 f | provisional | snappy chess-piece feel |
| Movement | auto-repeat delay | 12 f | provisional | — |
| Input | buffer | 8 f | provisional | forgiving under pressure |
| Reach | radius | 3 (Chebyshev) | provisional | 7 × 7 covers the grid width |
| Reach | Iron bonus | +1 | provisional | range advantage from high ground |
| Marks | max active | 2 | provisional | two-part plans; Phase needs 2 |
| Glyphs | max held | 3 | provisional | spend, don't hoard |
| Crumble | start interval | 8 ticks | provisional | pressure without panic |
| Crumble | floor | 4 ticks | provisional | — |
| Economy | hinterland cap | 6 rows | provisional | no hoarding behind |
| Economy | weight | −1 tick per 14 tiles beyond 28 | provisional | sprawl tax |
| Beacons | per Sector | 2–3 | provisional | forward pull |
| Beacons | distance | 6–10 rows ahead | provisional | requires deliberate building |
| Beacons | lifetime | 16 ticks | provisional | — |
| Glass | shatter after leaving | 2 ticks | provisional | — |
| Iron | HP | 3 | provisional | — |
| Skyfall | telegraph | 2 ticks | LOCKED | Design Law 2 |
| Last Stand | trigger | ≤ 14 tiles | provisional | ~2 rows |
| Last Stand | duration | 900 f | provisional | — |
| Last Stand | Purify threshold | ≥ 21 tiles | provisional | 3 rows |
| Crush | stun | 18 f | provisional | — |
| Camera | offset | 12 back / 14 up / 6 ahead | provisional | — |
| Spawn | distance | 12 rows | provisional | — |
| Spawn | live cube cap | 35 | provisional | readability + perf |

---

## 32. Debug / Development Tools
- `window.__GAME`: `seed(n)`, `setSector(n)`, `loadStage(n)`, `spawnFormation(str)`, `giveRune(id)`, `godMode(bool)`, `state()`, `stateHash()`, `stepFrames(n)`, `bot.start(level)`, `editor()`.
- ✚ **URL flags:** `?stage=NNN` · `?sector=N` · `?seed=N` · `?quick` (skip title) · `?daily=YYYY-MM-DD` · `?playtest` (telemetry overlay) · `?headless` (setTimeout step mode for browsers that never fire `requestAnimationFrame`).
- In-game **stage editor** (paint ground, place formations/Skyfall per tick, set objective, save JSON).
- **Solver** (search mark/detonate/step plans → solvable + par); also powers Endless fairness.
- Overlays: logical cells, tick counter, fairness result, economy graph, FPS/frametime.

---

## 33. Telemetry / Playtest Metrics
| Metric | Target |
|---|---|
| Time to first island (new player) | ≤ 30 s |
| Connected ground, competent bot | 28–49 tiles steady state |
| Beacons collected per Sector (competent) | 1–2 |
| Act I completion rate | ≥ 80% |
| Retry within 5 s of a fall | ≥ 70% of sessions |
| Deaths attributed correctly by testers | 5/5 |
| Daily return rate (D1) | ≥ 30% |

✚ **Balance harness:**
- **Economy sweep:** novice / competent / expert bots × 5 seeds × 15 Sectors → ground over time, Beacons, Sectors survived; tune to the table above; log in `TUNING_LOG.md`.
- **Fairness soak:** 10,000 generated formations across bands → zero unwinnable spawns.
- **Hundred solvability:** every stage solvable; par recorded in `tests/hundred.report.md`.

---

## 34. Playtest Questions
- **Comprehension:** Did players understand that kills become ground? That they could mark the void? How quickly?
- **Decision-Making:** Were they choosing *where* to kill, or just killing? Did Beacons pull them forward? Was any strategy dominant (e.g. hanging back)?
- **Feel:** Does a Blast feel like terraforming? Does the roll feel weighty? Anything unfair?
- **Readability:** Could they tell which cell a cube was on? Did they understand every death?
- **Motivation:** What made them retry? Where did interest drop?

---

## 35. Accessibility
- Full remapping per device; hold/toggle not needed (no held verbs)
- Colorblind-safe by design (silhouette coding, §13); optional high-contrast outline mode
- Reduced Motion: removes shake, aberration, camera push; gentler tile rise. **Removes movement, never information.**
- Reduce Flashes (§25)
- Volume sliders: music, SFX, voice; subtitles for announcer lines
- Assist speed: tick +15% (scores flagged); hint sigils toggle
- UI scale 100 / 125 / 150%

---

## 36. Performance Targets

### Target Hardware
- **Desktop:** 2019 16" MacBook Pro (Intel i9, AMD Radeon Pro 5300M), Chrome
- **Mobile:** iPhone 13 / Pixel 7 class, Safari / Chrome

### Targets
- **FPS:** 60 locked (both)
- **Resolution:** native up to 1440p desktop; device-pixel-ratio capped at 2 on mobile
- **Frame time:** ≤ 8 ms desktop, ≤ 14 ms mobile
- **Sim step:** ≤ 1 ms; fairness solver ≤ 4 ms per formation (amortized across frames)
- **Load time:** ≤ 3 s desktop, ≤ 5 s mobile on 4G
- **Initial load:** ≤ 5 MB
- **Memory:** ≤ 200 MB heap
- **Draw calls:** ≤ 150 (instancing)

---

## 37. Save / Persistence
- **What:** Hundred progress + ratings, best Depth/Score, palettes, settings, pending leaderboard submissions, suspended run (seed + input log + tick index).
- **When:** on stage clear, run end, settings change, and `visibilitychange`/`pagehide`.
- **Slots:** one profile.
- **Cloud:** leaderboard data only (Supabase); native wrappers may add platform cloud saves later.
- **Corruption fallback:** keep previous save as backup; restore defaults if both fail.
- **Version migration:** versioned schema with migration functions.
- **Reset:** Settings → Reset progress (double confirm).

---

## 38. Multiplayer / Networking
Single player. Online features only:
- **Leaderboards:** Supabase tables `players` (anonymous id + display name), `runs` (mode, seed, score, depth, input log, build version), leaderboard views.
- **Replay validation:** an edge function re-simulates each submitted input log with the same build version and accepts only matching score/depth.
- Boards: Daily (global/friends), Endless all-time, per-Hundred-stage best.
- Offline-first queue.

---

## 39. Production Scope

### Must Ship (v1)
The Hundred stages 1–80; Endless; Daily Tessera with leaderboards and replay validation; all cube types; Runes; Chambers; Beacons; ground economy; fairness solver; touch/pad/KBM; suspend/resume; loss replay and hint sigils; full presentation (§23–27); web deploy.

### Should Ship (v1)
Steam (Tauri) and iOS/Android (Capacitor) premium builds; YouTube Playables build; share card; palettes.

### Nice to Have
Friends leaderboards; Michael's own music stems via the manifest.

### Post-Launch (Finale update)
The Hundred Act VI · The Turn (stages 81–100). Prototyped in Phase 0/1 to retire risk early.

---

## 40. Build Order
Build continuously; every milestone leaves the game playable. Commit after each proven step.

### ✚ Phase 0 — Thesis Proof
One Sector on a 7 × 4 slab: Stone, Forbidden and Advantage cubes; Step, Reach cursor, Mark (ground + void), Detonate, Blast; kills become ground; void lattice, cell shadows, Reach glow; Crumble; one Beacon; camera follow; Game Feel Bible values for Mark/Detonate/Blast; kill notes. Plus **one Turn prototype stage** (construct rotates 90° mid-stage) to retire camera/readability risk.
- **Exit condition:** in a running build, a scripted run kills a cube over the void, builds an island, bridges it, reaches the Beacon and survives the Crumble; screenshots and a capture of a Blast terraform and a Turn rotation; 60 fps sampled. Values recorded in `TUNING_LOG.md`.

### Phase 1 — Foundation
Shell-generated repo, Three adapter, sim/render/audio architecture per §29.3, data files, `window.__GAME`, URL flags, gate command, Vercel deploy, Supabase project.
- **Exit condition:** `npm run gates` green; live URL loads to Title with zero console errors.

### Phase 2 — Core Playable
Full rules (§6): Crush, escapes, Scars, Glyphs, islands + adjacency, ground economy, Beacons, Sector flow, fall → loss replay → Results → instant retry; Hundred stages 1–3 as the First 60 Seconds; first launch routing.
- **Exit condition:** E2E smoke (title → play → results → play again) passes; competent bot survives 3 Sectors; novice bot falls.

### Phase 3 — Depth
Glass, Iron (raised Reach), Skyfall, Phase; Last Stand / Purify; Perfect Sector; speed ramp; Runes + pick; Chambers; fairness solver; hint sigils; touch controls; suspend/resume; Daily seed; leaderboards + replay validation.
- **Exit condition:** targeted tests per cube/Rune; fairness soak passes; tampered replay rejected; kill-page-and-resume state hash matches.

### Phase 4 — Content
Stage editor + solver; The Hundred stages 1–80 per §18; ≥ 40 Endless formations by band.
- **Exit condition:** `tests/hundred.report.md` shows every stage solvable with par; economy sweep within targets.

### Phase 5 — Presentation
Full §23–27: palette, materials, procedural textures, post stack, all VFX families, figure animation set, adaptive music layers, quantized kill notes, announcer, haptics, diegetic HUD, all screens styled, share card.
- **Exit condition:** screenshot set of every screen and state; five-second clip test passes.

### Phase 6 — Polish
Settings (remap, accessibility), save migration, palettes, perf pass on desktop and mobile emulation, mobile layout (portrait/landscape).
- **Exit condition:** §36 targets met (or shortfalls logged with numbers).

### Phase 7 — Release Candidate
Production builds; Tauri and Capacitor wrappers; Playables build; credits; icons; store metadata drafts.
- **Exit condition:** §42 checklist complete; live URL loaded and played end-to-end.

---

## 41. Verification
Every milestone verifies: builds, no runtime errors, flow completes, state valid, targeted tests, perf inside target, input works, save valid.

### ✚ Gate Command
`npm run gates` = typecheck + lint + unit tests + invariant tests + headless boot (Playwright: Title reached, zero console errors) + E2E smoke. Run before every commit.

### ✚ End-to-End Smoke Test
Playwright drives the real build: Title → Hundred stage 1 (scripted inputs) → clear → Endless (via `?quick&sector=1`) → bot to a fall → loss replay → Results → Retry → playing again. Also on mobile emulation (iPhone 13, Pixel 7) with touch inputs.

### Automated Tests
- Roll kinematics: cube never intersects the floor; lands exactly on its cell.
- Invariants every frame in test builds: player on a tile or in Fall; no two cubes share a logical cell; no tile and Scar on the same cell; marks ≤ max; score equals the sum of logged events; Sectors terminate; entities within grid x bounds.
- Determinism: same seed + input log → identical state hash (3 seeds).
- Save round-trip and migration.
- Replay validation accepts honest logs, rejects tampered ones.
- Suspend/resume state hash matches.
- Fairness soak and Hundred solvability (§33).

✚ **Acceptance rule:** a feature is done only when proven in a running build with a screenshot, replay or test as evidence. A deploy is not done until its live URL has been loaded and played.

---

## 42. Definition of Done

### Gameplay
- [ ] Core loop complete; every promised mechanic works (§39 Must Ship)
- [ ] No dominant unintended strategy (hanging back, hoarding) per economy sweep
- [ ] Difficulty behaves as designed (§19)

### Content
- [ ] All cube types, 12 Runes, Hundred 1–80, ≥ 40 formations

### Presentation
- [ ] Procedural visuals at §23 recipe; animation set; VFX families; adaptive music; announcer; no unintended placeholders

### UX
- [ ] Start-to-finish flow; every screen navigable; pause; settings persist; failure states handled; KBM, pad and touch work

### Stability
- [ ] No blocker bugs; no recurring console errors; 30-min bot soak passes; saves survive restart; §36 targets met

### Release
- [ ] Production build; correct title/version; icons; credits; store/platform configuration; release notes
- [ ] ✚ Name cleared ("Tessera": trademark, Steam and app store search)

---

## 43. Definition of Great
1. A new player builds their first island within 30 seconds without reading text.
2. Players can say what killed them every time (5/5 in playtest).
3. Two players' paths across the same Daily void look visibly different.
4. With audio on, a skilled run is recognizably musical; testers hum the chain chords.
5. Players voluntarily retry within 5 seconds of a fall in ≥ 70% of sessions.
6. ✚ **Five-second clip test:** a silent five-second clip of a Blast terraforming a wave identifies this game and no other.

---

## 44. Autonomous Decision Rules
1. Preserve the Design Pillars and Design Laws.
2. Preserve the Player Fantasy.
3. Preserve gameplay readability.
4. Preserve responsiveness.
5. Prefer the simplest solution that supports the intended experience.
6. Do not add progression, mechanics, currencies, screens or systems merely to fill perceived gaps.
7. Do not remove intentional friction (Crumble, Forbidden restraint, Iron HP, hinterland cap) because a smoother implementation is easier.
8. Do not change LOCKED rules or numbers without documenting the reason.
9. If a choice is reversible and does not materially alter player experience, choose and continue.
10. Record meaningful assumptions in DECISIONS.md; tuning changes in TUNING_LOG.md.
11. ✚ Prefer lifting a proven system from the foundry (§29.2) over writing a new one.

---

## 45. Builder Instructions
- Build continuously rather than stopping after every milestone.
- Keep the game playable throughout development.
- Test before integrating major changes.
- Complete an end-to-end version before deep-polishing isolated systems.
- Never silently substitute a different mechanic for a difficult one.
- Placeholders are acceptable during construction but must remain replaceable via the manifest; procedural visuals are the final target.
- Optimize only where measurement demonstrates need, except architecture needed for known platform constraints (instancing, mobile post at half-res).
- Log assumptions instead of blocking on minor questions. Stop and ask only for player-facing spec contradictions or unmeetable performance targets.
- Michael playtests builds that already look nearly finished: bring presentation to §23–27 quality before reporting a playtest build.
- ✚ Report only what is verified. "Pushed" is not "deployed"; "deployed" is not "playable." Say which.
- ✚ Never ship a truncated file: after any large write, confirm the file is complete and the build runs.
- Generate `ASSET_DELIVERY.md` (fonts, any optional overrides) and `AUDIO_DELIVERY.md` (every manifest key; stems must be 100 BPM, D Dorian, 8-bar loop-aligned; the engine time-stretches them as the tick shortens).
- **Final report:** live URL + commit; gate results; screenshots of every screen/state; perf numbers vs targets; §42 status; each §43 test with evidence or how to test; links to DECISIONS.md, TUNING_LOG.md, delivery docs; honest shortfalls.

---

## 46. Open Questions
| Question | Importance | Current Lean (working default) | Blocks Build? |
|---|---|---|---|
| Exact shell Frame names | Low | Use title/menu/pause/settings/results equivalents from the generator's help | No |
| Shell v1.3 Three adapter present? | Low | If not, add a thin `render/three` adapter in the game | No |
| Premium price | Low | $9.99 Steam / $4.99 mobile | No |
| Michael's own stems vs synth music | Medium | Synth ships; stems drop in via manifest | No |
| Pipeline Triage Score | Low | Michael fills from TRIAGE.md | No |

---

## 47. Decisions Log
See `DECISIONS.md` (seeded with decisions 1–29).

---

## 48. Reference Library
- **Gameplay:** Intelligent Qube (use for: cadence, mark/detonate, dread · ignore: box arena, IQ score); Into the Breach (use for: telegraphs, full information).
- **Art:** brutalist architecture photography; Monument Valley's restraint (use for: minimalism · ignore: pastel palette).
- **Camera:** Intelligent Qube elevated third-person; Tetris Effect journey camera (use for: slow drift · ignore: heavy motion).
- **UI:** engraved stone typography; Mini Metro (use for: minimal UI).
- **VFX:** Tetris Effect particle-as-music (use for: reward radiance · ignore: density).
- **Audio:** Takayuki Hattori's Intelligent Qube score; Ben Frost (texture); Tetris Effect (kills as notes).

✚ Store visual references under `docs/refs/` with a README of what to take and ignore per image.

---

## 49. Handoff Checklist
- [x] One-sentence pitch exists
- [x] Player fantasy is explicit
- [x] Pillars and Design Laws are explicit
- [x] Anti-pillars are explicit
- [x] Core loop is defined
- [x] Win/loss conditions are defined
- [x] Player verbs and controls (KBM, pad, touch) are defined
- [x] Game-feel requirements exist for defining actions, with an Impact Scale
- [x] Major systems and interactions are resolved
- [x] UX flow is mapped
- [x] Visual target is concrete (rendering recipe, palette, value rule)
- [x] Animation, VFX and audio direction are concrete
- [x] Required content quantities are known
- [x] Performance targets are known
- [x] Accessibility expectations are known
- [x] Build order exists, Phase 0 tests The Bet
- [x] Verification requirements exist (gate command, E2E smoke, invariants)
- [x] Definition of Done and Definition of Great exist
- [x] Autonomous decision rules exist
- [x] No blocking design questions; every open question has a working default
- [x] Base repo and lifted systems are named (§29.2)
- [x] Every resource, tell and counter has numbers
- [x] Pacing curve exists
- [ ] References attached in `docs/refs/` (Michael to add images)
- [ ] Engineering prerequisites: GitHub repo `tessera`, Vercel project, Supabase project (Steam/Apple accounts before Phase 7)

---

## 50. Final Handoff Directive
Build the game described by this document, not merely the feature list.

The intended result is: a cold, beautiful void of rolling monoliths where a small warm light builds its own path forward one earned tile at a time, and where getting smarter feels like the reward.

When forced to choose between technically satisfying a feature and preserving its intended experience, preserve the intended experience.

The project is finished only when it satisfies both §42 Definition of Done and §43 Definition of Great.

### ✚ Repo Packaging
- `docs/GDD.md`: this document, the source of truth.
- `CLAUDE.md`: the builder's always-loaded law.
- `DECISIONS.md`: seeded; the builder appends.
- `docs/refs/`: reference images.

### ✚ Handoff Prompt (paste into the builder session)
```
Build Tessera from docs/GDD.md in this repo. CLAUDE.md is the law.
Set up the foundation exactly as §29.2 specifies, then work through §40 phase by phase without
stopping, keeping the game playable. Run `npm run gates` before every commit. Prove each phase's
exit condition in a running build. Use the working default for any open question in §46 and log it
in DECISIONS.md. The game is finished only when §42 and §43 are both met.
```
