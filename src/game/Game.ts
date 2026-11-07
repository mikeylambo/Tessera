import { World, type WorldConfig } from "../sim/World";
import { InputRecorder, InputPlayer, resimulate } from "../sim/Replay";
import { NO_INPUT, type FrameInput } from "../sim/types";
import type { SimEvent } from "../sim/Events";
import { STAGES, stageById, ACTS } from "../data/hundred";
import { runeById, type RuneId } from "../data/runes";
import { TUNING } from "../data/tuning";
import { WorldView } from "../render/three/View";
import { Devices } from "../input/Devices";
import { AudioEngine } from "../audio/Engine";
import { Music } from "../audio/Music";
import { Sfx } from "../audio/Sfx";
import { Ui, type MenuItem } from "../ui/Ui";
import { ProfileStore, type TesseraSettings } from "../platform/web/profile";
import { BrowserHaptics } from "@slu/web-shell";
import { Bot, type BotLevel } from "../dev/bot";

export type Phase = "boot" | "title" | "menu" | "playing" | "paused" | "runes" | "replay" | "results";

const LINES = { tessera: "Tessera.", beautiful: "Beautiful.", holdOn: "Hold on.", purified: "Purified.", again: "Again." } as const;

/** Mobile vibration only; gamepad rumble comes from the Feel Kit impact bundles (weak/strong 0 here). */
const HAPTICS = {
  kill: { mobile: 60, duration: 60, weak: 0, strong: 0 },
  chain: { mobile: 120, duration: 120, weak: 0, strong: 0 },
  blast: { mobile: [250], duration: 250, weak: 0, strong: 0 },
  crush: { mobile: 180, duration: 180, weak: 0, strong: 0 },
  crumble: { mobile: 400, duration: 400, weak: 0, strong: 0 }
};

export interface UrlFlags {
  stage: number | null;
  sector: number | null;
  seed: string | null;
  quick: boolean;
  daily: string | null;
  playtest: boolean;
  headless: boolean;
}

export function readFlags(search: string): UrlFlags {
  const q = new URLSearchParams(search);
  const num = (k: string) => (q.has(k) ? Number(q.get(k)) : null);
  return { stage: num("stage"), sector: num("sector"), seed: q.get("seed"), quick: q.has("quick"), daily: q.get("daily"), playtest: q.has("playtest"), headless: q.has("headless") };
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Owns the loop and the screen flow (GDD §20). The sim is stepped at a fixed 60 Hz; render interpolates. */
export class Game {
  phase: Phase = "boot";
  world: World | null = null;
  readonly view: WorldView;
  readonly devices: Devices;
  readonly audio = new AudioEngine();
  readonly music: Music;
  readonly sfx: Sfx;
  readonly ui: Ui;
  readonly profile = new ProfileStore();
  readonly haptics = new BrowserHaptics(HAPTICS);
  readonly recorder = new InputRecorder();
  private acc = 0;
  private last = 0;
  private alpha = 0;
  private config: WorldConfig | null = null;
  private replay: { world: World; player: InputPlayer; end: number; speed: number; acc: number; cause: string } | null = null;
  private pendingPick = -1;
  private formationsSeen = 0;
  private ranked = false;
  private fps = { frames: 0, t: 0, value: 0, worst: 0 };
  private bot: Bot | null = null;
  private stepsThisRun = 0;
  touch = false;
  private vibration = false;
  readonly flags: UrlFlags;
  /** Paused externally for deterministic stepping (window.__GAME.stepFrames). */
  manual = false;
  lastEvents: SimEvent[] = [];

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, flags: UrlFlags) {
    this.flags = flags;
    this.touch = matchMedia("(pointer: coarse)").matches;
    this.view = new WorldView(canvas, this.touch);
    this.ui = new Ui(uiRoot);
    this.music = new Music(this.audio);
    this.sfx = new Sfx(this.audio);
    this.ui.onNav = (k) => this.sfx.ui(k);
    this.devices = new Devices(canvas, {
      pick: (x, y) => this.view.pick(x, y),
      player: () => (this.world ? { x: this.world.player.x, z: this.world.player.z, facing: this.world.player.facing } : { x: 3, z: 1, facing: 1 }),
      reach: () => this.world?.reach ?? TUNING.reach.radius
    });
    this.devices.enabled = false;
    this.devices.onPause = () => this.togglePause();
    this.devices.onAny = (f) => {
      const touch = f === "touch";
      if (touch !== this.touch) {
        this.touch = touch;
        this.ui.showHud(this.phase === "playing", this.touch);
      }
    };
    this.ui.detBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.devices.pressDetonate();
    });
    this.ui.blastBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.devices.pressBlast();
    });
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.suspend();
        if (this.phase === "playing") this.pause();
      }
    });
    window.addEventListener("pagehide", () => this.suspend());
    window.addEventListener("gamepaddisconnected", () => {
      if (this.phase === "playing") this.pause();
    });
    window.addEventListener("blur", () => {
      if (this.phase === "playing" && !this.flags.headless && !this.manual) this.pause();
    });
    this.resize();
  }

  async boot(): Promise<void> {
    await this.profile.load();
    this.applySettings(this.profile.settings.snapshot());
    this.profile.settings.events.on("changed", (s) => this.applySettings(s));
    if (this.profile.notice) this.ui.notice(this.profile.notice);
    // idle world behind the title: the slab floats in the fog
    this.world = new World({ mode: "sandbox", seed: 1 });
    this.view.attach(this.world);
    this.loop();
    const f = this.flags;
    const unlockOnGesture = () => this.audio.unlock();
    window.addEventListener("pointerdown", unlockOnGesture, { once: true });
    window.addEventListener("keydown", unlockOnGesture, { once: true });
    if (f.quick || f.stage || f.sector || f.daily) {
      if (f.stage) this.startStage(f.stage);
      else if (f.daily) this.startDaily(f.daily, false);
      else this.startEndless(f.sector ?? 1, f.seed ?? undefined);
      return;
    }
    this.showTitle();
  }

  private applySettings(s: TesseraSettings): void {
    this.audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume, voice: s.voiceVolume, ui: s.uiVolume, muted: s.muted });
    this.view.configure({ reducedMotion: s.reducedMotion, reduceFlashes: s.reduceFlashes, shake: s.screenShake, ghosts: s.hintSigils && !this.profile.data.onboarding.retired, vibration: s.vibration });
    this.vibration = s.vibration;
    if (s.vibration) this.haptics.setEnabled(true);
    this.ui.setScale(s.uiScale);
    document.body.classList.toggle("hc", s.highContrast);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.view.scene.resize(w, h);
    this.view.feel.portrait = h > w;
  }

  // ───────────────────────────────── loop ─────────────────────────────────

  private loop = (): void => {
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.tick(dt);
    if (this.flags.headless) window.setTimeout(this.loop, 16);
    else requestAnimationFrame(this.loop);
  };

  private tick(dt: number): void {
    this.ui.pollPad();
    if (this.phase === "runes" && this.bot && !this.manual) this.pickRune(0);
    if (this.phase === "playing" && this.world && !this.manual) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 6) {
        this.acc -= 1 / 60;
        this.stepOnce();
        steps++;
        if (this.phase !== "playing") break;
      }
      if (steps === 6) this.acc = 0;
      this.alpha = Math.max(0, Math.min(1, this.acc * 60));
    } else if (this.phase === "replay") this.stepReplay(dt);
    this.view.cursor = this.phase === "playing" ? this.devices.visibleCursor() : null;
    this.view.frame(this.phase === "playing" ? this.alpha : 0, dt);
    const w = this.phase === "replay" ? this.replay?.world : this.world;
    if (w && (this.phase === "playing" || this.phase === "replay")) {
      this.music.update({ frame: w.frame, alpha: this.alpha, tick: w.tick, f: w.f, tickLen: w.tickLen, formationsSeen: this.formationsSeen, groundRows: this.groundRows(w), lastStand: w.lastStand.active });
      this.updateHud(w);
    }
    this.sampleFps(dt);
  }

  /** One fixed sim step with the live input (or the bot's). */
  stepOnce(): void {
    const w = this.world;
    if (!w) return;
    let input: FrameInput = this.bot ? this.bot.think(w) : this.devices.frame();
    if (this.pendingPick >= 0) {
      input = { ...input, pick: this.pendingPick };
      this.pendingPick = -1;
    }
    this.recorder.record(w.frame, input);
    w.step(input);
    this.stepsThisRun++;
    const events = w.events.drain();
    this.lastEvents = events;
    this.onEvents(events, w);
    if (w.runeOffers && this.phase === "playing") this.openRunes();
    if (w.ended) this.onRunEnded();
  }

  private onEvents(events: SimEvent[], w: World): void {
    this.view.handle(events);
    this.sfx.handle(events, { frame: w.frame, alpha: this.alpha, f: w.f, tickLen: w.tickLen });
    const s = this.profile.settings.snapshot();
    for (const e of events) {
      if (e.t === "Announce") {
        this.ui.subtitle(LINES[e.line], s.subtitles, e.line === "again");
      } else if (e.t === "CubeSpawn" && e.id && events.indexOf(e) === events.findIndex((x) => x.t === "CubeSpawn")) this.formationsSeen++;
      else if (e.t === "Kill") this.buzz(e.chain >= 3 ? "chain" : "kill");
      else if (e.t === "Blast") this.buzz("blast");
      else if (e.t === "Crush") this.buzz("crush");
      else if (e.t === "Crumble") this.buzz("crumble");
      else if (e.t === "MarkPlaced") this.profile.data.onboarding.markSuccess++;
      else if (e.t === "Detonate" && e.marks > 0) this.profile.data.onboarding.detonateSuccess++;
      else if (e.t === "SectorStart" && e.sector > 1) this.music.resetClock();
    }
    const ob = this.profile.data.onboarding;
    if (!ob.retired && ob.markSuccess >= 2 * TUNING.onboarding.ghostRetireSuccesses && ob.detonateSuccess >= TUNING.onboarding.ghostRetireSuccesses && this.world?.config.stage && this.world.config.stage.id > 3) {
      ob.retired = true;
    }
  }

  private buzz(id: keyof typeof HAPTICS): void {
    if (this.vibration) this.haptics.pulse(id);
  }

  private groundRows(w: World): number {
    const rows = new Set(w.connected().map((t) => t.z));
    return rows.size;
  }

  private updateHud(w: World): void {
    const mode = w.config.mode;
    const depth = Math.max(0, w.depthRow);
    const sector = mode === "hundred" ? `${String(w.config.stage?.id ?? 0).padStart(3, "0")} · ${w.config.stage?.name.toUpperCase() ?? ""}` : `SECTOR ${w.sector} · DEPTH ${depth}`;
    this.ui.setHud({ sector, score: w.score.total, runes: w.run.runes.map((r) => runeById(r).glyph), glyphs: w.run.glyphs.length });
    if (this.flags.playtest) {
      const fair = w.lastFairness ? `${w.lastFairness.id} ${w.lastFairness.reason} ×${w.lastFairness.attempts}` : "-";
      this.ui.overlay(`fps ${this.fps.value.toFixed(0)} (worst ${this.fps.worst.toFixed(1)} ms)\nframe ${w.frame} tick ${w.tick}.${w.f}/${w.tickLen}\ncubes ${w.cubes.count} ground ${w.connected().length}\ncrumble ${w.crumble.counter}/${w.crumbleInterval()}\nfair ${fair}\nhash ${w.stateHash().slice(0, 8)}`);
    }
  }

  private sampleFps(dt: number): void {
    this.fps.frames++;
    this.fps.t += dt;
    this.fps.worst = Math.max(this.fps.worst, dt * 1000);
    if (this.fps.t >= 1) {
      this.fps.value = this.fps.frames / this.fps.t;
      this.fps.frames = 0;
      this.fps.t = 0;
      this.fps.worst = 0;
    }
  }

  // ───────────────────────────────── runs ─────────────────────────────────

  private begin(config: WorldConfig, ranked = false): void {
    this.config = config;
    this.ranked = ranked;
    this.world = new World(config);
    this.view.attach(this.world);
    this.recorder.reset();
    this.formationsSeen = 0;
    this.stepsThisRun = 0;
    this.acc = 0;
    this.pendingPick = -1;
    this.devices.clear();
    this.devices.enabled = true;
    this.ui.hide();
    this.ui.showHud(true, this.touch);
    this.phase = "playing";
    this.music.resetClock();
    this.music.setState("play");
    if (config.mode === "hundred" && config.stage?.id === 1) this.ui.subtitle(LINES.tessera, this.profile.settings.snapshot().subtitles, true);
  }

  startStage(id: number): void {
    const stage = stageById(id) ?? STAGES[0]!;
    this.begin({ mode: "hundred", seed: `stage-${stage.id}`, stage, assist: this.profile.settings.snapshot().assistSpeed });
  }

  startEndless(sector = 1, seed?: string): void {
    const s = seed ?? `${Date.now() % 1e9}`;
    this.begin({ mode: "endless", seed: s, sector, assist: this.profile.settings.snapshot().assistSpeed });
  }

  startDaily(day = utcDay(), allowRanked = true): void {
    const ranked = allowRanked && !this.profile.data.dailyRanked[day];
    this.begin({ mode: "daily", seed: `DAILY-${day}` }, ranked);
  }

  /** Dev/test: let a bot drive through the same input layer. */
  setBot(level: BotLevel | null): void {
    this.bot = level ? new Bot(level, 11) : null;
  }

  private onRunEnded(): void {
    const w = this.world!;
    this.devices.enabled = false;
    this.profile.data.suspended = null;
    if (w.outcome?.kind === "clear") {
      this.recordStage(w);
      void this.profile.save();
      window.setTimeout(() => this.showResults(), 500);
      this.phase = "results";
      return;
    }
    this.recordBest(w);
    void this.profile.save();
    this.music.setState("fall");
    this.startLossReplay(w);
  }

  private recordStage(w: World): void {
    const s = w.config.stage;
    if (!s) return;
    const prev = this.profile.data.hundred[s.id];
    const rating = w.rating();
    this.profile.data.hundred[s.id] = { rating: Math.max(prev?.rating ?? 0, rating), bestMarks: Math.min(prev?.bestMarks ?? Infinity, w.marksPlaced) };
  }

  private recordBest(w: World): void {
    const p = this.profile.data;
    if (w.config.mode === "endless" || w.config.mode === "daily") {
      p.bestDepth = Math.max(p.bestDepth, w.depthRow);
      p.bestScore = Math.max(p.bestScore, w.score.total);
      for (const [d, name] of [[100, "dawn"], [250, "rust"], [500, "abyssal"]] as const) if (w.depthRow >= d && !p.palettes.includes(name)) p.palettes.push(name);
    }
    if (w.config.mode === "daily" && this.ranked) {
      const day = String(w.config.seed).replace("DAILY-", "");
      p.dailyRanked[day] = { score: w.score.total, depth: w.depthRow };
      // offline-first queue; submitted with the input log for replay validation once leaderboards are online
      p.pendingSubmissions.push({ mode: "daily", seed: String(w.config.seed), score: w.score.total, depth: w.depthRow, frames: w.frame, entries: this.recorder.entries });
    }
  }

  // ───────────────────────────────── loss replay ─────────────────────────────────

  /** 3 s slow-motion, high-angle replay of the moments before the fall, cause highlighted, skippable (GDD §22). */
  private startLossReplay(w: World): void {
    const end = w.outcome?.frame ?? w.frame;
    // 3 s of wall time at 0.4× covers the last 72 frames: 60 before the fall, 12 after (GDD §22)
    const start = Math.max(0, end - 60);
    const cfg = this.config!;
    let rw: World;
    try {
      rw = resimulate(cfg, this.recorder.entries, start);
    } catch {
      this.showResults();
      return;
    }
    const player = new InputPlayer(this.recorder.entries.filter((e) => e[0] >= rw.frame));
    rw.events.drain();
    this.view.attach(rw);
    this.view.feel.extraUp = 0;
    this.replay = { world: rw, player, end: end + 12, speed: 0.4, acc: 0, cause: this.describeCause(w) };
    this.phase = "replay";
    this.replayLast = 0;
    this.ui.showHud(false, false);
    this.ui.show({
      id: "replay",
      className: "clear",
      items: [],
      body: `<div class="why">${this.replay.cause}</div>`,
      onPick: () => this.skipReplay(),
      onBack: () => this.skipReplay()
    });
    const skip = () => this.skipReplay();
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    this.replaySkip = () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }

  private replaySkip: (() => void) | null = null;
  private replayLast = 0;

  private describeCause(w: World): string {
    const o = w.outcome;
    if (!o) return "";
    if (o.kind === "fail") return "A pale cube slipped past";
    if (o.kind !== "fall") return "";
    switch (o.cause) {
      case "shoved":
        return "Crushed off the edge";
      case "crumble":
        return w.lastCause?.kind === "escape" ? "A pale cube slipped past · the ground gave way" : "The ground behind fell away";
      case "glass":
        return "The glass shattered";
      case "scar":
        return "A scar opened beneath";
      default:
        return "Nothing beneath";
    }
  }

  private stepReplay(_dt: number): void {
    const r = this.replay;
    if (!r) return;
    // wall-clock driven so the replay is always 3 s, whatever the render framerate
    const now = performance.now();
    const real = this.replayLast ? (now - this.replayLast) / 1000 : 0;
    this.replayLast = now;
    r.acc += real * 60 * r.speed;
    while (r.acc >= 1) {
      r.acc -= 1;
      if (r.world.frame >= r.end || r.world.ended) {
        this.skipReplay();
        return;
      }
      r.world.step(r.player.next(r.world.frame));
      const ev = r.world.events.drain().filter((e) => e.t !== "Announce");
      this.view.handle(ev);
    }
    this.alpha = r.acc;
    this.view.feel.extraUp = 8;
  }

  skipReplay(): void {
    if (this.phase !== "replay") return;
    this.replaySkip?.();
    this.replaySkip = null;
    this.replay = null;
    this.view.feel.extraUp = 0;
    if (this.world) this.view.attach(this.world);
    this.showResults();
  }

  // ───────────────────────────────── pause / suspend ─────────────────────────────────

  togglePause(): void {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") this.resume();
  }

  pause(): void {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.devices.enabled = false;
    this.audio.suspend();
    this.showPause();
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.audio.unlock();
    this.ui.hide();
    this.phase = "playing";
    this.devices.clear();
    this.devices.enabled = true;
    this.audio.resume();
    this.last = performance.now();
  }

  /** Mobile suspend: the run is (seed, input log, frame) — re-simulation restores it exactly (GDD §20, decision 23). */
  suspend(): void {
    const w = this.world;
    if (!w || !this.config || w.ended || !(this.phase === "playing" || this.phase === "paused" || this.phase === "runes")) return;
    const { stage, ...rest } = this.config;
    this.profile.data.suspended = { config: { ...rest, stageId: stage?.id }, entries: this.recorder.entries.slice(), frame: w.frame, hash: w.stateHash(), savedAt: new Date().toISOString() };
    void this.profile.save();
  }

  resumeSuspended(): boolean {
    const s = this.profile.data.suspended;
    if (!s) return false;
    const stage = s.config.stageId ? stageById(s.config.stageId) : undefined;
    const config: WorldConfig = { ...s.config, stage };
    const w = resimulate(config, s.entries, s.frame);
    const ok = w.stateHash() === s.hash;
    this.config = config;
    this.world = w;
    w.events.drain();
    this.view.attach(w);
    this.recorder.reset();
    this.recorder.entries = s.entries.slice();
    this.formationsSeen = 3;
    this.ui.showHud(true, this.touch);
    this.music.resetClock();
    this.music.setState("play");
    this.phase = "playing";
    this.pause();
    if (!ok) this.ui.notice("Resumed (state check mismatch logged).");
    return ok;
  }

  // ───────────────────────────────── screens ─────────────────────────────────

  private showTitle(): void {
    this.phase = "title";
    this.ui.showHud(false, false);
    this.ui.show({ id: "title", title: "TESSERA", items: [], body: `<div class="t-press">Press any key</div>`, onPick: () => this.leaveTitle() });
    const go = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.repeat || e.code === "F12")) return;
      window.removeEventListener("keydown", go);
      window.removeEventListener("pointerdown", go);
      this.leaveTitle();
    };
    window.addEventListener("keydown", go);
    window.addEventListener("pointerdown", go);
  }

  private leaveTitle(): void {
    if (this.phase !== "title") return;
    this.audio.unlock();
    this.music.setState("title");
    this.sfx.ui("confirm");
    if (this.profile.data.suspended) {
      this.showMenu();
      return;
    }
    if (!this.profile.data.firstLaunchDone) {
      // first launch → The Hundred, stage 1, directly (GDD §20, decision 21)
      this.profile.data.firstLaunchDone = true;
      void this.profile.save();
      this.startStage(1);
      return;
    }
    this.showMenu();
  }

  showMenu(): void {
    this.phase = "menu";
    this.devices.enabled = false;
    this.ui.showHud(false, false);
    this.music.setState("title");
    const unlocked = this.profile.actOneCleared;
    const items: MenuItem[] = [];
    if (this.profile.data.suspended) items.push({ id: "resume", label: "Resume" });
    items.push(
      { id: "hundred", label: "The Hundred", detail: `${Object.keys(this.profile.data.hundred).length} / 100` },
      { id: "endless", label: "Endless", detail: unlocked ? (this.profile.data.bestDepth ? `depth ${this.profile.data.bestDepth}` : "") : "after Act I", disabled: !unlocked },
      { id: "daily", label: "Daily Tessera", detail: unlocked ? utcDay() : "after Act I", disabled: !unlocked },
      { id: "settings", label: "Settings" },
      { id: "credits", label: "Credits" }
    );
    this.ui.show({
      id: "menu",
      title: "TESSERA",
      items,
      onPick: (id) => {
        if (id === "resume") this.resumeSuspended();
        else if (id === "hundred") this.showHundred();
        else if (id === "endless") this.startEndless();
        else if (id === "daily") this.startDaily();
        else if (id === "settings") this.showSettings(() => this.showMenu());
        else if (id === "credits") this.showCredits();
      }
    });
  }

  private showHundred(): void {
    const done = this.profile.data.hundred;
    const glyph = ["", "◇", "◆", "✦"];
    const act = ACTS[0];
    const items: MenuItem[] = STAGES.map((s) => {
      const prevCleared = s.id === 1 || !!done[s.id - 1];
      const skipAvail = this.profile.data.skips > 0;
      return { id: String(s.id), label: String(s.id).padStart(3, "0"), detail: glyph[done[s.id]?.rating ?? 0] || "·", disabled: !prevCleared && !skipAvail };
    });
    this.ui.show({
      id: "hundred",
      title: `I · ${act.name.toUpperCase()}`,
      subtitle: `Stages ${act.first}–${act.last} · ${this.profile.data.skips} skips`,
      layout: "grid",
      items,
      onPick: (id) => {
        const n = Number(id);
        if (n > 1 && !done[n - 1]) {
          this.profile.data.skips = Math.max(0, this.profile.data.skips - 1);
          void this.profile.save();
        }
        this.startStage(n);
      },
      onBack: () => this.showMenu()
    });
  }

  private showPause(): void {
    this.ui.show({
      id: "pause",
      title: "PAUSED",
      subtitle: this.world?.run.runes.length ? this.world.run.runes.map((r) => `${runeById(r).glyph} ${runeById(r).name}: ${runeById(r).effect}`).join("  ·  ") : undefined,
      items: [
        { id: "resume", label: "Resume" },
        { id: "restart", label: "Restart" },
        { id: "settings", label: "Settings" },
        { id: "quit", label: "Quit" }
      ],
      onPick: (id) => {
        if (id === "resume") this.resume();
        else if (id === "restart") this.confirm("Restart this run?", () => this.retry(), () => this.showPause());
        else if (id === "settings") this.showSettings(() => this.showPause());
        else if (id === "quit") this.confirm("Leave this run?", () => {
          this.profile.data.suspended = null;
          void this.profile.save();
          this.audio.resume();
          this.showMenu();
        }, () => this.showPause());
      },
      onBack: () => this.resume()
    });
  }

  private confirm(question: string, yes: () => void, no: () => void): void {
    this.ui.show({ id: "confirm", title: question, items: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }], onPick: (id) => (id === "yes" ? yes() : no()), onBack: no });
  }

  private showSettings(back: () => void): void {
    const st = this.profile.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const slider = (key: "masterVolume" | "musicVolume" | "sfxVolume" | "voiceVolume", label: string): MenuItem => ({
      id: key,
      label,
      detail: `<span class="adj">◂ ${pct(st.snapshot()[key])} ▸</span>`,
      adjust: (d) => {
        void st.patch({ [key]: Math.max(0, Math.min(1, Math.round((st.snapshot()[key] + d * 0.1) * 10) / 10)) } as Partial<TesseraSettings>);
        this.showSettings(back);
      }
    });
    const toggle = (key: "reducedMotion" | "reduceFlashes" | "subtitles" | "hintSigils" | "assistSpeed" | "vibration" | "highContrast" | "muted", label: string): MenuItem => ({
      id: key,
      label,
      detail: `<span class="adj">${st.snapshot()[key] ? "On" : "Off"}</span>`,
      adjust: () => {
        void st.patch({ [key]: !st.snapshot()[key] } as Partial<TesseraSettings>);
        this.showSettings(back);
      }
    });
    const s = st.snapshot();
    this.ui.show({
      id: "settings",
      title: "SETTINGS",
      items: [
        slider("masterVolume", "Master"),
        slider("musicVolume", "Music"),
        slider("sfxVolume", "Effects"),
        slider("voiceVolume", "Voice"),
        toggle("subtitles", "Subtitles"),
        toggle("reducedMotion", "Reduced motion"),
        toggle("reduceFlashes", "Reduce flashes"),
        { id: "shake", label: "Screen shake", detail: `<span class="adj">◂ ${pct(s.screenShake)} ▸</span>`, adjust: (d) => { void st.patch({ screenShake: Math.max(0, Math.min(1, s.screenShake + d * 0.25)) }); this.showSettings(back); } },
        toggle("hintSigils", "Hint sigils"),
        toggle("assistSpeed", "Assist speed"),
        toggle("highContrast", "High contrast"),
        toggle("vibration", "Vibration"),
        { id: "scale", label: "UI scale", detail: `<span class="adj">◂ ${s.uiScale}% ▸</span>`, adjust: (d) => { const o = [100, 125, 150] as const; const i = Math.max(0, Math.min(2, o.indexOf(s.uiScale) + d)); void st.patch({ uiScale: o[i] }); this.showSettings(back); } },
        { id: "reset", label: "Reset progress" },
        { id: "back", label: "Back" }
      ],
      onPick: (id) => {
        if (id === "back") back();
        else if (id === "reset")
          this.confirm("Erase all progress?", () => this.confirm("This cannot be undone. Erase?", () => {
            void this.profile.saves.delete().then(() => this.profile.load()).then(() => back());
          }, () => this.showSettings(back)), () => this.showSettings(back));
      },
      onBack: back
    });
  }

  private showCredits(): void {
    this.ui.show({
      id: "credits",
      title: "TESSERA",
      subtitle: "Wavelength Game Design",
      body: "Design · Michael<br>Built with Claude on the SLU Web Shell<br>Three.js · Cinzel · JetBrains Mono",
      items: [{ id: "back", label: "Back" }],
      onPick: () => this.showMenu(),
      onBack: () => this.showMenu()
    });
  }

  private openRunes(): void {
    const w = this.world!;
    const offers = w.runeOffers;
    if (!offers) return;
    this.phase = "runes";
    this.devices.enabled = false;
    this.ui.showHud(true, false);
    this.ui.show({
      id: "runes",
      title: `SECTOR ${w.sector} · CLEAR`,
      subtitle: w.pendingPicks > 1 ? "Choose two" : "Choose one",
      layout: "cards",
      className: "clear",
      items: offers.map((id: RuneId, i) => {
        const r = runeById(id);
        return { id: String(i), label: `<span class="g">${r.glyph}</span>${r.name}`, detail: r.effect };
      }),
      onPick: (id) => this.pickRune(Number(id))
    });
  }

  /** Results lead with something done well before the score (GDD §22). */
  private showResults(): void {
    const w = this.world!;
    this.phase = "results";
    this.devices.enabled = false;
    this.ui.showHud(false, false);
    this.music.setState("results");
    const best = (() => {
      if (w.purifies) return "You purified the ground.";
      if (w.score.bestChain >= 3) return `A chain of ${w.score.bestChain}.`;
      if (w.perfectSectors) return `${w.perfectSectors} perfect sector${w.perfectSectors > 1 ? "s" : ""}.`;
      if (w.islands) return `${w.islands} island${w.islands > 1 ? "s" : ""} raised from the void.`;
      if (w.beaconsCollected) return `${w.beaconsCollected} beacon${w.beaconsCollected > 1 ? "s" : ""} reached.`;
      if (w.kills) return `${w.kills} tile${w.kills > 1 ? "s" : ""} earned.`;
      return "Every tile is earned.";
    })();
    const stats = (rows: Array<[string, string | number]>) => `<div class="t-stats">${rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join("")}</div>`;
    if (w.config.mode === "hundred") {
      const s = w.config.stage!;
      const cleared = w.outcome?.kind === "clear";
      const r = w.rating();
      const next = stageById(s.id + 1);
      this.ui.show({
        id: "results",
        title: `${String(s.id).padStart(3, "0")} · ${s.name.toUpperCase()}`,
        body: `${cleared ? `<div class="t-rating">${["", "◇", "◆", "✦"][r]}</div>` : ""}<div class="t-lead">${best}</div>${stats([["Marks", `${w.marksPlaced} / par ${s.par}`], ["Score", w.score.total.toLocaleString("en-US")]])}`,
        items: [
          ...(cleared && next ? [{ id: "next", label: "Next" }] : []),
          { id: "retry", label: "Retry" },
          ...(cleared && !next && this.profile.actOneCleared ? [{ id: "endless", label: "Endless" }] : []),
          { id: "stages", label: "Stages" }
        ],
        onPick: (id) => {
          if (id === "next" && next) this.startStage(next.id);
          else if (id === "retry") this.retry();
          else if (id === "endless") this.startEndless();
          else this.showHundred();
        },
        onBack: () => this.showHundred()
      });
      return;
    }
    this.ui.show({
      id: "results",
      title: w.config.mode === "daily" ? `DAILY · ${String(w.config.seed).replace("DAILY-", "")}` : "THE FALL",
      body: `<div class="t-lead">${best}</div>${stats([["Depth", w.depthRow], ["Score", w.score.total.toLocaleString("en-US")], ["Sector", w.sector], ...(w.score.bestChain > 1 ? [["Best chain", w.score.bestChain] as [string, number]] : []), ...(w.beaconsCollected ? [["Beacons", w.beaconsCollected] as [string, number]] : []), ...(w.config.assist ? [["Assist", "on"] as [string, string]] : [])])}${w.config.mode === "daily" && this.ranked ? `<div class="t-sub">Ranked attempt recorded · leaderboard offline</div>` : ""}`,
      items: [{ id: "retry", label: "Retry" }, { id: "menu", label: "Menu" }],
      onPick: (id) => (id === "retry" ? this.retry() : this.showMenu()),
      onBack: () => this.showMenu()
    });
  }

  retry(): void {
    const c = this.config;
    this.audio.resume();
    if (!c) return this.startEndless();
    if (c.mode === "hundred" && c.stage) this.startStage(c.stage.id);
    else if (c.mode === "daily") this.startDaily(String(c.seed).replace("DAILY-", ""), false);
    else this.startEndless(c.sector ?? 1, this.flags.seed ?? undefined);
  }

  /** Deterministic manual stepping for tests/dev. */
  stepFrames(n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.phase === "runes" && this.bot) this.pickRune(0);
      if (this.phase !== "playing") break;
      this.stepOnce();
    }
  }

  /** Resolve the open Rune pick (UI card or dev). */
  pickRune(i: number): void {
    if (this.phase !== "runes") return;
    this.pendingPick = i;
    this.ui.hide();
    this.phase = "playing";
    this.devices.clear();
    this.devices.enabled = true;
    this.last = performance.now();
  }

  get noInput(): FrameInput {
    return NO_INPUT;
  }
}
