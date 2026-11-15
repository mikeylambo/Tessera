import type { InputFamily } from "../input/Devices";

/**
 * How to Play (DECISIONS #72). One idea per card: a title, one line, a small looping diagram in the game's own
 * palette (warm ground, cold void, amber marks), and the controls for the device in hand. Never a text wall.
 * Cube cards only show types the player has already met (slow unveiling, GDD §18).
 */
export interface HowToCard {
  id: string;
  title: string;
  line: string;
  svg: string;
  controls?: Array<[string, string]>;
}

const C = 22; // cell px
const COLS = 7;
const ROWS = 7;
const OX = (300 - COLS * C) / 2;
const OY = 6;
const cx = (x: number) => OX + x * C;
const cy = (z: number) => OY + z * C;

const STYLE = `<style>
.t-howto-fig .g{fill:#3a3632;stroke:#ffa64a;stroke-opacity:.55;stroke-width:1}
.t-howto-fig .v{fill:#8a93a3;opacity:.28}
.t-howto-fig .cube{fill:#9a948c;stroke:#cfc8bd;stroke-opacity:.5}
.t-howto-fig .fig{fill:#d8d2c8}.t-howto-fig .core{fill:#ffb347}
.t-howto-fig .mark{fill:none;stroke:#ffb347;stroke-width:2}
.t-howto-fig .reach{fill:#ffb347;opacity:.07}
.t-howto-fig .forb{fill:#0d0c12;stroke:#8b5cf6;stroke-width:1.5}
.t-howto-fig .adv{fill:#2fd38a;opacity:.9}.t-howto-fig .glass{fill:#7fd8e8;opacity:.55;stroke:#bff0f8}
.t-howto-fig .iron{fill:#2b2e33;stroke:#8a93a3}.t-howto-fig .phase{fill:#9a948c;stroke:#c9b6ff;stroke-dasharray:3 2}
.t-howto-fig .scar{fill:#1a0f2a;stroke:#8b5cf6;stroke-opacity:.6}
@keyframes roll{0%{transform:translateY(0)}100%{transform:translateY(${3 * C}px)}}
@keyframes roll2{0%,8%{transform:translateY(0)}30%,38%{transform:translateY(${C}px)}60%,100%{transform:translateY(${2 * C}px)}}
@keyframes pop{0%,25%{opacity:0;transform:scale(.4)}35%,100%{opacity:1;transform:scale(1)}}
@keyframes blink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes die{0%,62%{opacity:1}70%,100%{opacity:0}}
@keyframes rise{0%,64%{opacity:0}78%,100%{opacity:1}}
@keyframes flash{0%,60%{opacity:0;r:2}66%{opacity:.9;r:14}80%,100%{opacity:0;r:22}}
@keyframes crumble{0%,40%{opacity:1;transform:translateY(0)}55%{opacity:1;transform:translateY(2px)}85%,100%{opacity:0;transform:translateY(16px)}}
@keyframes warn{0%,20%{stroke-opacity:.55}30%,45%{stroke-opacity:1;stroke:#ff6a3a}}
@keyframes step{0%,55%{transform:translateY(0)}65%,100%{transform:translateY(-${C}px)}}
.t-howto-fig .a-roll{animation:roll2 3.2s steps(1) infinite}
.t-howto-fig .a-pop{animation:pop 3.2s ease-out infinite;transform-box:fill-box;transform-origin:center}
.t-howto-fig .a-die{animation:die 3.2s linear infinite}.t-howto-fig .a-rise{animation:rise 3.2s linear infinite}
.t-howto-fig .a-flash{animation:flash 3.2s ease-out infinite}
.t-howto-fig .a-crumble{animation:crumble 3.2s ease-in infinite}.t-howto-fig .a-warn{animation:warn 3.2s linear infinite}
.t-howto-fig .a-step{animation:step 3.2s ease-out infinite}.t-howto-fig .a-blink{animation:blink 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.t-howto-fig *{animation:none!important}}
</style>`;

function cells(ground: Set<string>): string {
  let s = "";
  for (let z = 0; z < ROWS; z++)
    for (let x = 0; x < COLS; x++)
      s += ground.has(`${x},${z}`) ? `<rect class="g" x="${cx(x) + 1}" y="${cy(z) + 1}" width="${C - 2}" height="${C - 2}"/>` : `<circle class="v" cx="${cx(x) + C / 2}" cy="${cy(z) + C / 2}" r="1.2"/>`;
  return s;
}
const rows = (from: number, to: number, x0 = 0, x1 = COLS - 1) => {
  const out: string[] = [];
  for (let z = from; z <= to; z++) for (let x = x0; x <= x1; x++) out.push(`${x},${z}`);
  return new Set(out);
};
const cube = (x: number, z: number, cls = "cube", extra = "") => `<rect class="${cls} ${extra}" x="${cx(x) + 3}" y="${cy(z) + 3}" width="${C - 6}" height="${C - 6}"/>`;
const fig = (x: number, z: number, extra = "") => `<g class="${extra}"><rect class="fig" x="${cx(x) + 8}" y="${cy(z) + 3}" width="${C - 16}" height="${C - 6}"/><rect class="core" x="${cx(x) + 10}" y="${cy(z) + 8}" width="${C - 20}" height="5"/></g>`;
const sigil = (x: number, z: number, extra = "") => {
  const m = cx(x) + C / 2;
  const n = cy(z) + C / 2;
  return `<path class="mark ${extra}" d="M${m} ${n - 7} L${m + 7} ${n} L${m} ${n + 7} L${m - 7} ${n} Z"/>`;
};
const svg = (inner: string) => `<svg class="t-howto-fig" viewBox="0 0 300 ${ROWS * C + 12}" role="img" aria-hidden="true">${STYLE}${inner}</svg>`;

function controls(family: InputFamily) {
  if (family === "touch")
    return { move: ["Move", "Swipe"], mark: ["Mark", "Tap a cell"], det: ["Detonate", "◈ Detonate button"], blast: ["Blast", "◆ button"] } as const;
  if (family === "gamepad")
    return { move: ["Move", "Left stick / D-pad"], mark: ["Mark", "Aim right stick · A"], det: ["Detonate", "X"], blast: ["Blast", "Y"] } as const;
  return { move: ["Move", "WASD / Arrows"], mark: ["Mark", "Click a cell · J"], det: ["Detonate", "Right-click · K"], blast: ["Blast", "Space · L"] } as const;
}

/** The basics, in teaching order. */
export function basicCards(family: InputFamily): HowToCard[] {
  const k = controls(family);
  return [
    {
      id: "goal",
      title: "SURVIVE",
      line: "Cubes roll toward you, one step at a time. Only falling into the void ends a run.",
      svg: svg(cells(rows(4, 6)) + `<g class="a-roll">${cube(1, 0)}${cube(4, 1)}</g>` + fig(3, 5)),
      controls: [k.move as [string, string]]
    },
    {
      id: "mark",
      title: "MARK",
      line: "Place a mark on a cell a cube is about to roll onto.",
      svg: svg(cells(rows(4, 6)) + `<g class="a-roll">${cube(3, 0)}</g>` + sigil(3, 2, "a-pop") + fig(3, 5)),
      controls: [k.mark as [string, string]]
    },
    {
      id: "detonate",
      title: "DETONATE",
      line: "When the cube sits on your mark, detonate. Its cell becomes new ground.",
      svg: svg(cells(rows(4, 6)) + `<rect class="g a-rise" x="${cx(3) + 1}" y="${cy(3) + 1}" width="${C - 2}" height="${C - 2}"/>` + sigil(3, 3, "a-die") + `<g class="a-roll a-die">${cube(3, 1)}</g>` + `<circle class="core a-flash" cx="${cx(3) + C / 2}" cy="${cy(3) + C / 2}" r="2" fill-opacity=".5"/>` + fig(3, 5)),
      controls: [k.det as [string, string]]
    },
    {
      id: "reach",
      title: "REACH",
      line: "Marks reach three cells in any direction — even out over the void. Kills there become islands.",
      svg: svg(`<rect class="reach" x="${cx(0)}" y="${cy(2)}" width="${COLS * C}" height="${5 * C}"/>` + cells(rows(5, 6)) + `<rect class="g a-rise" x="${cx(1) + 1}" y="${cy(2) + 1}" width="${C - 2}" height="${C - 2}"/>` + sigil(1, 2, "a-die") + `<g class="a-roll a-die">${cube(1, 0)}</g>` + `<circle class="core a-flash" cx="${cx(1) + C / 2}" cy="${cy(2) + C / 2}" r="2" fill-opacity=".5"/>` + fig(3, 5)),
      controls: [k.mark as [string, string]]
    },
    {
      id: "crumble",
      title: "KEEP MOVING",
      line: "The rear row crumbles away. Build forward and step onto your new ground.",
      svg: svg(cells(rows(3, 5)) + `<g class="a-crumble">${[...rows(6, 6)].map((c) => { const [x, z] = c.split(",").map(Number); return `<rect class="g a-warn" x="${cx(x!) + 1}" y="${cy(z!) + 1}" width="${C - 2}" height="${C - 2}"/>`; }).join("")}</g>` + fig(3, 5, "a-step")),
      controls: [k.move as [string, string]]
    }
  ];
}

/** One card per cube type the player has met (unlocks follow the Hundred acts; GDD §17–18). */
export function cubeCards(family: InputFamily, act: number): HowToCard[] {
  const k = controls(family);
  const ground = cells(rows(5, 6));
  const out: HowToCard[] = [
    { id: "stone", title: "STONE", line: "One detonation. Mark it before it passes you.", svg: svg(ground + `<g class="a-roll">${cube(3, 0)}</g>` + sigil(3, 2, "a-pop") + fig(3, 5)) }
  ];
  if (act >= 2) {
    out.push({ id: "forbidden", title: "FORBIDDEN", line: "Violet core: never kill it. Step out of its lane and let it pass — killing one tears a scar in the ground.", svg: svg(ground + `<g class="a-roll">${cube(3, 0, "forb")}</g>` + fig(3, 5, "a-step") + `<rect class="scar a-blink" x="${cx(5) + 2}" y="${cy(6) + 2}" width="${C - 4}" height="${C - 4}"/>`) });
    out.push({ id: "advantage", title: "ADVANTAGE", line: "Green: kill it to store a Glyph. Spend it on a Blast — a 3 × 3 detonation.", svg: svg(ground + `<rect class="reach" x="${cx(2)}" y="${cy(1)}" width="${3 * C}" height="${3 * C}" style="opacity:.14"/>` + `<g class="a-roll">${cube(3, 0, "adv")}${cube(2, 0)}${cube(4, 1)}</g>` + fig(3, 5)), controls: [k.blast as [string, string]] });
  }
  if (act >= 3) {
    out.push({ id: "glass", title: "GLASS", line: "Leaves glass ground. It shatters soon after you step off — don't come back to it.", svg: svg(ground + `<rect class="glass a-blink" x="${cx(3) + 1}" y="${cy(3) + 1}" width="${C - 2}" height="${C - 2}"/>` + fig(3, 5)) });
    out.push({ id: "iron", title: "IRON", line: "Takes three detonations, or one Blast. Start early.", svg: svg(ground + `<g class="a-roll">${cube(3, 0, "iron")}</g>` + sigil(3, 2, "a-blink") + fig(3, 5)) });
    out.push({ id: "skyfall", title: "SKYFALL", line: "A shadow means something is dropping. Step out of it — or mark the cell to kill it on landing.", svg: svg(ground + `<rect x="${cx(2) + 2}" y="${cy(5) + 2}" width="${C - 4}" height="${C - 4}" fill="#000" class="a-blink"/>` + fig(4, 5)) });
  }
  if (act >= 4) out.push({ id: "phase", title: "PHASE", line: "Twin cubes. Mark both halves, then detonate once.", svg: svg(ground + `<g class="a-roll">${cube(2, 0, "phase")}${cube(3, 0, "phase")}</g>` + sigil(2, 2, "a-pop") + sigil(3, 2, "a-pop") + fig(3, 5)), controls: [k.det as [string, string]] });
  return out;
}

export function cardBody(card: HowToCard): string {
  const keys = card.controls?.length ? `<div class="t-keys">${card.controls.map(([a, b]) => `<span class="k">${a}</span><span class="v">${b}</span>`).join("")}</div>` : "";
  return `<div class="t-howto">${card.svg}<p class="t-howto-line">${card.line}</p>${keys}</div>`;
}

export const HOWTO_CSS = /* css */ `
.t-howto { display:flex; flex-direction:column; align-items:center; gap:14px; }
.t-howto-fig { width:min(300px, 78vw); height:auto; border:1px solid var(--line); background:rgba(5,6,8,0.6); }
.t-howto-line { margin:0; max-width:360px; line-height:1.55; letter-spacing:0.02em; color:var(--ink); }
.t-keys { display:grid; grid-template-columns:auto auto; gap:4px 18px; font-size:0.86em; }
.t-keys .k { color:#b9b2a6; letter-spacing:0.16em; text-transform:uppercase; text-align:right; }
.t-keys .v { color:var(--amber); letter-spacing:0.06em; text-align:left; text-shadow:0 0 12px rgba(255,179,71,0.25); }
.t-dots { display:flex; gap:6px; justify-content:center; margin:2px 0 16px; }
.t-dots i { width:6px; height:6px; border:1px solid var(--line); }
.t-dots i.on { background:var(--amber); border-color:var(--amber); }
`;
