import type { AudioEngine } from "./Engine";
import { midiFreq } from "./Engine";

export type MusicState = "title" | "play" | "chamber" | "results" | "fall";

export interface MusicInputs {
  /** Sim frame (+ interpolation alpha) — the music follows the tick, never the reverse. */
  frame: number;
  alpha: number;
  tick: number;
  f: number;
  tickLen: number;
  formationsSeen: number;
  groundRows: number;
  lastStand: boolean;
}

// D Dorian progression, one chord per bar (4 beats = 2 ticks)
const CHORDS: number[][] = [
  [50, 57, 60, 65], // Dm(add9-ish): D A C F
  [48, 55, 60, 64], // C: C G C E
  [46, 53, 57, 62], // Bb: Bb F A D
  [47, 55, 59, 62] // G/B: B G B D (Dorian's raised 6th colour)
];

/** Adaptive layers (GDD §26 table). Beats are scheduled from sim frames: BPM = 7200 / tick. */
export class Music {
  state: MusicState = "title";
  private scheduled = -1;
  private drone: { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private tension = 0;

  constructor(private readonly e: AudioEngine) {}

  private ensureDrone(): void {
    const ctx = this.e.ctx;
    if (!ctx || this.drone) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
    filter.connect(gain).connect(this.e.music);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    gain.connect(send).connect(this.e.reverbSend);
    const osc: OscillatorNode[] = [];
    for (const [m, d, t] of [[38, -6, "sawtooth"], [38, 7, "sawtooth"], [45, 3, "triangle"], [26, 0, "sine"]] as const) {
      const o = ctx.createOscillator();
      o.type = t;
      o.frequency.value = midiFreq(m);
      o.detune.value = d;
      o.connect(filter);
      o.start();
      osc.push(o);
    }
    this.drone = { osc, gain, filter };
  }

  setState(s: MusicState): void {
    this.state = s;
    this.ensureDrone();
    const ctx = this.e.ctx;
    if (!ctx || !this.drone) return;
    const t = ctx.currentTime;
    const level = s === "title" ? 0.16 : s === "fall" ? 0.2 : s === "results" ? 0.14 : 0.12;
    this.drone.gain.gain.setTargetAtTime(level, t, s === "fall" ? 0.05 : 0.8);
    if (s === "title") this.bell(t + 0.4);
  }

  private bell(at: number): void {
    for (const [m, g] of [[74, 0.06], [86, 0.025], [93, 0.012]] as const) this.e.tone(this.e.music, { freq: midiFreq(m), at, decay: 3.5, gain: g, send: 0.8 });
  }

  /** Schedule the next ~120 ms of 16ths. */
  update(m: MusicInputs): void {
    const ctx = this.e.ctx;
    if (!ctx || ctx.state !== "running") return;
    this.ensureDrone();
    if (this.state !== "play" && this.state !== "chamber") return;
    const sixteenth = m.tickLen / 8;
    const tickStart = m.frame - m.f;
    const nowF = m.frame + m.alpha;
    const ahead = 8; // frames of lookahead
    // tension layer: ground ≤ 4 rows opens the pad low-pass and adds strings
    this.tension += ((m.groundRows <= 4 ? 1 : 0) - this.tension) * 0.02;
    if (this.drone) this.drone.filter.frequency.setTargetAtTime(320 + this.tension * 900 + (m.lastStand ? 600 : 0), ctx.currentTime, 0.3);
    for (let tk = m.tick; tk <= m.tick + 1; tk++) {
      for (let k = 0; k < 8; k++) {
        const id = tk * 8 + k;
        if (id <= this.scheduled) continue;
        const fr = tickStart + (tk - m.tick) * m.tickLen + k * sixteenth;
        if (fr > nowF + ahead) return;
        this.scheduled = id;
        if (fr < nowF - 1) continue;
        const at = ctx.currentTime + (fr - nowF) / 60 + 0.02;
        this.sixteenth(id, at, m, sixteenth / 60);
      }
    }
  }

  private sixteenth(id: number, at: number, m: MusicInputs, dur: number): void {
    const e = this.e;
    const beat = id % 4 === 0;
    const bar = Math.floor(id / 16);
    const inBar = id % 16;
    const chord = CHORDS[bar % CHORDS.length]!;
    if (this.state === "chamber") {
      if (inBar === 0) e.tone(e.music, { type: "sawtooth", freq: midiFreq(chord[0]! - 12), at, attack: 0.4, decay: dur * 15, gain: 0.05, filter: 700, send: 0.6 });
      return;
    }
    // soft kick on every beat
    if (beat) {
      e.tone(e.music, { freq: 110, glideTo: 42, at, decay: 0.22, gain: 0.5 });
      e.burst(e.music, { at, decay: 0.02, gain: 0.08, freq: 3000, type: "highpass" });
    }
    // sparse pads: one chord per bar
    if (inBar === 0) {
      for (const n of chord) e.tone(e.music, { type: "sawtooth", freq: midiFreq(n), at, attack: 0.9, decay: dur * 15, gain: 0.018, filter: 900 + this.tension * 1400, send: 0.7, detune: (n % 3) * 4 - 4 });
    }
    // mid (formation 3+): bass + hats
    if (m.formationsSeen >= 3) {
      if (inBar === 0 || inBar === 6 || inBar === 10) e.tone(e.music, { type: "triangle", freq: midiFreq(chord[0]! - 24), at, decay: dur * 3, gain: 0.16, filter: 400 });
      const hat = m.lastStand ? id % 2 === 1 : id % 4 === 2;
      if (hat) e.burst(e.music, { at, decay: 0.035, gain: m.lastStand ? 0.05 : 0.035, freq: 8000, type: "highpass" });
    }
    // ground ≤ 4 rows: tension strings
    if (this.tension > 0.5 && inBar % 8 === 0) e.tone(e.music, { type: "sawtooth", freq: midiFreq(chord[2]! + 12), at, attack: 0.5, decay: dur * 8, gain: 0.02 * this.tension, filter: 2400, send: 0.6, detune: 6 });
    // last stand: reversed-feel swells + grit
    if (m.lastStand && inBar === 8) e.tone(e.music, { type: "square", freq: midiFreq(chord[1]!), at, attack: dur * 6, decay: 0.08, gain: 0.03, filter: 1600, send: 0.5 });
  }

  resetClock(): void {
    this.scheduled = -1;
  }
}
