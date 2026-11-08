import { it } from "vitest";
import { World } from "../../src/sim/World";
import { input, idle, until } from "../../tests/helpers";
it("phase+iron", () => {
  for (const rows of [["..PP..."], ["..PP...", "...I..."]]) {
    const w = new World({ mode: "sandbox", seed: 1 });
    w.spawnFormation(rows, 1, 6);
    until(w, () => w.cubes.alive().some((c) => c.type === "phase" && c.z === 4));
    const ph = w.cubes.alive().filter((c) => c.type === "phase");
    console.log(JSON.stringify(rows), "phase twins:", ph.map((c) => `${c.id}->${c.twin}@${c.x},${c.z}`).join(" "), "all:", w.cubes.alive().map((c) => `${c.id}${c.type[0]}${c.x},${c.z}`).join(" "));
    w.step(input({ mark: { x: 2, z: 4 } })); idle(w, 5);
    w.step(input({ mark: { x: 3, z: 4 } })); idle(w, 5);
    w.step(input({ detonate: true }));
    console.log("  after detonate:", w.events.drain().filter((e) => ["Kill", "Miss"].includes(e.t)).map((e) => JSON.stringify(e)).join(" "));
  }
});
