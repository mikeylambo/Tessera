#!/usr/bin/env node
/**
 * Evidence captures from the real build (GDD §40 Phase 0 exit, §43 five-second clip test). Replays a stage's solver
 * witness to just before a frame, then records video + stills while presentation runs in real time.
 *   node tools/capture.mjs --stage 14 --at 852 --name blast     (Blast terraform)
 *   node tools/capture.mjs --stage 81 --at 864 --name turn      (Turn rotation)
 * Requires `npm run build`. Output: artifacts/<name>/. Not part of `gates`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node-tools/node_modules/playwright"); }
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const stage = Number(arg("stage", "14"));
const at = Number(arg("at", "852"));
const name = arg("name", `stage${stage}`);
/** --best-blast: instead of the witness's timing, wait until the oldest Glyph's 3×3 holds the most cubes, then Blast. */
const bestBlast = process.argv.includes("--best-blast");
const OUT = `artifacts/${name}`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const PORT = 4182;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { await sleep(250); } }
const witness = JSON.parse(readFileSync(`tests/witness/${String(stage).padStart(3, "0")}.json`, "utf8"));
const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const replayTo = (until) => page.evaluate(([entries, until, stopAtGlyph]) => {
  const g = window.__GAME;
  g.manual(true);
  const byFrame = new Map(entries.map((e) => [e[0], e]));
  while (g.state().frame < until && !g.state().ended) {
    if (stopAtGlyph && g.game.world.run.glyphs.length > 0) break;
    const e = byFrame.get(g.state().frame);
    g.input(e ? { press: e[2], mark: e[3] >= 0 ? { x: e[3], z: e[4] } : undefined, detonate: e[5] === 1, blast: e[6] === 1, pick: e[7] } : {});
  }
  return g.state().frame;
}, [witness.entries, until, bestBlast]);
try {
  await page.goto(`http://localhost:${PORT}/?stage=${stage}`);
  await page.waitForFunction(() => window.__GAME?.state().phase === "playing");
  await replayTo(bestBlast ? at - 4 : at - 40);
  await page.evaluate(() => window.__GAME.manual(false));
  await sleep(1200); // settle presentation in real time (camera, effects) while the sim runs a little
  await page.evaluate(() => window.__GAME.manual(true));
  const f0 = await page.evaluate(() => window.__GAME.state().frame);
  if (bestBlast) {
    const caught = await page.evaluate(() => {
      const g = window.__GAME;
      const w = g.game.world;
      const count = () => {
        const gl = w.run.glyphs[0];
        if (!gl) return 0;
        return w.cubes.alive().filter((c) => { const l = w.logical(c); return l && Math.abs(l.x - gl.x) <= 1 && Math.abs(l.z - gl.z) <= 1 && c.type !== "forbidden"; }).length;
      };
      let best = 0;
      for (let i = 0; i < 1500; i++) {
        const n = count();
        best = Math.max(best, n);
        if (n >= 9 || (best >= 6 && n < best)) break;
        g.input({});
      }
      return count();
    });
    console.log("cubes in the Blast's 3x3:", caught);
    await page.screenshot({ path: `${OUT}/01-before.png` });
    await page.evaluate(() => { const g = window.__GAME; g.input({ blast: true }); for (let i = 0; i < 6; i++) g.input({}); });
  } else {
    await replayTo(Math.max(f0, at - 2));
    await page.screenshot({ path: `${OUT}/01-before.png` });
    await replayTo(at + 8); // the event resolves (Blast: 4 f charge)
  }
  for (const [n, wait] of [["02-impact", 30], ["03-ripple", 220], ["04-rise", 320], ["05-settle", 900]]) {
    await sleep(wait);
    await page.screenshot({ path: `${OUT}/${n}.png` });
  }
  await page.evaluate(() => window.__GAME.manual(false));
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/06-after.png` });
} finally {
  await ctx.close();
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
}
const vid = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== `${name}.webm`);
if (vid) renameSync(`${OUT}/${vid}`, `${OUT}/${name}.webm`);
console.log(errors.length ? `errors: ${errors.join(" | ")}` : "zero console errors");
process.exit(errors.length ? 1 : 0);
