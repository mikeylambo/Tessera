import { describe, expect, it } from "vitest";
import { dailyDay, dailyIndex, fmtCountdown, msToNextDaily, nextStreak, shareText, silhouette, traceRun, RUN_ID } from "../src/share/daily";
import { resimulate } from "../src/sim/Replay";
import { runBot } from "./helpers";

describe("shareable Daily", () => {
  it("Daily index counts from launch (2026-11-13 = #1) and round-trips", () => {
    expect(dailyIndex("2026-11-13")).toBe(1);
    expect(dailyIndex("2027-04-03")).toBe(142);
    for (const n of [1, 7, 142, 900]) expect(dailyIndex(dailyDay(n))).toBe(n);
  });
  it("silhouette: 6 columns, ≤ 6 rows, front row on top, shape only", () => {
    const g = silhouette([{ x: 0, z: 10 }, { x: 6, z: 10 }, { x: 3, z: 2 }]);
    expect(g.length).toBeLessThanOrEqual(6);
    for (const r of g) expect(r).toMatch(/^[01]{6}$/);
    expect(g[0]![0]).toBe("1"); // the front (z = 10) is the top row
    expect(g[0]![5]).toBe("1");
    expect(g.at(-1)).toContain("1");
    const full = silhouette(Array.from({ length: 7 * 40 }, (_, i) => ({ x: i % 7, z: Math.floor(i / 7) })));
    expect(full).toEqual(Array(6).fill("111111"));
  });
  it("text block matches the brief's format; rank only when validated", () => {
    const t = shareText({ index: 142, depth: 31, perfect: 2, rank: 87, grid: ["110111", "011101"], url: "https://x/d/142" });
    expect(t).toBe("TESSERA Daily #142 ✦\nDepth 31 · Rank #87 · Perfect ×2\n🟧🟧⬛🟧🟧🟧\n⬛🟧🟧🟧⬛🟧\nhttps://x/d/142");
    expect(shareText({ index: 1, depth: 3, perfect: 0, rank: null, grid: ["000000"], url: "u" })).not.toContain("Rank");
  });
  it("streak counts consecutive UTC days; a gap resets; same day doesn't double count", () => {
    let s = nextStreak(null, "2026-11-18");
    s = nextStreak(s, "2026-11-19");
    expect(s.count).toBe(2);
    expect(nextStreak(s, "2026-11-19").count).toBe(2);
    expect(nextStreak(s, "2026-11-21").count).toBe(1);
  });
  it("countdown is hh:mm:ss to the next UTC midnight", () => {
    expect(msToNextDaily(Date.parse("2026-11-19T23:00:00Z"))).toBe(3_600_000);
    expect(fmtCountdown(3_661_000)).toBe("01:01:01");
  });
  it("replay ids are 10 unambiguous base32 chars", () => {
    expect(RUN_ID.test("e2etest0ab")).toBe(true);
    expect(RUN_ID.test("e2etest0iL")).toBe(false);
  });
  it("traceRun is the same deterministic sim as resimulate (replay links reproduce the server hash)", () => {
    const cfg = { mode: "daily" as const, seed: "DAILY-2026-11-18" };
    const run = runBot(cfg, "competent", 60 * 60);
    const a = traceRun(cfg, run.recorder.entries, run.world.frame);
    const b = resimulate(cfg, run.recorder.entries, run.world.frame);
    expect(a.hash).toBe(b.stateHash());
    expect(a.hash).toBe(run.world.stateHash());
    expect(a.cells.length).toBeGreaterThan(0);
  });
});
