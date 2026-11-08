import { describe, expect, it } from "vitest";
import { CHAMBERS, chamberMinMarks, chamberCells } from "../src/data/chambers";

describe("Chamber puzzles are solvable and tight", () => {
  for (const c of CHAMBERS) {
    it(`${c.id} ${c.name}: solvable with ${c.marks} marks, not with ${c.marks - 1}`, () => {
      expect(chamberMinMarks(c)).toBe(c.marks);
    });
  }
});

describe("Chambers teach restraint", () => {
  it("at least half the Chambers make 'fire every Glyph' a losing move (it catches a Forbidden)", () => {
    const loses = CHAMBERS.filter((c) => {
      const cells = chamberCells(c);
      return cells.some((x) => x.forbidden && c.glyphs.some(([gx, gr]) => Math.abs(x.x - gx) <= 1 && Math.abs(x.row - gr) <= 1));
    });
    expect(loses.length).toBeGreaterThanOrEqual(CHAMBERS.length / 2);
  });
});

describe("Chamber in a live Endless run", () => {
  it("every 4th Sector opens a Chamber; the expert solves it (+2500, rare Rune pool); time is frozen", async () => {
    const { World } = await import("../src/sim/World");
    const { Bot } = await import("../src/dev/bot");
    const { CHAMBER_RUNES } = await import("../src/data/chambers");
    const w = new World({ mode: "endless", seed: 5, sector: 4 });
    const bot = new Bot("expert", 5);
    let started = false;
    let won: boolean | null = null;
    let tickAtStart = -1;
    let offersAfter: readonly string[] | null = null;
    for (let i = 0; i < 60 * 60 * 6 && !w.ended && won === null; i++) {
      w.step(bot.think(w));
      for (const e of w.events.drain()) {
        if (e.t === "ChamberStart") {
          started = true;
          tickAtStart = w.tick;
        }
        if (e.t === "ChamberEnd") {
          won = e.won;
          expect(w.tick).toBe(tickAtStart); // frozen
          offersAfter = w.runeOffers;
        }
      }
    }
    expect(started).toBe(true);
    expect(won).toBe(true);
    expect(w.chambersWon).toBe(1);
    expect(offersAfter!.every((r) => (CHAMBER_RUNES as readonly string[]).includes(r))).toBe(true);
  });
});
