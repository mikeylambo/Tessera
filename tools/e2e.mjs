#!/usr/bin/env node
/**
 * Headless boot + E2E smoke (GDD §41). Drives the real production build in Chromium.
 *  1. Boot: Title reached, zero console errors.
 *  2. Title → (first launch) Hundred stage 1 → scripted mark/detonate → cleared → Results.
 *  3. Endless via ?quick&sector=1 → bot to a fall → loss replay → Results → Retry → playing again.
 *  4. Mobile emulation (iPhone 13, Pixel 7): touch boot, swipe step, tap-mark, Detonate button.
 * Screenshots land in artifacts/e2e/.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("/opt/node-tools/node_modules/playwright");
}
const { chromium, devices } = playwright;

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const OUT = "artifacts/e2e";
mkdirSync(OUT, { recursive: true });

const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"];
const failures = [];
const log = (...a) => console.log("[e2e]", ...a);
const check = (cond, msg) => {
  if (cond) log("ok  ", msg);
  else {
    log("FAIL", msg);
    failures.push(msg);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function waitFor(page, fn, timeout = 15000, arg) {
  return page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
}

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "pipe" });
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try {
    const r = await fetch(BASE);
    up = r.ok;
  } catch {
    await sleep(250);
  }
}
if (!up) {
  console.error("[e2e] preview server did not start (did you run `npm run build`?)");
  server.kill();
  process.exit(1);
}

const browser = await chromium.launch({ args: ARGS });
try {
  // ── 1 + 2: boot → title → first launch → Hundred 1 ──────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = watch(page);
    await page.goto(BASE);
    const title = await waitFor(page, () => window.__GAME?.state().phase === "title");
    check(title, "headless boot reaches Title");
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/01-title.png` });
    check(errors.length === 0, `zero console errors at boot (${errors.length}) ${errors.slice(0, 3).join(" | ")}`);

    await page.keyboard.press("Enter");
    const inStage = await waitFor(page, () => window.__GAME.state().phase === "playing" && window.__GAME.state().stage === 1);
    check(inStage, "first launch routes Title → The Hundred stage 1");
    await page.evaluate(() => window.__GAME.manual(true));
    // scripted: wait for the Stone to reach z = 4 (first row beyond the slab), mark it, detonate
    const reached = await page.evaluate(() => {
      const g = window.__GAME;
      for (let i = 0; i < 2000; i++) {
        const c = g.state().cubes[0];
        if (c && c.z === 4) return true;
        g.stepFrames(1);
      }
      return false;
    });
    check(reached, "stage 1 cube rolls to the void edge");
    await sleep(600);
    await page.screenshot({ path: `${OUT}/02-stage1-ghost.png` });
    await page.evaluate(() => {
      const g = window.__GAME;
      g.input({ mark: { x: 3, z: 4 } });
      g.stepFrames(6);
    });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/03-stage1-marked.png` });
    await page.evaluate(() => {
      const g = window.__GAME;
      g.input({ detonate: true });
    });
    await sleep(250);
    await page.screenshot({ path: `${OUT}/04-stage1-kill.png` });
    const cleared = await page.evaluate(() => {
      const g = window.__GAME;
      g.stepFrames(30);
      const s = g.state();
      return { tile: s.tiles, outcome: s.outcome && s.outcome.kind, kills: s.kills };
    });
    check(cleared.kills === 1 && cleared.tile === 29, `kill became ground (tiles ${cleared.tile})`);
    check(cleared.outcome === "clear", `stage 1 cleared (${cleared.outcome})`);
    const results = await waitFor(page, () => window.__GAME.state().screen === "results", 5000);
    check(results, "stage clear → Results");
    await sleep(700);
    await page.screenshot({ path: `${OUT}/05-stage1-results.png` });
    check(errors.length === 0, `zero console errors through stage 1 (${errors.slice(0, 3).join(" | ")})`);
    await page.close();
  }

  // ── 3: Endless → fall → loss replay → results → retry ──────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = watch(page);
    await page.goto(`${BASE}?quick&sector=1&seed=1`);
    const playing = await waitFor(page, () => window.__GAME?.state().phase === "playing" && window.__GAME.state().mode === "endless");
    check(playing, "?quick&sector=1 starts Endless");
    await page.evaluate(() => {
      window.__GAME.manual(true);
      window.__GAME.bot.start("novice");
    });
    const fell = await page.evaluate(() => {
      const g = window.__GAME;
      for (let i = 0; i < 400; i++) {
        g.stepFrames(120);
        if (g.state().phase !== "playing") return g.state().phase;
      }
      return g.state().phase;
    });
    check(fell === "replay", `novice bot falls → loss replay (${fell})`);
    await page.evaluate(() => window.__GAME.bot.stop());
    await sleep(900);
    await page.screenshot({ path: `${OUT}/06-loss-replay.png` });
    const res = await waitFor(page, () => window.__GAME.state().screen === "results", 15000);
    check(res, "loss replay → Results");
    await sleep(500);
    await page.screenshot({ path: `${OUT}/07-results.png` });
    await page.keyboard.press("Enter"); // Retry is focused first
    const again = await waitFor(page, () => window.__GAME.state().phase === "playing" && window.__GAME.state().frame < 600, 5000);
    check(again, "Retry → playing again");
    await page.evaluate(() => window.__GAME.manual(false));
    await sleep(1500);
    const advancing = await page.evaluate(() => window.__GAME.state().frame);
    check(advancing > 10, `realtime loop advances the sim (${advancing} frames)`);
    // pause via Escape
    await page.keyboard.press("Escape");
    const paused = await waitFor(page, () => window.__GAME.state().phase === "paused", 3000);
    check(paused, "Escape pauses");
    await page.screenshot({ path: `${OUT}/08-pause.png` });
    check(errors.length === 0, `zero console errors through Endless (${errors.slice(0, 3).join(" | ")})`);
    await page.close();
  }

  // ── 4: mobile emulation with touch ──────────────────────────────────────
  for (const name of ["iPhone 13", "Pixel 7"]) {
    const ctx = await browser.newContext({ ...devices[name] });
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(`${BASE}?quick&sector=1&seed=2`);
    const ok = await waitFor(page, () => window.__GAME?.state().phase === "playing");
    check(ok, `${name}: boots into play`);
    const box = await page.locator("#game-canvas").boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height * 0.75;
    // swipe up = step forward (one tile)
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    const z0 = await page.evaluate(() => window.__GAME.state().player.z);
    await touch("touchStart", cx, cy);
    await touch("touchMove", cx, cy - 40);
    await touch("touchEnd", cx, cy - 40);
    await sleep(500);
    const z1 = await page.evaluate(() => window.__GAME.state().player.z);
    check(z1 === z0 + 1, `${name}: swipe steps one tile (${z0} → ${z1})`);
    // tap a cell ahead to mark
    await sleep(300);
    const pt = await page.evaluate(() => { const s = window.__GAME.state(); return window.__GAME.cellToScreen(s.player.x, s.player.z + 2); });
    await touch("touchStart", pt.x, pt.y);
    await touch("touchEnd", pt.x, pt.y);
    await sleep(300);
    const marks = await page.evaluate(() => window.__GAME.state().marks.length);
    check(marks === 1, `${name}: tap marks a cell (${marks})`);
    const btn = page.locator(".t-btn:not(.small)");
    check(await btn.isVisible(), `${name}: Detonate thumb button visible`);
    const bb = await btn.boundingBox();
    check(bb && bb.width >= 48 && bb.height >= 48, `${name}: touch target ≥ 48 px`);
    await btn.tap();
    await sleep(300);
    const marksAfter = await page.evaluate(() => window.__GAME.state().marks.length);
    check(marksAfter === 0, `${name}: Detonate button fires marks`);
    await page.screenshot({ path: `${OUT}/09-mobile-${name.replace(/\s/g, "")}.png` });
    check(errors.length === 0, `${name}: zero console errors (${errors.slice(0, 3).join(" | ")})`);
    await ctx.close();
  }
} catch (e) {
  failures.push(`exception: ${e && e.stack ? e.stack : e}`);
  console.error(e);
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`[e2e] ${failures.length} failure(s):\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
log("all browser gates passed; screenshots in", OUT);
