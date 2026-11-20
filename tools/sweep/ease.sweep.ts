import { it } from "vitest";
import { World } from "../../src/sim/World";
import { Bot } from "../../src/dev/bot";
import { stageById } from "../../src/data/hundred";
/** Try stage variants under the human bot: STAGE=10 PATCHES='[{"crumble":9},{"objective":{"type":"exit","z":10}}]' */
it("ease", () => {
  const base = stageById(Number(process.env.STAGE))!;
  const patches = JSON.parse(process.env.PATCHES ?? "[{}]") as object[];
  for (const p of patches) {
    const stage = { ...base, ...p };
    let c = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const w = new World({ mode: "hundred", seed: `stage-${stage.id}`, stage });
      const bot = new Bot("human", seed * 7919 + stage.id);
      while (!w.ended && w.frame < 60 * 60 * 4) { w.step(bot.think(w)); w.events.drain(); }
      if (w.outcome?.kind === "clear") c++;
    }
    console.log(`RESULT ${JSON.stringify(p)} ${c * 2}%`);
  }
});
