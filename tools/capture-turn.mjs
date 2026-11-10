#!/usr/bin/env node
/**
 * Phase 0 exit evidence (GDD §40): capture a Turn rotation from the real build.
 * Replays stage 81's solver witness to just before the Turn, then runs in real time while recording.
 * Output: artifacts/turn/turn.webm + stills. Requires `npm run build`. Not part of `gates`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node-tools/node_modules/playwright"); }
const OUT = "artifacts/turn";
mkdirSync(OUT, { recursive: true });
const PORT = 4181;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { await sleep(250); } }
const witness = JSON.parse(readFileSync("tests/witness/081.json", "utf8"));
const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
try {
  await page.goto(`http://localhost:${PORT}/?stage=81`);
  await page.waitForFunction(() => window.__GAME?.state().phase === "playing");
  // replay the witness up to ~20 frames before the Turn warning (tick 11)
  await page.evaluate((entries) => {
    const g = window.__GAME;
    g.manual(true);
    const byFrame = new Map(entries.map((e) => [e[0], e]));
    while (true) {
      const s = g.state();
      if (s.tick >= 10 && s.frame % s.tickLen > s.tickLen - 30) break;
      const e = byFrame.get(s.frame);
      g.input(e ? { press: e[2], mark: e[3] >= 0 ? { x: e[3], z: e[4] } : undefined, detonate: e[5] === 1, blast: e[6] === 1 } : {});
    }
  }, witness.entries);
  // still frames: sim stepped deterministically; the hinge animation runs on presentation (wall-clock) time
  const stepUntil = (cond) => page.evaluate((c) => {
    const g = window.__GAME;
    for (let i = 0; i < 600; i++) {
      const w = g.game.world;
      if (new Function("w", `return ${c}`)(w)) return w.frame;
      g.stepFrames(1);
    }
    return -1;
  }, cond);
  await page.evaluate(() => window.__GAME.manual(false));
  await sleep(800);
  await page.evaluate(() => window.__GAME.manual(true));
  await page.screenshot({ path: `${OUT}/01-before.png` });
  await stepUntil("w.tick === 11 && w.f > w.tickLen / 2");
  await sleep(500);
  await page.screenshot({ path: `${OUT}/02-warning.png` });
  await stepUntil("w.turning > 0");
  for (const [name, wait] of [["03-turning-start", 80], ["04-turning-mid", 450], ["05-turning-late", 450], ["06-after", 1500]]) {
    await sleep(wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  await page.evaluate(() => window.__GAME.manual(false));
  await sleep(3000);
  await page.screenshot({ path: `${OUT}/07-new-face.png` });
  console.log(JSON.stringify(await page.evaluate(() => { const g = window.__GAME.game; return { tick: g.world.tick, tiles: g.world.grid.size, turns: g.world.turnsDone }; })));
} finally {
  await ctx.close();
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
}
const vid = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== "turn.webm");
if (vid) renameSync(`${OUT}/${vid}`, `${OUT}/turn.webm`);
console.log(errors.length ? `errors: ${errors.join(" | ")}` : "zero console errors");
process.exit(errors.length ? 1 : 0);
