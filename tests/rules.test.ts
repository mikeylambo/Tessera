import { describe, expect, it } from "vitest";
import { World } from "../src/sim/World";
import { TUNING } from "../src/data/tuning";
import { input, idle, until } from "./helpers";
import { checkFormation } from "../src/sim/Fairness";

const sandbox = () => new World({ mode: "sandbox", seed: 1 });

describe("core rules", () => {
  it("kills become ground where the cube died (over the void)", () => {
    const w = sandbox();
    w.spawnFormation(["...S..."], 1, 6);
    // wait for it to reach z = 4 (one row beyond the slab)
    expect(until(w, () => w.cubes.alive()[0]?.z === 4)).toBe(true);
    const before = w.grid.size;
    w.step(input({ mark: { x: 3, z: 4 } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    expect(w.cubes.count).toBe(0);
    expect(w.grid.has(3, 4)).toBe(true);
    expect(w.grid.size).toBe(before + 1);
    expect(w.score.total).toBe(TUNING.score.stone);
  });

  it("a kill not touching ground creates an island (+150)", () => {
    const w = sandbox();
    w.spawnFormation(["...S..."], 1, 7);
    w.step(input({ press: 1 }));
    until(w, () => w.cubes.alive()[0]?.z === 5);
    w.step(input({ mark: { x: 3, z: 5 } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    expect(w.grid.has(3, 5)).toBe(true);
    expect(w.islands).toBe(1);
    expect(w.score.total).toBe(TUNING.score.stone + TUNING.score.island + TUNING.score.depthPerRow);
  });

  it("marks only within Reach (Chebyshev 3)", () => {
    const w = sandbox();
    w.step(input({ mark: { x: 3, z: 5 } })); // player z=1 → dz 4
    expect(w.marks.count).toBe(0);
    idle(w, 5);
    w.step(input({ mark: { x: 0, z: 4 } }));
    expect(w.marks.count).toBe(1);
  });

  it("re-pressing a mark removes it; detonating with no cube is a miss", () => {
    const w = sandbox();
    w.step(input({ mark: { x: 3, z: 3 } }));
    idle(w, 5);
    w.step(input({ mark: { x: 3, z: 3 } }));
    expect(w.marks.count).toBe(0);
    idle(w, 5);
    w.step(input({ mark: { x: 2, z: 3 } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    const ev = w.events.drain();
    expect(ev.some((e) => e.t === "Miss")).toBe(true);
  });

  it("killing a Forbidden tears a Scar and crumbles the rear row", () => {
    const w = sandbox();
    w.spawnFormation(["...F..."], 1, 6);
    until(w, () => w.cubes.alive()[0]?.z === 4);
    w.step(input({ mark: { x: 3, z: 4 } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    expect(w.grid.isScar(3, 4)).toBe(true);
    expect(w.grid.has(3, 4)).toBe(false);
    expect(w.grid.rearZ()).toBe(1);
    expect(w.forbiddenKilled).toBe(1);
  });

  it("a Forbidden let through costs nothing and scores restraint", () => {
    const w = sandbox();
    w.spawnFormation(["F......"], 1, 5);
    until(w, () => w.cubes.count === 0, 4000);
    expect(w.grid.size).toBe(28);
    expect(w.score.total).toBe(TUNING.score.forbiddenPassed);
  });

  it("an escaped Standard crumbles the rear row", () => {
    const w = sandbox();
    w.spawnFormation(["S......"], 1, 5);
    until(w, () => w.cubes.count === 0, 4000);
    expect(w.grid.rearZ()).toBe(1);
  });

  it("crush shoves the player back one tile with a stun; off the rear edge they fall", () => {
    const w = sandbox();
    w.spawnFormation(["...S..."], 1, 3);
    until(w, () => w.player.state === "shoved", 2000);
    expect(w.player.z).toBe(0);
    until(w, () => w.player.state === "stunned", 100);
    expect(w.player.stun).toBeGreaterThan(0);
    until(w, () => w.outcome !== null, 2000);
    expect(w.outcome?.kind).toBe("fall");
  });

  it("Advantage kill leaves a Glyph tile; Blast terraforms a 3×3", () => {
    const w = sandbox();
    w.spawnFormation(["...A..."], 1, 6);
    until(w, () => w.cubes.alive()[0]?.z === 4);
    w.step(input({ mark: { x: 3, z: 4 } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    expect(w.run.glyphs.length).toBe(1);
    expect(w.grid.get(3, 4)?.type).toBe("glyph");
    idle(w, 20);
    w.spawnFormation(["..SSS..", "..SSS.."], 1, 6);
    until(w, () => w.cubes.alive().every((c) => c.z <= 5) && w.f === 0);
    idle(w, 2);
    w.events.drain();
    w.step(input({ blast: true }));
    idle(w, TUNING.blast.charge + 1);
    const ev = w.events.drain();
    const kills = ev.filter((e) => e.t === "Kill");
    expect(kills.length).toBe(6);
    expect(w.run.glyphs.length).toBe(0);
    expect(w.grid.get(3, 4)?.type).toBe("ground");
  });

  it("Iron needs three detonations on separate ticks and leaves a raised tile (+1 Reach)", () => {
    const w = sandbox();
    w.spawnFormation(["...I..."], 1, 7);
    until(w, () => w.cubes.alive()[0]?.z === 4 && w.f === 1);
    for (let hit = 0; hit < 3; hit++) {
      const c = w.cubes.alive()[0]!;
      const l = w.logical(c)!;
      w.step(input({ mark: l }));
      idle(w, 5);
      w.step(input({ detonate: true }));
      idle(w, 20);
      if (hit < 2) until(w, () => w.f === 1);
    }
    expect(w.cubes.count).toBe(0);
    expect([...w.grid.list()].some((t) => t.type === "raised")).toBe(true);
  });

  it("Phase dies only when both halves are marked in the same detonation", () => {
    const w = sandbox();
    w.spawnFormation(["..PP..."], 1, 6);
    until(w, () => w.cubes.alive()[0]?.z === 4);
    w.step(input({ mark: { x: 2, z: 4 } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    expect(w.cubes.count).toBe(2);
    idle(w, 13);
    const l = w.logical(w.cubes.alive()[0]!)!;
    w.step(input({ mark: { x: 2, z: l.z } }));
    idle(w, 5);
    w.step(input({ mark: { x: 3, z: l.z } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    expect(w.cubes.count).toBe(0);
    expect(w.score.total).toBe(TUNING.score.phase);
  });

  it("timed Crumble removes the rear row on its interval with a 30 f warning", () => {
    const w = new World({ mode: "endless", seed: 3 });
    const interval = w.crumbleInterval();
    expect(interval).toBe(TUNING.crumble.startInterval);
    let warned = -1;
    let fell = -1;
    // the timer only runs after first contact (TUNING.crumble.holdUntilContact): provide it with a harmless
    // Forbidden in column 0 (it passes; Forbidden escapes cost nothing), then watch the first timed crumble
    w.spawnFormation(["F......"], 99, (w.grid.frontZ() ?? 3) + 2);
    for (let i = 0; i < 6000 && fell < 0; i++) {
      w.step(input());
      for (const e of w.events.drain()) {
        if (e.t === "CrumbleWarn") warned = w.frame;
        if (e.t === "Crumble" && e.reason === "timer" && fell < 0) fell = w.frame;
      }
    }
    expect(fell).toBeGreaterThan(0);
    expect(fell - warned).toBe(TUNING.crumble.warnFrames);
  });

  it("Crumble holds until first contact in each Sector", () => {
    const w = new World({ mode: "endless", seed: 3 });
    for (let i = 0; i < 4 * w.tickLen; i++) w.step(input());
    expect(w.crumble.contacted).toBe(false);
    expect(w.crumble.counter).toBe(0);
    until(w, () => w.crumble.contacted, 6000);
    expect(w.cubes.alive().some((c) => c.z - (w.grid.frontZ() ?? 0) <= w.reach)).toBe(true);
  });

  it("chains multiply: n kills in one detonation score sum × n", () => {
    const w = sandbox();
    w.spawnFormation(["..S.S.."], 1, 6);
    until(w, () => w.cubes.alive()[0]?.z === 4);
    w.step(input({ mark: { x: 2, z: 4 } }));
    idle(w, 5);
    w.step(input({ mark: { x: 4, z: 4 } }));
    idle(w, 5);
    w.step(input({ detonate: true }));
    expect(w.score.total).toBe(TUNING.score.stone * 2 * 2);
  });

  it("tick never drops below the 54 f floor", () => {
    const w = new World({ mode: "endless", seed: 1, sector: 40 });
    expect(w.tickLen).toBe(54);
  });

  it("fairness rejects formations with no sanctuary lane or out of reach", () => {
    const all = Array.from({ length: 7 }, (_, x) => ({ x, z: 0 }));
    expect(checkFormation({ rows: ["FFFFFFF"], connected: all, reach: 3, maxMarks: 2, tickLen: 72 }).fair).toBe(false);
    expect(checkFormation({ rows: ["......S"], connected: [{ x: 0, z: 0 }], reach: 3, maxMarks: 2, tickLen: 72 }).fair).toBe(false);
    expect(checkFormation({ rows: ["S.F.S.."], connected: all, reach: 3, maxMarks: 2, tickLen: 72 }).fair).toBe(true);
  });
});
