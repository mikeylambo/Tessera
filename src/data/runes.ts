/** Runes (GDD §17). Effects are applied by the sim where each rule lives. */
export type RuneId =
  | "longArm" | "thirdEye" | "temperedGlass" | "slowEarth" | "sledge" | "leap"
  | "absolution" | "resonance" | "wideBlast" | "bedrock" | "echoMark" | "lastWord";

export interface RuneDef {
  id: RuneId;
  name: string;
  effect: string;
  maxStack: number;
  rare: boolean;
  glyph: string;
}

export const RUNES: readonly RuneDef[] = [
  { id: "longArm", name: "Long Arm", effect: "+1 Reach", maxStack: 2, rare: false, glyph: "◫" },
  { id: "thirdEye", name: "Third Eye", effect: "+1 mark", maxStack: 1, rare: true, glyph: "◉" },
  { id: "temperedGlass", name: "Tempered Glass", effect: "Glass lasts +2 ticks", maxStack: 2, rare: false, glyph: "◇" },
  { id: "slowEarth", name: "Slow Earth", effect: "Crumble +2 ticks", maxStack: 2, rare: false, glyph: "▤" },
  { id: "sledge", name: "Sledge", effect: "Iron HP −1", maxStack: 1, rare: false, glyph: "▣" },
  { id: "leap", name: "Leap", effect: "Jump one gap", maxStack: 1, rare: true, glyph: "⤒" },
  { id: "absolution", name: "Absolution", effect: "First Forbidden kill each Sector is forgiven", maxStack: 1, rare: true, glyph: "◌" },
  { id: "resonance", name: "Resonance", effect: "Chains of 3+ refund a Glyph", maxStack: 1, rare: true, glyph: "≋" },
  { id: "wideBlast", name: "Wide Blast", effect: "Blast becomes 5 × 3", maxStack: 1, rare: true, glyph: "▭" },
  { id: "bedrock", name: "Bedrock", effect: "Ground you hold 4 ticks can't crumble", maxStack: 1, rare: true, glyph: "▥" },
  { id: "echoMark", name: "Echo Mark", effect: "Marks persist 1 tick after detonation", maxStack: 1, rare: false, glyph: "◎" },
  { id: "lastWord", name: "Last Word", effect: "Last Stand lasts 25 s", maxStack: 1, rare: false, glyph: "▲" }
];

export const runeById = (id: RuneId): RuneDef => RUNES.find((r) => r.id === id)!;
