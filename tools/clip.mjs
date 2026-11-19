#!/usr/bin/env node
/**
 * Feel evidence (brief §2.7): a ~20 s gameplay clip WITH AUDIO of the expert bot on a Daily seed, recorded in-page
 * (canvas.captureStream + the final WebAudio mix via MediaRecorder). Requires `npm run build`. Not part of gates.
 *   node tools/clip.mjs --day 2026-11-19 --seconds 20 --out docs/evidence/feel/daily-bot.webm
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node-tools/node_modules/playwright"); }
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const day = arg("day", new Date().toISOString().slice(0, 10));
const seconds = Number(arg("seconds", "20"));
const warm = Number(arg("warm", "8"));
const out = arg("out", "docs/evidence/feel/daily-bot.webm");
const W = Number(arg("w", "960"));
const H = Number(arg("h", "540"));
const PORT = 4184;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { await sleep(250); } }
const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const start = async () => {
  await page.goto(`http://localhost:${PORT}/?daily=${day}`);
  await page.waitForFunction(() => window.__GAME?.state().phase === "playing", null, { timeout: 30000 });
  // build ground deterministically first (the bot plays warm×60 frames off-clock)
  return page.evaluate((n) => { const g = window.__GAME; g.manual(true); g.bot.start("expert"); g.stepFrames(n); return g.state().frame; }, warm * 60);
};
const tmp = "artifacts/clip";
mkdirSync(`${tmp}/frames`, { recursive: true });
try {
  // pass 1 — audio: rendering frozen so sim + audio run at true 60 Hz even under software GL
  const f0 = await start();
  const audio = await page.evaluate(async (ms) => {
    const g = window.__GAME;
    g.freezeView(true);
    g.game.audio.unlock();
    const p = g.recordClip(ms);
    g.manual(false);
    const url = await p;
    g.manual(true);
    return { url, frame: g.state().frame };
  }, seconds * 1000);
  if (!audio.url) throw new Error("no audio");
  writeFileSync(`${tmp}/audio.webm`, Buffer.from(audio.url.split(",")[1], "base64"));
  const n = audio.frame - f0;
  console.log(`audio pass: ${n} sim frames in ${seconds} s (${(n / seconds).toFixed(1)} fps)`);
  // pass 2 — video: the identical deterministic run, rendered frame-exact at 60 Hz
  const f1 = await start();
  if (f1 !== f0) throw new Error(`start mismatch ${f0} vs ${f1}`);
  await page.evaluate(() => window.__GAME.freezeView(true));
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.__GAME.advance(1));
    await page.screenshot({ path: `${tmp}/frames/${String(i).padStart(5, "0")}.png` });
  }
  const st = await page.evaluate(() => window.__GAME.state());
  mkdirSync(dirname(out), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "60", "-i", `${tmp}/frames/%05d.png`, "-i", `${tmp}/audio.webm`, "-c:v", "libvpx-vp9", "-b:v", "4M", "-c:a", "libopus", "-shortest", out]);
  console.log(`clip ${out}: ${n} frames, depth ${st.depth}, score ${st.score}, kills ${st.kills}`);
} finally {
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
}
console.log(errors.length ? `errors: ${errors.join(" | ")}` : "zero page errors");
