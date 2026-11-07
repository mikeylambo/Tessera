import type { AudioEngine } from "./Engine";
import { dorianFreq, midiFreq } from "./Engine";
import type { SimEvent, AnnouncerLine } from "../sim/Events";
import type { CubeType } from "../sim/types";

export interface SfxClock {
  frame: number;
  alpha: number;
  f: number;
  tickLen: number;
}

const OCTAVE: Readonly<Record<CubeType, number>> = { glass: 5, stone: 4, advantage: 4, phase: 4, iron: 3, forbidden: 4 };

/** Distinct timbre per event (GDD §26). Kill = instant transient + tonal note quantized to the next 16th. */
export class Sfx {
  private voicesPerSlot = new Map<number, number>();
  private lastKillAt = 0;
  private humStop: (() => void) | null = null;

  constructor(private readonly e: AudioEngine) {}

  /** Audio time of the next 16th boundary + its slot id. */
  private next16th(c: SfxClock): { at: number; slot: number } {
    const s = c.tickLen / 8;
    const tickStart = c.frame - c.f;
    const nowF = c.frame + c.alpha;
    const k = Math.ceil((nowF - tickStart) / s - 1e-6);
    const fr = tickStart + k * s;
    return { at: this.e.now + Math.max(0, (fr - nowF) / 60) + 0.01, slot: Math.round(fr / s) };
  }

  handle(events: readonly SimEvent[], c: SfxClock): void {
    const e = this.e;
    if (!e.ctx) return;
    const now = e.now + 0.005;
    for (const ev of events) {
      switch (ev.t) {
        case "Tick": {
          // low stone thud on every tick, ducked −6 dB under kill notes
          const ducked = now - this.lastKillAt < 0.25 ? 0.5 : 1;
          e.tone(e.sfx, { freq: 70, glideTo: 46, at: now, decay: 0.18, gain: 0.16 * ducked });
          e.burst(e.sfx, { at: now, decay: 0.08, gain: 0.05 * ducked, freq: 240, q: 0.8, type: "lowpass" });
          break;
        }
        case "MarkPlaced": {
          const f = dorianFreq(ev.x, 6);
          e.tone(e.sfx, { freq: f, at: now, decay: 0.12, gain: ev.void ? 0.11 : 0.14, send: 0.4 });
          e.tone(e.sfx, { freq: f * 2.01, at: now, decay: 0.05, gain: 0.04 });
          if (ev.onForbidden) e.tone(e.sfx, { type: "sawtooth", freq: midiFreq(37), at: now, attack: 0.05, decay: 0.6, gain: 0.05, filter: 500, detune: 30 });
          break;
        }
        case "MarkRemoved":
          e.tone(e.sfx, { freq: dorianFreq(ev.x, 6) * 0.9, glideTo: dorianFreq(ev.x, 6) * 1.3, at: now, attack: 0.06, decay: 0.03, gain: 0.07 });
          break;
        case "Detonate":
          if (ev.marks === 0) e.burst(e.sfx, { at: now, decay: 0.03, gain: 0.05, freq: 600, q: 2 });
          break;
        case "Miss":
          e.burst(e.sfx, { at: now, decay: 0.05, gain: 0.07, freq: 420, q: 3 });
          e.tone(e.sfx, { type: "square", freq: 110, at: now, decay: 0.04, gain: 0.02, filter: 500 });
          break;
        case "Kill": {
          this.lastKillAt = now;
          // transient (0 ms): crack + body
          e.burst(e.sfx, { at: now, decay: ev.type === "glass" ? 0.18 : 0.1, gain: 0.32, freq: ev.type === "glass" ? 5200 : ev.type === "iron" ? 900 : 1800, q: 0.9, send: 0.3 });
          e.tone(e.sfx, { freq: ev.type === "iron" ? 90 : 140, glideTo: 50, at: now, decay: 0.15, gain: 0.2 });
          if (ev.type === "forbidden") break;
          // tonal note quantized to the next 16th; max 4 voices per slot, extra kills thicken the chord
          const q = this.next16th(c);
          const used = this.voicesPerSlot.get(q.slot) ?? 0;
          if (used >= 4) break;
          this.voicesPerSlot.set(q.slot, used + 1);
          if (this.voicesPerSlot.size > 64) this.voicesPerSlot = new Map([...this.voicesPerSlot].slice(-16));
          const oct = OCTAVE[ev.type];
          const f = dorianFreq(ev.x, oct);
          const g = 0.2 / Math.sqrt(1 + used);
          e.tone(e.sfx, { type: "triangle", freq: f, at: q.at, decay: 1.1, gain: g, send: 0.55 });
          e.tone(e.sfx, { freq: f * 2, at: q.at, decay: 0.6, gain: g * 0.35, send: 0.5 });
          if (ev.chain >= 3) e.tone(e.sfx, { type: "sine", freq: f * 1.5, at: q.at, attack: 0.02, decay: 1.6, gain: g * 0.5, send: 0.8 });
          if (ev.type === "advantage") e.tone(e.sfx, { freq: f * 4, at: q.at, decay: 1.8, gain: 0.05, send: 0.9 });
          if (ev.type === "phase") e.tone(e.sfx, { type: "triangle", freq: f * 1.5, at: q.at + 0.06, decay: 1, gain: g * 0.7, send: 0.6 });
          break;
        }
        case "IronHit":
          e.tone(e.sfx, { type: "square", freq: 420, at: now, decay: 0.12, gain: 0.06, filter: 2200 });
          e.tone(e.sfx, { freq: 1270, at: now, decay: 0.3, gain: 0.05, send: 0.3 });
          e.burst(e.sfx, { at: now, decay: 0.05, gain: 0.12, freq: 3200, q: 4 });
          break;
        case "BlastCharge":
          e.burst(e.sfx, { at: now, decay: 0.08, gain: 0.08, freq: 1500, sweepTo: 7000, attack: 0.06, q: 6, send: 0.6 });
          break;
        case "Blast": {
          // choir swell + sub
          for (const [m, d] of [[50, -8], [57, 6], [62, -4], [65, 9], [69, 0]] as const) e.tone(e.sfx, { type: "sawtooth", freq: midiFreq(m), at: now, attack: 0.18, decay: 1.6, gain: 0.035, filter: 1300, detune: d, send: 0.9 });
          e.tone(e.sfx, { freq: 55, glideTo: 30, at: now, decay: 0.9, gain: 0.5 });
          e.burst(e.sfx, { at: now, decay: 0.5, gain: 0.25, freq: 400, type: "lowpass", send: 0.5 });
          e.duck(4, 0.5);
          break;
        }
        case "ScarTorn":
          // dissonant tritone + rift tear; the rear row's sub thud follows via Crumble
          e.tone(e.sfx, { type: "sawtooth", freq: midiFreq(50), at: now, decay: 1.2, gain: 0.07, filter: 900, send: 0.6 });
          e.tone(e.sfx, { type: "sawtooth", freq: midiFreq(56), at: now, decay: 1.2, gain: 0.07, filter: 900, send: 0.6 });
          e.burst(e.sfx, { at: now, decay: 0.7, gain: 0.2, freq: 3000, sweepTo: 200, q: 3, send: 0.5 });
          break;
        case "SkyfallWarn":
          e.tone(e.sfx, { freq: 500, glideTo: 1800, at: now, attack: 0.6, decay: 1.6, gain: 0.04, send: 0.5 });
          break;
        case "SkyfallLand":
          e.tone(e.sfx, { freq: 80, glideTo: 35, at: now, decay: 0.4, gain: 0.4 });
          e.burst(e.sfx, { at: now, decay: 0.3, gain: 0.2, freq: 500, type: "lowpass" });
          break;
        case "Crush":
          e.tone(e.sfx, { freq: 95, glideTo: 40, at: now, decay: 0.35, gain: 0.45 });
          e.burst(e.sfx, { at: now + 0.05, decay: 0.35, gain: 0.12, freq: 1200, sweepTo: 300, q: 1.2 });
          break;
        case "CrumbleWarn": {
          const ctx = e.ctx;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(60, now);
          o.frequency.exponentialRampToValueAtTime(140, now + ev.frames / 60);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.exponentialRampToValueAtTime(0.06, now + ev.frames / 60);
          g.gain.exponentialRampToValueAtTime(0.0001, now + ev.frames / 60 + 0.1);
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = 600;
          o.connect(f).connect(g).connect(e.sfx);
          o.start(now);
          o.stop(now + ev.frames / 60 + 0.2);
          this.humStop = () => g.gain.setTargetAtTime(0.0001, e.now, 0.02);
          break;
        }
        case "Crumble":
          this.humStop?.();
          this.humStop = null;
          e.burst(e.sfx, { at: now, decay: 1.1, gain: 0.3, freq: 180, q: 0.7, type: "lowpass", send: 0.4 });
          e.tone(e.sfx, { type: "sawtooth", freq: 41, at: now, decay: 1, gain: 0.08, filter: 200 });
          break;
        case "BeaconCollected":
          [0, 4, 7].forEach((s, i) => e.tone(e.sfx, { type: "triangle", freq: midiFreq(74 + s + (i === 2 ? 5 : 0)), at: now + i * 0.09, decay: 0.7, gain: 0.1, send: 0.7 }));
          break;
        case "GlassCrack":
          for (let i = 0; i < 4; i++) e.burst(e.sfx, { at: now + i * 0.04, decay: 0.02, gain: 0.06, freq: 6000 + i * 600, q: 8 });
          break;
        case "TileFall":
          if (ev.reason === "glass") e.burst(e.sfx, { at: now, decay: 0.4, gain: 0.25, freq: 7000, q: 1.5, send: 0.5 });
          break;
        case "Purify":
          for (const m of [62, 66, 69, 74, 78]) e.tone(e.sfx, { type: "triangle", freq: midiFreq(m), at: now, attack: 0.1, decay: 2.8, gain: 0.06, send: 0.9 });
          e.duck(4, 0.5);
          break;
        case "Fall":
          e.tone(e.sfx, { freq: 440, glideTo: 60, at: now, decay: 1.4, gain: 0.12, send: 0.8 });
          break;
        case "Announce":
          this.announce(ev.line, now);
          break;
        default:
          break;
      }
    }
  }

  /** Placeholder announcer timbre (calm, warm) until recorded lines arrive via the manifest. */
  private announce(line: AnnouncerLine, at: number): void {
    const e = this.e;
    const notes: Record<AnnouncerLine, number[]> = { tessera: [62, 69], beautiful: [69, 74, 78], holdOn: [62, 60], purified: [66, 74], again: [69, 62] };
    notes[line].forEach((m, i) => e.tone(e.voice, { type: "sine", freq: midiFreq(m), at: at + 0.15 + i * 0.22, attack: 0.08, decay: 0.9, gain: 0.07, send: 0.8 }));
    e.duck(8, 0.9);
  }

  ui(kind: "tick" | "confirm"): void {
    const e = this.e;
    if (!e.ctx) return;
    const now = e.now;
    if (kind === "tick") e.tone(e.ui, { freq: 2350, at: now, decay: 0.05, gain: 0.06 });
    else {
      e.tone(e.ui, { type: "triangle", freq: midiFreq(50), at: now, decay: 0.5, gain: 0.12, send: 0.4 });
      e.tone(e.ui, { freq: midiFreq(62), at: now + 0.02, decay: 0.4, gain: 0.05, send: 0.4 });
    }
  }
}
