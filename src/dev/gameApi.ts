import type { Game } from "../game/Game";
import { stageById } from "../data/hundred";
import { RUNES, type RuneId } from "../data/runes";
import type { BotLevel } from "./bot";

/** window.__GAME (GDD §32): state and controls for verification. Never used by gameplay. */
export function installGameApi(game: Game): void {
  const api = {
    seed: (n: number | string) => game.startEndless(1, String(n)),
    setSector: (n: number) => game.startEndless(n),
    loadStage: (n: number) => {
      if (!stageById(n)) return `no stage ${n}`;
      game.startStage(n);
      return `stage ${n}`;
    },
    startEndless: (sector = 1, seed?: string) => game.startEndless(sector, seed),
    startDaily: (day?: string) => game.startDaily(day, false),
    spawnFormation: (rows: string | string[]) => {
      const w = game.world;
      if (!w) return 0;
      return w.spawnFormation(Array.isArray(rows) ? rows : rows.split("/"), w.sector);
    },
    giveRune: (id: RuneId) => {
      if (!RUNES.some((r) => r.id === id)) return `unknown rune ${id}`;
      game.world?.run.runes.push(id);
      return id;
    },
    godMode: (on: boolean) => {
      if (game.world) game.world.godMode = on;
      return on;
    },
    state: () => {
      const w = game.world;
      if (!w) return { phase: game.phase };
      return {
        phase: game.phase,
        screen: game.ui.active,
        mode: w.config.mode,
        stage: w.config.stage?.id ?? null,
        frame: w.frame,
        tick: w.tick,
        tickLen: w.tickLen,
        sector: w.sector,
        score: w.score.total,
        depth: w.depthRow,
        player: { x: w.player.x, z: w.player.z, state: w.player.state },
        ground: w.connected().length,
        tiles: w.grid.size,
        cubes: w.cubes.alive().map((c) => ({ id: c.id, type: c.type, x: c.x, z: c.z, hp: c.hp })),
        marks: w.marks.list(),
        glyphs: w.run.glyphs.length,
        runes: w.run.runes,
        beacons: w.beacons.live().map((b) => ({ x: b.x, z: b.z, ticksLeft: b.ticksLeft })),
        islands: w.islands,
        beaconsCollected: w.beaconsCollected,
        kills: w.kills,
        lastStand: w.lastStand.active,
        outcome: w.outcome,
        runeOffers: w.runeOffers,
        chamber: w.chamber ? { id: w.chamber.def.id, armed: w.chamber.armed, marks: w.chamber.def.marks } : null,
        chambersWon: w.chambersWon,
        ended: w.ended
      };
    },
    stateHash: () => game.world?.stateHash() ?? null,
    /** Pause the realtime loop and step deterministically. */
    manual: (on: boolean) => {
      game.manual = on;
      return on;
    },
    stepFrames: (n: number) => {
      game.stepFrames(n);
      return game.world?.frame ?? 0;
    },
    /** Inject one frame of input through the same path as devices. */
    input: (p: { press?: number; mark?: { x: number; z: number }; detonate?: boolean; blast?: boolean; pick?: number }) => {
      const w = game.world;
      if (!w) return null;
      const inp = { ...game.noInput, ...p, press: (p.press ?? 0) as 0 | 1 | 2 | 3 | 4, mark: p.mark ?? null, detonate: !!p.detonate, blast: !!p.blast, pick: p.pick ?? -1 };
      game.recorder.record(w.frame, inp);
      w.step(inp);
      const ev = w.events.drain();
      game.view.handle(ev);
      return ev.map((e) => e.t);
    },
    bot: {
      start: (level: BotLevel = "competent") => {
        game.setBot(level);
        return level;
      },
      stop: () => game.setBot(null)
    },
    cellToScreen: (x: number, z: number) => game.view.cellToScreen(x, z, window.innerWidth, window.innerHeight),
    pickRune: (i: number) => game.pickRune(i),
    shareCard: () => game.shareCard()?.toDataURL("image/png") ?? null,
    pause: () => game.pause(),
    resume: () => game.resume(),
    skipReplay: () => game.skipReplay(),
    retry: () => game.retry(),
    menu: () => game.showMenu(),
    suspend: () => game.suspend(),
    resumeSuspended: () => game.resumeSuspended(),
    profile: () => game.profile.data,
    editor: () => "Stage editor is not built yet (GDD §32, Phase 4).",
    game
  };
  (window as unknown as { __GAME: typeof api }).__GAME = api;
}
