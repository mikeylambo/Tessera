# TESSERA — Audio Delivery

Every sound is synthesized at runtime and is final unless a file override is supplied. To override, place the file in `public/audio/` and map its key in `src/audio/manifest.ts` (no code change elsewhere).

**Stems:** 100 BPM (tick 72 f = 2 beats), D Dorian, 8-bar loop-aligned. The engine follows the tick (BPM = 7200 / tick, up to 133 BPM at the 54 f floor) and time-stretches stems as the tick shortens. Music never drives gameplay.

| Key | Role | Notes |
|---|---|---|
| music.drone | Always-on bed | D + A, low-pass opens with tension |
| music.kick | Every beat | soft, sub-heavy |
| music.pad | One chord per bar | Dm · C · B♭ · G/B |
| music.bass | Formation 3+ | |
| music.hats | Formation 3+; double-time in Last Stand | |
| music.strings | Ground ≤ 4 rows | |
| music.cello | Chamber | solo, no kick |
| music.bell | Title | distant |
| sfx.roll | Every tick | ducked −6 dB under kill notes |
| sfx.mark / sfx.markRemove | Mark placed / removed | pitched by column |
| sfx.kill.transient / sfx.kill.note | Kill | transient at 0 ms; note quantized to next 16th; column → D Dorian degree; octave by type |
| sfx.ironHit, sfx.miss, sfx.blast, sfx.forbiddenKill, sfx.skyfall.whistle, sfx.skyfall.impact, sfx.crush, sfx.crumble.hum, sfx.crumble.groan, sfx.beacon, sfx.glass.crackle, sfx.glass.shatter, sfx.fall, sfx.forbiddenMarked | per GDD §26 cue sheet | each event has its own timbre |
| ui.tick / ui.confirm | Menus | |
| voice.tessera / beautiful / holdOn / purified / again | Announcer (ElevenLabs placeholder) | calm, warm, no exclamation |

Mix target −14 LUFS; music ducks 4 dB for 500 ms on Climax events; announcer ducks everything 8 dB.
