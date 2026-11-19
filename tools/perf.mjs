#!/usr/bin/env node
/**
 * §36 perf probe: CPU cost per frame (sim step + presentation, measured in-page) during a bot Daily, desktop and
 * mobile emulation (4× CPU throttle). GPU time is NOT measurable here (SwiftShader software GL) — record honestly.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node-tools/node_modules/playwright"); }
const PORT = 4188;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { await sleep(250); } }
const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const probe = async (label, ctxOpts, throttle) => {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/?daily=2026-11-18`, { timeout: 120000 });
  await page.waitForFunction(() => window.__GAME?.state().phase === "playing", null, { timeout: 120000 });
  if (throttle) await (await ctx.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const r = await page.evaluate(() => {
    const g = window.__GAME;
    g.manual(true);
    g.bot.start("expert");
    g.stepFrames(60 * 40);
    g.freezeView(true);
    for (let i = 0; i < 30; i++) g.game.view.frame(0, 1 / 60); // shader compile / warm-up excluded
    const sim = [], frame = [];
    for (let i = 0; i < 600 && !g.state().ended; i++) {
      let t = performance.now();
      g.stepFrames(1);
      sim.push(performance.now() - t);
      t = performance.now();
      g.game.view.frame(0, 1 / 60);
      frame.push(performance.now() - t);
    }
    const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
    const info = g.game.view.scene.renderer.info.render;
    return { simP50: q(sim, 0.5), simP99: q(sim, 0.99), frameP50: q(frame, 0.5), frameP99: q(frame, 0.99), calls: info.calls, heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1e6 : null };
  });
  console.log(label, JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? v : Number(v.toFixed(2))]))));
  await ctx.close();
};
try {
  await probe("desktop 1280x720", { viewport: { width: 1280, height: 720 } }, 0);
  await probe("mobile Pixel 7 (4x CPU throttle)", { ...playwright.devices["Pixel 7"] }, 4);
} finally {
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
}
