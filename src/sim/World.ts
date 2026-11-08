import { TUNING, tickForSector } from "../data/tuning";
import { FORMATIONS, FALLBACK, BAND_GAP, bandForSector, mirrorRow, type FormationDef } from "../data/formations";
import { RUNES, type RuneId } from "../data/runes";
import { CHAMBERS, CHAMBER_RUNES, type ChamberDef } from "../data/chambers";
import type { StageDef } from "../data/hundred/types";
import { Grid, type Tile } from "./Grid";
import { Cubes, type Cube } from "./Cubes";
import { Player } from "./Player";
import { Marks } from "./Marks";
import { Score } from "./Score";
import { Run } from "./Run";
import { Crumble } from "./Crumble";
import { Beacons } from "./Beacons";
import { EventQueue, type FallCause, type BeaconReward } from "./Events";
import { checkFormation, searchFormation, type SearchInput } from "./Fairness";
import { createRng } from "./Rng";
import { deepClone } from "./clone";
import { chebyshev, isStandard, type Cell, type CubeType, type FrameInput, type TileType } from "./types";

export type Mode = "endless" | "daily" | "hundred" | "sandbox";

export interface WorldConfig {
  mode: Mode;
  seed: number | string;
  sector?: number;
  stage?: StageDef;
  /** Assist speed: tick +15% (scores flagged). */
  assist?: boolean;
  /**
   * Highest Hundred act cleared (Endless only; GDD §17 "each cleared act adds its cubes to Endless bands").
   * Cube types from later acts spawn as Stone. Daily and omitted = 5 (everything, same board for everyone).
   */
  unlockedAct?: number;
}

export type Outcome =
  | { kind: "fall"; cause: FallCause; frame: number; x: number; z: number }
  | { kind: "clear"; frame: number }
  | { kind: "fail"; cause: "escape"; frame: number };

interface PendingBlast {
  x: number;
  z: number;
  left: number;
}

interface SectorPlan {
  id: number;
  formations: number;
  spawned: number;
  nextSpawnTick: number;
  beaconTicks: number[];
  escaped: number;
  forbiddenKilled: number;
  startTick: number;
  done: boolean;
}

const CUBE_OF: Readonly<Record<string, CubeType>> = { S: "stone", A: "advantage", F: "forbidden", G: "glass", I: "iron", P: "phase" };

const KILL_POINTS: Readonly<Record<CubeType, number>> = {
  stone: TUNING.score.stone,
  glass: TUNING.score.glass,
  iron: TUNING.score.iron,
  advantage: TUNING.score.advantage,
  phase: TUNING.score.phase,
  forbidden: TUNING.score.stone
};

/**
 * The deterministic simulation. Fixed 60 Hz `step(input)`; fully determined by (config, input log).
 * Orchestrates the state owners in a fixed order. Render/audio/UI read it and drain `events`; they never write.
 */
export class World {
  readonly config: WorldConfig;
  readonly events = new EventQueue();
  readonly grid = new Grid();
  readonly cubes = new Cubes();
  readonly player = new Player();
  readonly marks = new Marks();
  readonly score = new Score();
  readonly run = new Run();
  readonly crumble = new Crumble();
  readonly beacons = new Beacons();
  readonly rng;

  /** Global sim frame. */
  frame = 0;
  /** Tick index and frame within the tick. */
  tick = 0;
  f = 0;
  tickLen: number = TUNING.clock.tickDefault;
  sector = 1;
  actionLock = 0;
  pendingMark: { cell: Cell; left: number } | null = null;
  pendingDetonate = 0;
  pendingBlast = 0;
  blast: PendingBlast | null = null;
  lastStand = { active: false, frames: 0, usedThisSector: false };
  absolutionUsed = false;
  /** Fired marks that persist one tick (Echo Mark). */
  echo: Cell[] = [];
  echoTick = -1;
  outcome: Outcome | null = null;
  ended = false;
  sectorPlan: SectorPlan | null = null;
  /** Rune offers awaiting a pick (sim halts until picked). */
  runeOffers: RuneId[] | null = null;
  breather = 0;
  depthRow = 0;
  marksPlaced = 0;
  forbiddenKilled = 0;
  kills = 0;
  islands = 0;
  beaconsCollected = 0;
  perfectSectors = 0;
  purifies = 0;
  godMode = false;
  /** Last crush/escape for loss explanation. */
  lastCause: { kind: string; frame: number; x: number; z: number } | null = null;
  private stageWaveIdx = 0;
  private stageBeaconIdx = 0;
  private stageSkyIdx = 0;

  constructor(config: WorldConfig) {
    this.config = config;
    this.rng = createRng(config.seed);
    this.reset();
  }

  private reset(): void {
    const stage = this.config.stage;
    if (this.config.mode === "hundred" && stage) {
      for (let z = 0; z < stage.ground.length; z++) {
        const row = stage.ground[z]!;
        for (let x = 0; x < TUNING.grid.columns; x++) if (row[x] === "X") this.grid.add(x, z, "ground", 0);
      }
      this.player.reset(stage.player[0], stage.player[1]);
      this.tickLen = stage.tick ?? TUNING.clock.tickDefault;
      this.crumble.reset(stage.crumble, stage.crumble > 0);
      this.sector = 1;
    } else {
      for (let z = 0; z < TUNING.grid.startSlabRows; z++) for (let x = 0; x < TUNING.grid.columns; x++) this.grid.add(x, z, "ground", 0);
      this.player.reset(3, 1);
      this.sector = Math.max(1, this.config.sector ?? 1);
      this.tickLen = tickForSector(this.sector);
      this.crumble.reset(0, this.config.mode !== "sandbox");
      if (this.config.mode !== "sandbox") this.beginSector(this.sector, true);
    }
    if (this.config.assist) this.tickLen = Math.round(this.tickLen * 1.15);
    this.depthRow = this.player.z;
  }

  // ───────────────────────────────── queries ─────────────────────────────────

  get reach(): number {
    const t = this.grid.get(this.player.x, this.player.z);
    return TUNING.reach.radius + this.run.stacks("longArm") + (t?.type === "raised" ? TUNING.reach.ironBonus : 0);
  }

  get maxMarks(): number {
    if (this.chamber) return this.chamber.def.marks;
    return TUNING.marks.maxActive + this.run.stacks("thirdEye");
  }

  inReach(c: Cell): boolean {
    return this.grid.inBounds(c.x) && chebyshev(c, this.player) <= this.reach;
  }

  logical(c: Cube): Cell | null {
    return Cubes.logical(c, this.f, this.tickLen);
  }

  cubeAt(c: Cell): Cube | undefined {
    return this.cubes.at(c, this.f, this.tickLen);
  }

  connected(): Tile[] {
    return this.grid.connected(this.player);
  }

  /** Where a cube will be logically next tick (for the next-cell chevron). */
  nextCell(c: Cube): Cell {
    const l = this.logical(c) ?? { x: c.x, z: c.z };
    const rolling = Cubes.rolling(c, this.f, this.tickLen);
    return rolling && l.z === c.z - 1 ? { x: c.x, z: c.z - 2 } : { x: c.x, z: c.z - 1 };
  }

  get noFail(): boolean {
    return this.config.mode === "hundred" && this.frame < (this.config.stage?.noFail ?? 0);
  }

  // ───────────────────────────────── step ─────────────────────────────────

  step(input: FrameInput): void {
    if (this.ended) return;
    if (this.runeOffers) {
      if (input.pick >= 0 && input.pick < this.runeOffers.length) this.pickRune(this.runeOffers[input.pick]!);
      return;
    }
    this.frame++;
    if (this.chamber) {
      this.chamberStep(input);
      return;
    }

    if (this.outcome) {
      this.player.update(0, 0, this.moveCtx, this.events);
      if (this.outcome.kind !== "fall" || this.player.t >= TUNING.movement.fallFrames) this.ended = true;
      return;
    }

    this.actions(input);
    this.player.update(input.press, input.held, this.moveCtx, this.events);
    this.afterMove();

    this.f++;
    if (this.f >= this.tickLen) {
      this.f = 0;
      this.onTick();
    }
    if (this.f === this.tickLen - TUNING.clock.rollFrames / 2) this.onLogicalSwitch();
    this.crumbleWarning();
    this.updateBlast();
    this.updateLastStand();
    this.checkFooting();
    this.checkObjective();
  }

  private moveCtx = { canEnter: (x: number, z: number): boolean => this.canEnter(x, z) };

  /** Cell has a tile and no cube in it (movement rule). */
  canEnter(x: number, z: number): boolean {
    if (!this.grid.inBounds(x) || !this.grid.has(x, z)) return false;
    return !this.cubeAt({ x, z });
  }

  /** Independent copy for search (solver). Stage data is shared (immutable); closures are rebound. */
  clone(): World {
    const stage = this.config.stage;
    const c = deepClone(this);
    if (stage) (c.config as WorldConfig).stage = stage;
    c.moveCtx = { canEnter: (x: number, z: number): boolean => c.canEnter(x, z) };
    return c;
  }

  // ───────────────────────────────── verbs ─────────────────────────────────

  private actions(input: FrameInput): void {
    if (input.mark) this.pendingMark = { cell: input.mark, left: TUNING.input.bufferFrames };
    else if (this.pendingMark && --this.pendingMark.left <= 0) this.pendingMark = null;
    if (input.detonate) this.pendingDetonate = TUNING.input.bufferFrames;
    else if (this.pendingDetonate > 0) this.pendingDetonate--;
    if (input.blast) this.pendingBlast = TUNING.input.bufferFrames;
    else if (this.pendingBlast > 0) this.pendingBlast--;

    if (this.actionLock > 0) {
      this.actionLock--;
      return;
    }
    if (!this.player.canAct) return;

    if (this.pendingMark) {
      const c = this.pendingMark.cell;
      this.pendingMark = null;
      if (!this.inReach(c)) return;
      const r = this.marks.toggle(c, this.maxMarks);
      if (r === "full") {
        // replace the oldest mark so a full hand never locks the player out
        const oldest = this.marks.list()[0]!;
        this.marks.toggle(oldest, this.maxMarks);
        this.events.push({ t: "MarkRemoved", x: oldest.x, z: oldest.z });
        this.marks.toggle(c, this.maxMarks);
      }
      if (r === "removed") this.events.push({ t: "MarkRemoved", x: c.x, z: c.z });
      else {
        this.marksPlaced++;
        const cube = this.cubeAt(c);
        this.events.push({ t: "MarkPlaced", x: c.x, z: c.z, void: !this.grid.has(c.x, c.z), onForbidden: cube?.type === "forbidden" });
      }
      this.actionLock = TUNING.marks.markLock;
      return;
    }
    if (this.pendingDetonate > 0) {
      this.pendingDetonate = 0;
      this.detonate();
      this.actionLock = TUNING.detonate.lock + TUNING.detonate.recovery;
      return;
    }
    if (this.pendingBlast > 0 && !this.blast) {
      this.pendingBlast = 0;
      const g = this.run.glyphs[0];
      if (!g) return;
      this.run.glyphs = this.run.glyphs.slice(1);
      this.grid.setType(g.x, g.z, "ground");
      this.blast = { x: g.x, z: g.z, left: TUNING.blast.charge };
      this.events.push({ t: "BlastCharge", x: g.x, z: g.z });
      this.actionLock = TUNING.blast.charge + TUNING.blast.active + TUNING.blast.recovery;
    }
  }

  private detonate(): void {
    const fired = this.marks.take();
    this.events.push({ t: "Detonate", marks: fired.length });
    const targets = fired;
    const kills: Cube[] = [];
    const phaseHits = new Set<number>();
    for (const m of targets) {
      const c = this.cubeAt(m);
      if (!c) {
        this.events.push({ t: "Miss", x: m.x, z: m.z });
        continue;
      }
      if (c.type === "phase") {
        phaseHits.add(c.id);
        continue;
      }
      if (c.type === "iron") {
        if (c.lastHitTick === this.tick) continue;
        c.lastHitTick = this.tick;
        c.hp--;
        if (c.hp > 0) {
          const l = this.logical(c)!;
          this.events.push({ t: "IronHit", id: c.id, hp: c.hp, x: l.x, z: l.z });
          continue;
        }
      }
      if (!kills.includes(c)) kills.push(c);
    }
    for (const id of phaseHits) {
      const c = this.cubes.byId(id);
      if (!c) continue;
      if (phaseHits.has(c.twin)) {
        if (!kills.some((k) => k.id === c.twin)) kills.push(c);
      } else {
        const l = this.logical(c)!;
        this.events.push({ t: "Miss", x: l.x, z: l.z });
      }
    }
    if (kills.length) this.resolveKills(kills, null);
    // Echo Mark: fired marks linger until the next tick
    if (this.run.stacks("echoMark") > 0 && fired.length && this.echoTick < 0) {
      this.echo = fired.map((m) => ({ ...m }));
      this.echoTick = this.tick;
      for (const m of this.echo) this.marks.toggle(m, this.maxMarks + this.echo.length);
    }
  }

  private updateBlast(): void {
    const b = this.blast;
    if (!b) return;
    b.left--;
    if (b.left > 0) return;
    this.blast = null;
    const wide = this.run.stacks("wideBlast") > 0;
    const hw = wide ? 2 : 1;
    this.events.push({ t: "Blast", x: b.x, z: b.z, w: hw * 2 + 1, h: 3 });
    const caught: Cube[] = [];
    for (const c of this.cubes.alive()) {
      const l = this.logical(c);
      if (!l) continue;
      if (Math.abs(l.x - b.x) <= hw && Math.abs(l.z - b.z) <= 1) caught.push(c);
    }
    if (caught.length) this.resolveKills(caught, b);
  }

  /** Kills resolve, then tiles spawn, then Scars and crumbles, in that order within the frame (GDD §11). */
  private resolveKills(list: Cube[], blast: Cell | null): void {
    const n = list.length;
    const cells: Array<{ c: Cube; cell: Cell; twinCell: Cell | null }> = [];
    let base = 0;
    for (const c of list) {
      const cell = this.logical(c) ?? { x: c.x, z: c.z };
      let twinCell: Cell | null = null;
      if (c.type === "phase") {
        const twin = this.cubes.byId(c.twin);
        if (twin) {
          twinCell = this.logical(twin) ?? { x: twin.x, z: twin.z };
          this.cubes.kill(twin);
        }
      }
      this.cubes.kill(c);
      let pts = c.type === "forbidden" ? (this.lastStand.active ? TUNING.score.stone : 0) : KILL_POINTS[c.type];
      if (c.sinceLand === 0) pts += TUNING.score.skyfallLanding;
      base += pts;
      cells.push({ c, cell, twinCell });
    }
    // kills
    cells.forEach(({ c, cell }, i) => {
      this.kills++;
      this.events.push({ t: "Kill", id: c.id, type: c.type, x: cell.x, z: cell.z, chain: n, index: i, blast: !!blast, points: c.type === "forbidden" ? 0 : KILL_POINTS[c.type] });
    });
    const total = base * n;
    if (total > 0) this.score.add(total, n > 1 ? `chain×${n}` : "kill", this.events);
    if (n > 1) {
      const head = cells[0]!.cell;
      this.events.push({ t: "Chain", n, points: total, x: head.x, z: head.z });
      if (n > this.score.bestChain) this.score.bestChain = n;
    }
    if (n >= 3 && this.run.stacks("resonance") > 0) this.gainGlyph(null);

    // tiles
    const forbidden: Cell[] = [];
    for (const { c, cell, twinCell } of cells) {
      if (c.type === "forbidden" && !this.lastStand.active) {
        if (this.run.stacks("absolution") > 0 && !this.absolutionUsed) {
          this.absolutionUsed = true;
          this.spawnTile(cell, "ground", blast);
        } else forbidden.push(cell);
        continue;
      }
      const type: TileType = c.type === "glass" ? "glass" : c.type === "iron" ? "raised" : "ground";
      const existing = this.grid.get(cell.x, cell.z);
      if (c.type === "advantage") {
        // a kill on existing ground still leaves its Glyph (DECISIONS #33)
        if (this.spawnTile(cell, "ground", blast) || existing?.type === "ground") this.gainGlyph(cell);
      } else if (c.type === "iron" && existing && existing.type !== "glyph") {
        this.grid.setType(cell.x, cell.z, "raised");
        this.events.push({ t: "TileRise", x: cell.x, z: cell.z, type: "raised", delay: 0, island: false });
      } else this.spawnTile(cell, type, blast);
      if (twinCell) this.spawnTile(twinCell, "ground", blast);
    }
    // scars and crumbles
    for (const cell of forbidden) {
      this.forbiddenKilled++;
      if (this.sectorPlan) this.sectorPlan.forbiddenKilled++;
      this.grid.scar(cell.x, cell.z);
      this.run.glyphs = this.run.glyphs.filter((g) => g.x !== cell.x || g.z !== cell.z);
      this.events.push({ t: "ScarTorn", x: cell.x, z: cell.z });
      this.crumbleRow("forbidden");
    }
  }

  private spawnTile(cell: Cell, type: TileType, blast: Cell | null): boolean {
    const island = !this.grid.touchesGround(cell.x, cell.z) && !this.grid.has(cell.x, cell.z);
    if (!this.grid.add(cell.x, cell.z, type, this.tick)) return false;
    const delay = blast ? 2 * chebyshev(cell, blast) : 0;
    this.events.push({ t: "TileRise", x: cell.x, z: cell.z, type, delay, island });
    if (island) {
      this.islands++;
      this.score.add(TUNING.score.island, "island", this.events);
    }
    return true;
  }

  private gainGlyph(cell: Cell | null): void {
    let at = cell;
    if (!at) {
      const t = this.grid.get(this.player.x, this.player.z);
      if (!t || t.type !== "ground") return;
      at = { x: t.x, z: t.z };
    }
    if (this.run.glyphs.length >= TUNING.glyphs.maxHeld) return;
    this.grid.setType(at.x, at.z, "glyph");
    this.run.glyphs = [...this.run.glyphs, { x: at.x, z: at.z }];
    this.events.push({ t: "GlyphGained", x: at.x, z: at.z });
  }

  // ───────────────────────────────── movement consequences ─────────────────────────────────

  private afterMove(): void {
    const p = this.player;
    if (!p.alive) return;
    // depth
    while (p.maxZ > this.depthRow) {
      this.depthRow++;
      this.score.add(TUNING.score.depthPerRow, "depth", this.events, false);
    }
    // beacons
    const b = this.beacons.at(p.x, p.z);
    if (b) {
      b.alive = false;
      this.beaconsCollected++;
      const rewards: BeaconReward[] = ["glyph", "shard", "score", "crumble"];
      const reward = this.rng.stream("rewards").pick(rewards);
      this.score.add(TUNING.score.beacon, "beacon", this.events);
      if (reward === "glyph") this.gainGlyph(null);
      else if (reward === "shard") this.run.shards++;
      else if (reward === "score") this.beacons.boostTicks = TUNING.beacons.scoreBoostTicks;
      else this.crumble.counter = 0;
      this.events.push({ t: "BeaconCollected", id: b.id, x: b.x, z: b.z, reward });
      this.refreshMultiplier();
    }
  }

  private checkFooting(): void {
    const p = this.player;
    if (!p.alive || this.outcome) return;
    if (p.state === "shoved" && p.t < TUNING.movement.shoveSlideFrames) {
      if (!this.grid.has(p.x, p.z) && p.t >= TUNING.movement.shoveSlideFrames / 2) this.fall("shoved");
      return;
    }
    if (!this.grid.has(p.x, p.z)) this.fall(this.grid.isScar(p.x, p.z) ? "scar" : "void");
  }

  private fall(cause: FallCause): void {
    if (this.godMode) return;
    const p = this.player;
    p.fall();
    this.outcome = { kind: "fall", cause, frame: this.frame, x: p.x, z: p.z };
    this.events.push({ t: "Fall", x: p.x, z: p.z, cause });
    this.events.push({ t: "Announce", line: "again" });
  }

  // ───────────────────────────────── tick ─────────────────────────────────

  private onTick(): void {
    this.tick++;
    this.events.push({ t: "Tick", tick: this.tick, tickLen: this.tickLen });
    if (this.echoTick >= 0 && this.tick > this.echoTick) {
      for (const m of this.echo) if (this.marks.has(m)) this.marks.toggle(m, this.maxMarks);
      this.echo = [];
      this.echoTick = -1;
    }

    // rolls land (all grounded cubes first, so landing checks see final positions — order-independent)
    for (const c of this.cubes.alive()) {
      if (c.landTick >= 0) continue;
      if (c.age >= 1) {
        c.z -= 1;
        this.events.push({ t: "Roll", id: c.id, x: c.x, z: c.z });
        if (c.sinceLand >= 0) c.sinceLand++;
      }
      c.age++;
    }
    // then Skyfall landings
    for (const c of this.cubes.alive()) {
      if (c.landTick < 0 || c.landTick > this.tick) continue;
      // a monolith can't land on another: if the telegraphed cell is occupied, the falling cube shatters
      const occupant = this.cubes.alive().find((o) => o !== c && o.landTick < 0 && o.x === c.x && o.z === c.z);
      if (occupant) {
        this.cubes.kill(c);
        this.events.push({ t: "SkyfallShatter", id: c.id, x: c.x, z: c.z });
        continue;
      }
      c.landTick = -1;
      c.sinceLand = 0;
      c.age = 1; // rolls in step with the formation from the next tick (no fade-in pause: that let cubes behind catch up)
      this.events.push({ t: "SkyfallLand", id: c.id, x: c.x, z: c.z });
      if (this.player.alive && this.player.x === c.x && this.player.z === c.z) this.crush(c);
    }

    // escapes: anything past the rear edge of the ground
    const rear = this.grid.rearZ();
    let standardEscapes = 0;
    for (const c of this.cubes.alive()) {
      if (c.landTick >= 0) continue;
      if (rear !== null && c.z >= rear) continue;
      this.cubes.kill(c);
      if (c.type === "phase") {
        const twin = this.cubes.byId(c.twin);
        if (twin) this.cubes.kill(twin);
      }
      if (isStandard(c.type)) {
        standardEscapes++;
        if (this.sectorPlan) this.sectorPlan.escaped++;
        this.events.push({ t: "Escape", id: c.id, type: c.type, x: c.x, z: c.z });
        this.lastCause = { kind: "escape", frame: this.frame, x: c.x, z: c.z };
        if (this.config.mode === "hundred" && this.config.stage?.objective.type === "clear" && !this.outcome) {
          this.outcome = { kind: "fail", cause: "escape", frame: this.frame };
        }
      } else {
        this.events.push({ t: "ForbiddenPassed", id: c.id, x: c.x, z: c.z });
        this.score.add(TUNING.score.forbiddenPassed, "restraint", this.events);
      }
    }
    for (let i = 0; i < standardEscapes; i++) this.crumbleRow("escape");

    // glass and bedrock bookkeeping
    this.updateStanding();

    // directors
    if (this.config.mode === "hundred") this.stageTick();
    else if (this.config.mode !== "sandbox") this.sectorTick();

    // crumble timer & hinterland
    let crumbled = false;
    if (!this.crumble.contacted) this.crumble.contacted = this.inContact();
    if (this.crumble.enabled && !this.noFail && this.crumble.contacted) {
      this.crumble.counter++;
      if (this.crumble.counter >= this.crumbleInterval()) {
        this.crumble.counter = 0;
        this.crumble.warned = false;
        this.crumbleRow("timer");
        crumbled = true;
      }
    }
    const r2 = this.grid.rearZ();
    if (!crumbled && r2 !== null && r2 < this.player.z - TUNING.economy.hinterlandRows) this.crumbleRow("hinterland");

    // beacons
    for (const b of this.beacons.live()) {
      b.ticksLeft--;
      if (b.ticksLeft <= 0) {
        b.alive = false;
        this.events.push({ t: "BeaconExpired", id: b.id });
      }
    }
    if (this.beacons.boostTicks > 0) this.beacons.boostTicks--;
    this.refreshMultiplier();
  }

  /** Contact: a live grounded cube within Reach of the connected front row (Crumble hold, TUNING.crumble.holdUntilContact). */
  private inContact(): boolean {
    const conn = this.connected();
    if (!conn.length) return true;
    let front = -Infinity;
    for (const t of conn) front = Math.max(front, t.z);
    return this.cubes.alive().some((c) => c.landTick < 0 && c.z - front <= this.reach);
  }

  crumbleInterval(): number {
    const behind = this.connected().filter((t) => t.z < this.player.z).length;
    return this.crumble.interval(this.sector, behind, this.run.stacks("slowEarth"));
  }

  private crumbleWarning(): void {
    if (!this.crumble.enabled || this.crumble.warned || this.noFail || !this.crumble.contacted) return;
    const interval = this.crumbleInterval();
    if (this.crumble.counter === interval - 1 && this.f === this.tickLen - TUNING.crumble.warnFrames) {
      const z = this.grid.rearZ();
      if (z === null) return;
      this.crumble.warned = true;
      this.events.push({ t: "CrumbleWarn", z, frames: TUNING.crumble.warnFrames });
    }
  }

  private crumbleRow(reason: "timer" | "escape" | "forbidden" | "hinterland"): void {
    const z = this.grid.rearZ();
    if (z === null) return;
    const bedrock = this.run.stacks("bedrock") > 0;
    const p = this.player;
    const row = this.grid.row(z).filter((t) => !(bedrock && t.standTicks >= 4));
    if (p.alive && p.z === z && row.some((t) => t.x === p.x)) {
      if (this.moveCtx.canEnter(p.x, z + 1)) p.pushForward();
    }
    row.forEach((t, i) => {
      this.grid.remove(t.x, t.z);
      this.events.push({ t: "TileFall", x: t.x, z: t.z, delay: i * 2, reason: reason === "forbidden" ? "crumble" : reason === "timer" ? "crumble" : reason });
    });
    this.run.glyphs = this.run.glyphs.filter((g) => this.grid.has(g.x, g.z));
    this.events.push({ t: "Crumble", z, reason });
    if (p.alive && p.z === z && !this.grid.has(p.x, p.z)) {
      this.lastCause = { kind: "crumble", frame: this.frame, x: p.x, z: p.z };
      this.fall("crumble");
    }
  }

  private updateStanding(): void {
    const p = this.player;
    const tempered = 2 * this.run.stacks("temperedGlass");
    for (const t of this.grid.list()) {
      const on = p.alive && t.x === p.x && t.z === p.z;
      if (on) {
        t.standTicks++;
        t.leftTick = -1;
      } else {
        if (t.standTicks > 0 && t.type === "glass") t.leftTick = this.tick;
        t.standTicks = 0;
      }
      if (t.type !== "glass") continue;
      const shatter =
        (t.leftTick >= 0 && this.tick - t.leftTick >= TUNING.glass.shatterAfterLeaveTicks + tempered) ||
        (on && t.standTicks >= TUNING.glass.shatterAfterStandTicks + tempered);
      if (shatter) {
        this.grid.remove(t.x, t.z);
        this.run.glyphs = this.run.glyphs.filter((g) => g.x !== t.x || g.z !== t.z);
        this.events.push({ t: "TileFall", x: t.x, z: t.z, delay: 0, reason: "glass" });
        if (on) {
          this.lastCause = { kind: "glass", frame: this.frame, x: t.x, z: t.z };
          this.fall("glass");
        }
      } else if ((t.leftTick >= 0 && this.tick - t.leftTick === TUNING.glass.shatterAfterLeaveTicks + tempered - 1) || (on && t.standTicks === TUNING.glass.shatterAfterStandTicks + tempered - 1)) {
        this.events.push({ t: "GlassCrack", x: t.x, z: t.z });
      }
    }
  }

  private onLogicalSwitch(): void {
    const p = this.player;
    if (!p.alive || this.outcome) return;
    for (const c of this.cubes.alive()) {
      if (!Cubes.rolling(c, this.f, this.tickLen)) continue;
      if (c.x === p.x && c.z - 1 === p.z) {
        this.crush(c);
        return;
      }
    }
  }

  private crush(c: Cube): void {
    const p = this.player;
    const fromZ = p.z;
    this.events.push({ t: "Crush", id: c.id, x: p.x, z: p.z, fromZ });
    this.lastCause = { kind: "crush", frame: this.frame, x: p.x, z: p.z };
    if (this.noFail && !this.grid.has(p.x, p.z - 1)) {
      // first seconds of early stages: no failure state — stun in place, cube passes through
      p.state = "stunned";
      p.stun = TUNING.crush.stunFrames;
      return;
    }
    p.shove();
  }

  private refreshMultiplier(): void {
    this.score.multiplier = (this.lastStand.active ? TUNING.lastStand.scoreMul : 1) * (this.beacons.boostTicks > 0 ? TUNING.beacons.scoreBoost : 1);
  }

  private updateLastStand(): void {
    const ls = this.lastStand;
    const allowed = this.config.mode !== "hundred" || !!this.config.stage?.lastStand;
    if (!allowed || !this.player.alive || this.outcome) return;
    const n = this.connected().length;
    if (!ls.active) {
      if (!ls.usedThisSector && n > 0 && n <= TUNING.lastStand.triggerTiles) {
        ls.active = true;
        ls.usedThisSector = true;
        ls.frames = this.run.stacks("lastWord") > 0 ? 1500 : TUNING.lastStand.durationFrames;
        this.events.push({ t: "LastStand", on: true });
        this.events.push({ t: "Announce", line: "holdOn" });
        this.refreshMultiplier();
      }
      return;
    }
    ls.frames--;
    if (ls.frames > 0) return;
    ls.active = false;
    this.events.push({ t: "LastStand", on: false });
    this.refreshMultiplier();
    if (n >= TUNING.lastStand.purifyTiles) {
      this.purifies++;
      this.score.add(TUNING.score.purify, "purify", this.events);
      this.events.push({ t: "Purify" });
      this.events.push({ t: "Announce", line: "purified" });
    }
  }

  // ───────────────────────────────── Endless / Daily director ─────────────────────────────────

  private beginSector(id: number, first: boolean): void {
    const rng = this.rng.stream("formations");
    const count = rng.int(TUNING.sector.formationsMin, TUNING.sector.formationsMax);
    const beaconCount = this.rng.stream("beacons").int(TUNING.beacons.perSectorMin, TUNING.beacons.perSectorMax);
    const start = this.tick + (first ? TUNING.sector.firstSpawnTick : TUNING.sector.breatherTicks);
    const beaconTicks: number[] = [];
    for (let i = 0; i < beaconCount; i++) beaconTicks.push(start + 2 + i * 9);
    this.sectorPlan = { id, formations: count, spawned: 0, nextSpawnTick: start, beaconTicks, escaped: 0, forbiddenKilled: 0, startTick: this.tick, done: false };
    this.sector = id;
    this.tickLen = tickForSector(id);
    if (this.config.assist) this.tickLen = Math.round(this.tickLen * 1.15);
    this.lastStand.usedThisSector = false;
    this.absolutionUsed = false;
    const hold = TUNING.crumble.holdUntilContact;
    if ((this.config.mode === "endless" || this.config.mode === "daily") && (hold === "sector" || (hold === "run" && first))) this.crumble.contacted = false;
    this.events.push({ t: "SectorStart", sector: id, tickLen: this.tickLen });
  }

  /** Active-cube cap follows the pacing curve (GDD §19). */
  private liveCap(): number {
    const sec = this.frame / 60;
    if (sec < 60) return 12;
    if (sec < 300) return 20;
    if (sec < 720) return 28;
    return TUNING.spawn.liveCap;
  }

  private sectorTick(): void {
    const plan = this.sectorPlan;
    if (!plan) return;
    if (plan.done) {
      if (--this.breather <= 0) this.beginSector(plan.id + 1, false);
      return;
    }
    if (plan.spawned < plan.formations && this.tick >= plan.nextSpawnTick && this.cubes.count < this.liveCap()) {
      const def = this.pickFormation();
      if (!def) {
        // nothing fair can spawn right now (Design Law 5): wait a tick and look again
        plan.nextSpawnTick = this.tick + 1;
      } else {
        const rows = this.spawnFormation(def.rows, plan.id);
        plan.spawned++;
        this.scheduleSkyfall(plan.id);
        plan.nextSpawnTick = this.tick + rows + BAND_GAP[bandForSector(plan.id)];
      }
    }
    if (plan.beaconTicks.length && this.tick >= plan.beaconTicks[0]!) {
      plan.beaconTicks = plan.beaconTicks.slice(1);
      this.spawnBeacon();
    }
    const live = this.cubes.alive().some((c) => c.wave === plan.id);
    if (plan.spawned >= plan.formations && !live) {
      plan.done = true;
      const perfect = plan.escaped === 0 && plan.forbiddenKilled === 0;
      this.events.push({ t: "SectorClear", sector: plan.id, perfect });
      if (perfect) {
        this.perfectSectors++;
        this.score.add(TUNING.score.perfectSector, "perfect", this.events);
        this.crumble.counter = 0;
        this.events.push({ t: "PerfectSector", sector: plan.id });
        this.events.push({ t: "Announce", line: "beautiful" });
      }
      this.breather = TUNING.sector.breatherTicks;
      // every 4th Sector: a Chamber puzzle first, then the Rune pick (GDD §17)
      if (plan.id % 4 === 0 && this.config.mode !== "sandbox") this.beginChamber();
      else this.offerRunes();
    }
  }

  private pickFormation(): FormationDef | null {
    const band = bandForSector(this.sector);
    const pool = FORMATIONS.filter((x) => x.band === band);
    const rng = this.rng.stream("formations");
    const mirror = this.rng.stream("mirror");
    for (let attempt = 0; attempt <= TUNING.sector.fairnessRerolls; attempt++) {
      const def = rng.pick(pool);
      const rows = this.gateRows(mirror.chance(0.5) ? def.rows.map(mirrorRow) : [...def.rows]);
      const res = this.fairness(rows);
      this.lastFairness = { id: def.id, fair: res.fair, reason: res.reason, attempts: attempt + 1 };
      if (res.fair) return { ...def, rows };
    }
    const fbDef = FORMATIONS.find((x) => x.id === FALLBACK[band])!;
    const fb = { ...fbDef, rows: this.gateRows(fbDef.rows) };
    const fbRes = this.fairness(fb.rows);
    this.lastFairness = { id: fb.id, fair: fbRes.fair, reason: `fallback:${fbRes.reason}`, attempts: TUNING.sector.fairnessRerolls + 1 };
    if (fbRes.fair) return fb;
    // relief: a single Stone in the player's lane (or the nearest lane with a plan)
    for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
      const x = this.player.x + dx;
      if (x < 0 || x >= TUNING.grid.columns) continue;
      const rows = [".".repeat(x) + "S" + ".".repeat(TUNING.grid.columns - 1 - x)];
      const r = this.fairness(rows);
      if (r.fair) {
        this.lastFairness = { id: "relief", fair: true, reason: "relief", attempts: TUNING.sector.fairnessRerolls + 2 };
        return { id: "relief", band, rows };
      }
    }
    this.lastFairness = { id: "none", fair: true, reason: "deferred", attempts: TUNING.sector.fairnessRerolls + 2 };
    return null;
  }

  /** Cube types the player hasn't met in The Hundred yet appear as Stone (Act II: F A · III: G I + Skyfall · IV: P). */
  private gateRows(rows: readonly string[]): string[] {
    const act = this.config.mode === "endless" ? (this.config.unlockedAct ?? 5) : 5;
    const allowed = new Set(["S", ...(act >= 2 ? ["F", "A"] : []), ...(act >= 3 ? ["G", "I"] : []), ...(act >= 4 ? ["P"] : [])]);
    return rows.map((r) => [...r].map((ch) => (ch === "." || allowed.has(ch) ? ch : "S")).join(""));
  }

  /** Skyfall per formation (GDD §19): from Sector 6 one per formation; beyond 10, +1 every 3 Sectors (max 4). */
  private scheduleSkyfall(wave: number): void {
    const act = this.config.mode === "endless" ? (this.config.unlockedAct ?? 5) : 5;
    if (act < 3 || this.sector < 6) return;
    const count = this.sector < 10 ? 1 : Math.min(4, 1 + Math.floor((this.sector - 10) / 3));
    const rng = this.rng.stream("skyfall");
    const conn = this.connected();
    let front = -Infinity;
    for (const t of conn) front = Math.max(front, t.z);
    if (!Number.isFinite(front)) return;
    const landTick = this.tick + TUNING.skyfall.telegraphTicks;
    // predicted cube cells at landing (kills only remove cubes, so this is conservative)
    const occupied = new Set<number>();
    for (const c of this.cubes.alive()) {
      if (c.landTick >= 0) {
        occupied.add(c.landTick * 1e4 + c.z * 8 + c.x);
        continue;
      }
      const rolls = Math.max(0, TUNING.skyfall.telegraphTicks - (c.age >= 1 ? 0 : 1));
      occupied.add(landTick * 1e4 + (c.z - rolls) * 8 + c.x);
    }
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const x = rng.int(0, TUNING.grid.columns - 1);
        const z = front + rng.int(-1, 4);
        const k = landTick * 1e4 + z * 8 + x;
        if (occupied.has(k) || this.grid.isScar(x, z)) continue;
        occupied.add(k);
        this.spawnSkyfall(rng.chance(0.75) ? "stone" : rng.pick(["glass", "advantage"] as const), x, z, wave);
        break;
      }
    }
  }

  /** Fairness of a formation spawned now (Design Law 5): cheap necessary conditions, then the plan search. */
  fairness(rows: readonly string[]): { fair: boolean; reason: string } {
    const connected = this.connected().map((t) => ({ x: t.x, z: t.z }));
    const pre = checkFormation({ rows, connected, reach: this.reach, maxMarks: this.maxMarks, tickLen: this.tickLen });
    if (!pre.fair) return pre;
    const front = this.grid.frontZ() ?? this.player.z;
    const z0 = front + TUNING.spawn.distance;
    const interval = this.crumbleInterval();
    const first = this.crumble.contacted ? interval - this.crumble.counter : Math.max(0, z0 - front - this.reach) + interval;
    const crumbleAt: number[] = [];
    if (this.crumble.enabled) for (let t = first; t < z0 - front + 12; t += interval) crumbleAt.push(t);
    const input: SearchInput = { rows, z0, ground: connected, player: { x: this.player.x, z: this.player.z }, reach: this.reach, maxMarks: this.maxMarks, tickLen: this.tickLen, crumbleAt };
    const r = searchFormation(input);
    return { fair: r.fair, reason: r.fair ? "plan" : "no plan" };
  }

  lastFairness: { id: string; fair: boolean; reason: string; attempts: number } | null = null;

  /** Spawn formation rows (nearest-first) 12 rows ahead of the front edge. Returns row count. */
  spawnFormation(rows: readonly string[], wave: number, atZ?: number): number {
    const front = this.grid.frontZ() ?? this.player.z;
    const z0 = atZ ?? front + TUNING.spawn.distance;
    rows.forEach((row, r) => {
      let pendingPhase: Cube | null = null;
      for (let x = 0; x < TUNING.grid.columns; x++) {
        const t = CUBE_OF[row[x] ?? "."];
        if (!t) {
          pendingPhase = null;
          continue;
        }
        const c = this.cubes.spawn(t, x, z0 + r, wave);
        if (t === "iron") c.hp = Math.max(1, TUNING.iron.hp - this.run.stacks("sledge"));
        if (t === "phase") {
          if (pendingPhase) {
            pendingPhase.twin = c.id;
            c.twin = pendingPhase.id;
            pendingPhase = null;
          } else pendingPhase = c;
        } else pendingPhase = null;
        this.events.push({ t: "CubeSpawn", id: c.id, type: t, x, z: c.z });
      }
    });
    return rows.length;
  }

  /** Skyfall: telegraphed 2 ticks (LOCKED), lands on its cell, then rolls. */
  spawnSkyfall(type: CubeType, x: number, z: number, wave: number): void {
    const c = this.cubes.spawn(type, x, z, wave, this.tick + TUNING.skyfall.telegraphTicks);
    this.events.push({ t: "SkyfallWarn", id: c.id, x, z, type });
  }

  private spawnBeacon(): void {
    const rng = this.rng.stream("beacons");
    const front = this.grid.frontZ() ?? this.player.z;
    for (let i = 0; i < 12; i++) {
      const x = rng.int(0, TUNING.grid.columns - 1);
      const z = front + rng.int(TUNING.beacons.distMin, TUNING.beacons.distMax);
      if (this.grid.has(x, z) || this.grid.isScar(x, z) || this.beacons.at(x, z)) continue;
      const b = this.beacons.spawn(x, z);
      this.events.push({ t: "BeaconSpawn", id: b.id, x, z });
      return;
    }
  }

  private offerRunes(rarePool = false): void {
    if (this.config.mode === "sandbox") return;
    const rng = this.rng.stream("runes");
    const pool: readonly RuneId[] = rarePool ? CHAMBER_RUNES : RUNES.map((r) => r.id);
    let available = RUNES.filter((r) => pool.includes(r.id) && this.run.stacks(r.id) < r.maxStack).map((r) => r.id);
    if (!available.length) available = RUNES.filter((r) => this.run.stacks(r.id) < r.maxStack).map((r) => r.id);
    if (!available.length) return;
    const picks = this.run.shards >= TUNING.beacons.shardsPerRune ? 2 : 1;
    if (picks === 2) this.run.shards -= TUNING.beacons.shardsPerRune;
    this.pendingPicks = picks;
    this.runeOffers = rng.shuffle([...available]).slice(0, 3);
  }

  // ───────────────────────────────── Chambers (GDD §17) ─────────────────────────────────

  /** Active Chamber: time frozen; marks on its cells, Glyphs armed by `pick`, one Detonate resolves everything. */
  chamber: { def: ChamberDef; z0: number; cubes: number[]; glyphs: Cell[]; armed: boolean[]; result: "open" | "won" | "lost" } | null = null;
  chambersWon = 0;

  private beginChamber(): void {
    const def = CHAMBERS[this.rng.stream("runes").int(0, CHAMBERS.length - 1)]!;
    const front = this.grid.frontZ() ?? this.player.z;
    const z0 = front + 2;
    this.marks.clear();
    const ids: number[] = [];
    def.rows.forEach((row, r) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        const c = this.cubes.spawn(ch === "F" ? "forbidden" : "stone", x, z0 + r, -1);
        c.age = 1;
        ids.push(c.id);
        this.events.push({ t: "CubeSpawn", id: c.id, type: c.type, x, z: c.z });
      })
    );
    this.chamber = { def, z0, cubes: ids, glyphs: def.glyphs.map(([x, r]) => ({ x, z: z0 + r })), armed: def.glyphs.map(() => false), result: "open" };
    this.events.push({ t: "ChamberStart", id: def.id, marks: def.marks, glyphs: def.glyphs.length });
  }

  private chamberStep(input: FrameInput): void {
    const ch = this.chamber!;
    if (input.pick >= 0 && input.pick < ch.armed.length) {
      ch.armed[input.pick] = !ch.armed[input.pick];
      this.events.push({ t: "ChamberGlyph", index: input.pick, armed: ch.armed[input.pick]! });
    }
    if (input.blast) {
      // gamepad/one-button: arm the next unarmed Glyph, or disarm all when every Glyph is armed
      const i = ch.armed.findIndex((a) => !a);
      if (i >= 0) ch.armed[i] = true;
      else ch.armed = ch.armed.map(() => false);
      this.events.push({ t: "ChamberGlyph", index: i, armed: i >= 0 });
    }
    if (input.mark) {
      const c = input.mark;
      const inside = c.x >= 0 && c.x < TUNING.grid.columns && c.z >= ch.z0 && c.z < ch.z0 + ch.def.rows.length;
      if (inside) {
        const r = this.marks.toggle(c, ch.def.marks);
        if (r === "placed") {
          this.marksPlaced++;
          this.events.push({ t: "MarkPlaced", x: c.x, z: c.z, void: !this.grid.has(c.x, c.z), onForbidden: this.cubeAt(c)?.type === "forbidden" });
        } else if (r === "removed") this.events.push({ t: "MarkRemoved", x: c.x, z: c.z });
      }
    }
    if (!input.detonate) return;
    // one Detonate: marks + armed Glyph Blasts resolve together
    const fired = this.marks.take();
    this.events.push({ t: "Detonate", marks: fired.length });
    const hit = new Set<number>();
    for (const m of fired) {
      const c = this.cubeAt(m);
      if (c) hit.add(c.id);
      else this.events.push({ t: "Miss", x: m.x, z: m.z });
    }
    ch.glyphs.forEach((g, i) => {
      if (!ch.armed[i]) return;
      this.events.push({ t: "Blast", x: g.x, z: g.z, w: 3, h: 3 });
      for (const c of this.cubes.alive()) if (Math.abs(c.x - g.x) <= 1 && Math.abs(c.z - g.z) <= 1) hit.add(c.id);
    });
    let forbiddenKilled = false;
    const kills: Cube[] = [];
    for (const id of hit) {
      const c = this.cubes.byId(id);
      if (!c) continue;
      if (c.type === "forbidden") forbiddenKilled = true;
      kills.push(c);
    }
    // Chamber kills: no chain multiplier, no Scar/crumble for a Forbidden ("failure → no penalty")
    for (const c of kills) {
      const cell = { x: c.x, z: c.z };
      this.cubes.kill(c);
      this.kills++;
      this.events.push({ t: "Kill", id: c.id, type: c.type, x: cell.x, z: cell.z, chain: 1, index: 0, blast: false, points: c.type === "forbidden" ? 0 : TUNING.score.stone });
      if (c.type !== "forbidden") {
        this.score.add(TUNING.score.stone, "chamber kill", this.events);
        this.spawnTile(cell, "ground", null);
      }
    }
    const standardsLeft = ch.cubes.some((id) => {
      const c = this.cubes.byId(id);
      return c && c.type !== "forbidden";
    });
    const won = !standardsLeft && !forbiddenKilled;
    ch.result = won ? "won" : "lost";
    for (const id of ch.cubes) {
      const c = this.cubes.byId(id);
      if (c) this.cubes.kill(c); // survivors dissolve when time resumes
    }
    if (won) {
      this.chambersWon++;
      this.score.add(TUNING.score.chamber, "chamber", this.events);
      this.events.push({ t: "Announce", line: "beautiful" });
    }
    this.events.push({ t: "ChamberEnd", won });
    this.chamber = null;
    this.offerRunes(won);
  }

  pendingPicks = 0;

  pickRune(id: RuneId): void {
    if (!this.runeOffers || !this.runeOffers.includes(id)) return;
    this.run.runes = [...this.run.runes, id];
    this.pendingPicks--;
    if (this.pendingPicks > 0) {
      const available = RUNES.filter((r) => this.run.stacks(r.id) < r.maxStack).map((r) => r.id);
      this.runeOffers = available.length ? this.rng.stream("runes").shuffle([...available]).slice(0, 3) : null;
    } else this.runeOffers = null;
  }

  // ───────────────────────────────── Hundred director ─────────────────────────────────

  private stageTick(): void {
    const s = this.config.stage;
    if (!s) return;
    while (this.stageWaveIdx < s.waves.length && s.waves[this.stageWaveIdx]!.at <= this.tick) {
      const w = s.waves[this.stageWaveIdx++]!;
      this.spawnFormation(w.rows, 1, w.z);
    }
    const sf = s.skyfall ?? [];
    while (this.stageSkyIdx < sf.length && sf[this.stageSkyIdx]!.at <= this.tick) {
      const k = sf[this.stageSkyIdx++]!;
      this.spawnSkyfall(k.type ?? "stone", k.x, k.z, 1);
    }
    const bs = s.beacons ?? [];
    while (this.stageBeaconIdx < bs.length && bs[this.stageBeaconIdx]!.at <= this.tick) {
      const b = bs[this.stageBeaconIdx++]!;
      const beacon = this.beacons.spawn(b.x, b.z);
      this.events.push({ t: "BeaconSpawn", id: beacon.id, x: b.x, z: b.z });
    }
  }

  get stageWavesDone(): boolean {
    const s = this.config.stage;
    return !!s && this.stageWaveIdx >= s.waves.length && this.stageSkyIdx >= (s.skyfall?.length ?? 0);
  }

  private checkObjective(): void {
    const s = this.config.stage;
    if (this.config.mode !== "hundred" || !s || this.outcome) return;
    const o = s.objective;
    const p = this.player;
    let clear = false;
    if (o.type === "exit") clear = p.alive && p.z >= o.z && p.state === "idle";
    else if (o.type === "survive") clear = this.tick >= o.ticks;
    else clear = this.stageWavesDone && !this.cubes.alive().some((c) => isStandard(c.type));
    if (!clear) return;
    this.outcome = { kind: "clear", frame: this.frame };
    this.events.push({ t: "StageClear", stage: s.id, marks: this.marksPlaced, forbiddenKilled: this.forbiddenKilled });
  }

  /** Rating vs par: 1 ◇ cleared · 2 ◆ within par marks · 3 ✦ within par and no Forbidden killed. */
  rating(): 0 | 1 | 2 | 3 {
    const s = this.config.stage;
    if (!s || this.outcome?.kind !== "clear") return 0;
    if (this.marksPlaced > s.par) return 1;
    return this.forbiddenKilled === 0 ? 3 : 2;
  }

  // ───────────────────────────────── hashing ─────────────────────────────────

  serialize(): string {
    return [
      this.frame, this.tick, this.f, this.tickLen, this.sector, this.actionLock,
      this.grid.serialize(), this.cubes.serialize(), this.player.serialize(), this.marks.serialize(),
      this.score.serialize(), this.run.serialize(), this.crumble.serialize(), this.beacons.serialize(),
      this.lastStand.active ? this.lastStand.frames : -1, this.outcome?.kind ?? "-",
      this.chamber ? `${this.chamber.def.id}:${this.chamber.armed.map((a) => (a ? 1 : 0)).join("")}` : "-",
      JSON.stringify(this.rng.states())
    ].join("|");
  }

  stateHash(): string {
    const s = this.serialize();
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }
}
