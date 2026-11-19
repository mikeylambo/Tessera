import type { AudioEngine } from "./Engine";
import { dorianFreq, midiFreq } from "./Engine";
import { CHORDS } from "./Music";
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
    if (!e.ctx || e.ctx.state !== "running") return;
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
          // dry, short, muted click — no reverb send, no pitch: wasted, never punished
          e.burst(e.sfx, { at: now, decay: 0.025, gain: 0.06, freq: 520, q: 2.5 });
          break;
        case "Kill": {
          this.lastKillAt = now;
          // transient (0 ms): crack + body
          if (ev.type === "forbidden") {
            // dissonant violet shatter: glassy tritone cluster + a falling crack (distinct by ear from every kill)
            e.burst(e.sfx, { at: now, decay: 0.35, gain: 0.3, freq: 4200, sweepTo: 900, q: 6, send: 0.5 });
            for (const [m, d] of [[61, -12], [67, 14], [73, 0]] as const) e.tone(e.sfx, { type: "sawtooth", freq: midiFreq(m), at: now, decay: 0.9, gain: 0.045, filter: 2600, detune: d, send: 0.7 });
            break;
          }
          e.burst(e.sfx, { at: now, decay: ev.type === "glass" ? 0.18 : 0.1, gain: 0.32, freq: ev.type === "glass" ? 5200 : ev.type === "iron" ? 900 : 1800, q: 0.9, send: 0.3 });
          const q = this.next16th(c);
          // the low thump lands on the next 16th of the music
          if (ev.index === 0) e.tone(e.sfx, { freq: ev.type === "iron" ? 90 : 120, glideTo: 42, at: q.at, decay: 0.2, gain: 0.26 });
          const sixteenth = c.tickLen / 8 / 60;
          const oct = OCTAVE[ev.type];
          if (ev.chain <= 1) {
            // single kill: column → D Dorian degree (GDD §26)
            const f = dorianFreq(ev.x, oct);
            this.note(f, q.at, 0.2, ev.type);
            break;
          }
          // chains climb the current chord (one note per 16th), never repeat; the final kill resolves on the downbeat
          const bar = Math.floor(q.slot / 16);
          const chord = CHORDS[((bar % CHORDS.length) + CHORDS.length) % CHORDS.length]!;
          const ladder = (i: number) => chord[i % chord.length]! + 12 * Math.floor(i / chord.length) + 12;
          const at = q.at + ev.index * sixteenth;
          const g = 0.17;
          if (ev.index < ev.chain - 1 || ev.chain < 3) this.note(midiFreq(ladder(ev.index)), at, g, ev.type);
          else {
            const lastSlot = q.slot + ev.index;
            const down = Math.ceil((lastSlot + 1) / 4) * 4; // next beat boundary after the run
            const t = q.at + (down - q.slot) * sixteenth;
            const root = chord[0]! + 12;
            for (const m of [root - 12, root, root + 7, root + 12, root + 16 - (chord === CHORDS[0] ? 1 : 0)]) e.tone(e.sfx, { type: "triangle", freq: midiFreq(m), at: t, attack: 0.01, decay: 1.8, gain: 0.07, send: 0.8 });
            e.tone(e.sfx, { freq: midiFreq(root - 24), at: t, decay: 0.9, gain: 0.22 });
          }
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
          // heavy dull impact (no ring) + the shove's stone skid
          e.tone(e.sfx, { freq: 72, glideTo: 34, at: now, decay: 0.45, gain: 0.55 });
          e.burst(e.sfx, { at: now, decay: 0.12, gain: 0.3, freq: 260, type: "lowpass" });
          e.burst(e.sfx, { at: now + 0.06, decay: 0.32, gain: 0.1, freq: 900, sweepTo: 240, q: 1.4 });
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
        case "Fall": {
          // a long reversed swell that cuts into silence
          const ctx = e.ctx;
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sawtooth";
          o.frequency.setValueAtTime(midiFreq(38), now);
          const lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.setValueAtTime(300, now);
          lp.frequency.exponentialRampToValueAtTime(2400, now + 1.8);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.exponentialRampToValueAtTime(0.11, now + 1.8);
          g.gain.setValueAtTime(0.0001, now + 1.82);
          o.connect(lp).connect(g).connect(e.sfx);
          o.start(now);
          o.stop(now + 1.9);
          e.duck(12, 2.4);
          break;
        }
        case "TurnWarn":
          // cold rising fifth: the construct is about to move (distinct from the Crumble hum)
          e.tone(e.sfx, { type: "triangle", freq: midiFreq(50), glideTo: midiFreq(57), at: now, attack: 0.3, decay: ev.frames / 60, gain: 0.05, send: 0.8 });
          e.tone(e.sfx, { freq: midiFreq(74), at: now + 0.2, attack: 0.4, decay: ev.frames / 60, gain: 0.025, send: 0.9 });
          break;
        case "Turn":
          // the construct turns: deep stone groan under a slow open chord
          e.burst(e.sfx, { at: now, decay: 1.2, gain: 0.32, freq: 140, sweepTo: 60, q: 0.8, type: "lowpass", send: 0.5 });
          for (const m of [38, 45, 50, 57]) e.tone(e.sfx, { type: "sawtooth", freq: midiFreq(m), at: now, attack: 0.25, decay: 1.4, gain: 0.03, filter: 900, send: 0.8 });
          e.duck(4, 1);
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

  private note(f: number, at: number, g: number, type: CubeType): void {
    const e = this.e;
    e.tone(e.sfx, { type: "triangle", freq: f, at, decay: 1.1, gain: g, send: 0.55 });
    e.tone(e.sfx, { freq: f * 2, at, decay: 0.6, gain: g * 0.35, send: 0.5 });
    if (type === "advantage") e.tone(e.sfx, { freq: f * 4, at, decay: 1.8, gain: 0.05, send: 0.9 });
    if (type === "phase") e.tone(e.sfx, { type: "triangle", freq: f * 1.5, at: at + 0.06, decay: 1, gain: g * 0.7, send: 0.6 });
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
