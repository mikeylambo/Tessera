import { it } from "vitest";
import { World } from "../../src/sim/World";
import { Bot } from "../../src/dev/bot";
import { stageById } from "../../src/data/hundred";
it("stage trace", () => {
  const stage = stageById(Number(process.env.STAGE ?? 49))!;
  const w = new World({ mode: "hundred", seed: `stage-${stage.id}`, stage });
  const bot = new Bot("expert", 1);
  const log: string[] = [];
  for (let i = 0; i < 60 * 120 && !w.ended; i++) {
    w.step(bot.think(w));
    for (const e of w.events.drain()) if (!["Tick", "Roll", "Score", "Step", "Blocked"].includes(e.t)) log.push(`f${w.frame} t${w.tick} p(${w.player.x},${w.player.z}) ${JSON.stringify(e)}`);
  }
  console.log(log.slice(0, 30).join("\n"), "\nOUTCOME", JSON.stringify(w.outcome));
});
