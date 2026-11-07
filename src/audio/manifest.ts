/**
 * Asset manifest (GDD §23 Asset Pipeline, §45 AUDIO_DELIVERY): semantic keys → `synth:` presets or files.
 * Dropping a file in public/audio/ and mapping it here overrides the synth with no code change.
 * Stems must be 100 BPM, D Dorian, 8-bar loop-aligned; the engine time-stretches them as the tick shortens.
 */
export const AUDIO_MANIFEST: Readonly<Record<string, string>> = {
  "music.drone": "synth:drone",
  "music.kick": "synth:kick",
  "music.pad": "synth:pad",
  "music.bass": "synth:bass",
  "music.hats": "synth:hats",
  "music.strings": "synth:strings",
  "music.cello": "synth:cello",
  "music.bell": "synth:bell",
  "sfx.roll": "synth:roll",
  "sfx.mark": "synth:mark",
  "sfx.markRemove": "synth:markRemove",
  "sfx.kill.transient": "synth:killTransient",
  "sfx.kill.note": "synth:killNote",
  "sfx.ironHit": "synth:ironHit",
  "sfx.miss": "synth:miss",
  "sfx.blast": "synth:blast",
  "sfx.forbiddenKill": "synth:tritone",
  "sfx.skyfall.whistle": "synth:whistle",
  "sfx.skyfall.impact": "synth:impact",
  "sfx.crush": "synth:crush",
  "sfx.crumble.hum": "synth:hum",
  "sfx.crumble.groan": "synth:groan",
  "sfx.beacon": "synth:arpeggio",
  "sfx.glass.crackle": "synth:crackle",
  "sfx.glass.shatter": "synth:shatter",
  "sfx.fall": "synth:fall",
  "sfx.forbiddenMarked": "synth:dissonantHum",
  "ui.tick": "synth:uiTick",
  "ui.confirm": "synth:uiConfirm",
  "voice.tessera": "synth:voiceTessera",
  "voice.beautiful": "synth:voiceBeautiful",
  "voice.holdOn": "synth:voiceHoldOn",
  "voice.purified": "synth:voicePurified",
  "voice.again": "synth:voiceAgain"
};

export const ASSET_MANIFEST: Readonly<Record<string, string>> = {
  "font.title": "@fontsource/cinzel (OFL)",
  "font.numerals": "@fontsource/jetbrains-mono (OFL)",
  "texture.*": "procedural:canvas (src/render/three/textures.ts)"
};
