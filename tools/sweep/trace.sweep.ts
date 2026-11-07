import { it } from "vitest";
import { World } from "../../src/sim/World";
import { Bot } from "../../src/dev/bot";
it("trace", () => {
  const seed = Number(process.env.SEED ?? 5);
  const w = new World({ mode: "endless", seed });
  const bot = new Bot("competent", 11);
  const snaps: string[] = [];
  const snap = (): string => {
    const rows: string[] = [];
    const pz = w.player.z;
    for (let z = pz + 6; z >= pz - 3; z--) { let r = ""; for (let x = 0; x < 7; x++) { const c = w.cubes.alive().find((c) => c.x === x && c.z === z); r += w.player.x === x && w.player.z === z ? "@" : c ? c.type[0]!.toUpperCase() : w.grid.has(x, z) ? "#" : "."; } rows.push(`${String(z).padStart(3)} ${r}`); }
    return `f${w.frame} t${w.tick}.${w.f} p(${w.player.x},${w.player.z}) ${w.player.state} marks ${JSON.stringify(w.marks.list())}\n${rows.join("\n")}`;
  };
  for (let i = 0; i < 60 * 60 * 15 && !w.ended; i++) {
    const inp = bot.think(w);
    w.step(inp);
    const ev = w.events.drain();
    if (ev.some((e) => e.t === "Crush")) snaps.push("CRUSH\n" + snap());
    if (w.f === 0) snaps.push(snap());
  }
  console.log(snaps.slice(-10).join("\n"));
});
