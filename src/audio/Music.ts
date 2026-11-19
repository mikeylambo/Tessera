import type { AudioEngine } from "./Engine";
import { midiFreq } from "./Engine";
import { AUDIO_MANIFEST } from "./manifest";

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
  /** Connected ground tiles (percussion layer enters above the economy band midpoint). */
  ground: number;
  lastStand: boolean;
}

/** Connected-ground target band is 28–49 tiles (TUNING_LOG); percussion enters above its midpoint. */
export const PERCUSSION_GROUND = 38;
/** A chain keeps the lead line alive for this many bars. */
const LEAD_BARS = 2;

/** Layers switch only on bar lines (brief §2.6). */
interface Layers {
  pad: boolean;
  bass: boolean;
  perc: boolean;
  lead: boolean;
  heartbeat: boolean;
}

/** Layer → manifest key. A file mapped there (8-bar loop, 100 BPM, D Dorian) replaces the synth layer. */
const STEM_KEYS: Readonly<Record<keyof Layers, string>> = { pad: "music.pad", bass: "music.bass", perc: "music.perc", lead: "music.lead", heartbeat: "music.heartbeat" };

// D Dorian progression, one chord per bar (4 beats = 2 ticks)
export const CHORDS: number[][] = [
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
  private layers: Layers = { pad: true, bass: false, perc: false, lead: false, heartbeat: false };
  private lastChainBar = -99;
  private pendingChain = false;
  private stems = new Map<keyof Layers, AudioBuffer>();
  private stemsLoading = false;

  constructor(private readonly e: AudioEngine) {}

  /** A chain resolved: the lead line enters at the next bar line. */
  onChain(): void {
    this.pendingChain = true;
  }

  /** Current layer state (dev/tests). */
  get activeLayers(): Readonly<Layers> {
    return this.layers;
  }

  /** Load any manifest stems (non-`synth:` entries). Missing files fall back to the synth silently. */
  private loadStems(): void {
    if (this.stemsLoading || !this.e.ctx) return;
    this.stemsLoading = true;
    const ctx = this.e.ctx;
    for (const [layer, key] of Object.entries(STEM_KEYS) as Array<[keyof Layers, string]>) {
      const src = AUDIO_MANIFEST[key];
      if (!src || src.startsWith("synth:")) continue;
      void fetch(src)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => this.stems.set(layer, buf))
        .catch(() => undefined);
    }
  }

  /** Decide layers at a bar line from game state — never mid-bar. */
  private chooseLayers(bar: number, m: MusicInputs): void {
    if (this.pendingChain) {
      this.lastChainBar = bar;
      this.pendingChain = false;
    }
    if (m.lastStand) {
      this.layers = { pad: true, bass: false, perc: false, lead: false, heartbeat: true }; // strip to pad + heartbeat
      return;
    }
    this.layers = { pad: true, bass: m.formationsSeen >= 3, perc: m.ground > PERCUSSION_GROUND, lead: bar - this.lastChainBar < LEAD_BARS, heartbeat: false };
  }

  /** Play one bar of a stem (bar index within its 8-bar loop), time-stretched to the current tick. */
  private stemBar(layer: keyof Layers, bar: number, at: number, barSeconds: number): boolean {
    const buf = this.stems.get(layer);
    const ctx = this.e.ctx;
    if (!buf || !ctx) return false;
    const srcBar = buf.duration / 8;
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.playbackRate.value = srcBar / barSeconds;
    node.connect(this.e.music);
    node.start(at, (bar % 8) * srcBar, srcBar);
    return true;
  }

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
    this.loadStems();
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
    if (inBar === 0) {
      this.chooseLayers(bar, m);
      const barSec = dur * 16;
      for (const k of Object.keys(this.layers) as Array<keyof Layers>) if (this.layers[k]) this.stemBar(k, bar, at, barSec);
    }
    const L = this.layers;
    const synth = (k: keyof Layers) => L[k] && !this.stems.has(k);
    // Last Stand heartbeat: a double low pulse on beat 1 and 3
    if (synth("heartbeat") && (inBar === 0 || inBar === 8)) {
      e.tone(e.music, { freq: 62, glideTo: 40, at, decay: 0.16, gain: 0.42 });
      e.tone(e.music, { freq: 58, glideTo: 38, at: at + dur * 1.5, decay: 0.2, gain: 0.3 });
    }
    // lead line during chains: chord tones on 8ths, an octave up, climbing then falling
    if (synth("lead") && id % 2 === 0) {
      const step = [0, 1, 2, 3, 2, 1, 2, 3][(inBar / 2) | 0]!;
      e.tone(e.music, { type: "triangle", freq: midiFreq(chord[step]! + 12), at, attack: 0.01, decay: dur * 3, gain: 0.05, send: 0.6 });
    }
    // percussion: soft kick on every beat (+ hats below)
    if (synth("perc") && beat) {
      e.tone(e.music, { freq: 110, glideTo: 42, at, decay: 0.22, gain: 0.5 });
      e.burst(e.music, { at, decay: 0.02, gain: 0.08, freq: 3000, type: "highpass" });
    }
    // sparse pads: one chord per bar (base layer)
    if (synth("pad") && inBar === 0) {
      for (const n of chord) e.tone(e.music, { type: "sawtooth", freq: midiFreq(n), at, attack: 0.9, decay: dur * 15, gain: 0.018, filter: 900 + this.tension * 1400, send: 0.7, detune: (n % 3) * 4 - 4 });
    }
    // mid (formation 3+): bass; hats ride with percussion
    if (synth("bass") && (inBar === 0 || inBar === 6 || inBar === 10)) e.tone(e.music, { type: "triangle", freq: midiFreq(chord[0]! - 24), at, decay: dur * 3, gain: 0.16, filter: 400 });
    if (synth("perc") && id % 4 === 2) e.burst(e.music, { at, decay: 0.035, gain: 0.035, freq: 8000, type: "highpass" });
    // ground ≤ 4 rows: tension strings
    if (this.tension > 0.5 && inBar % 8 === 0) e.tone(e.music, { type: "sawtooth", freq: midiFreq(chord[2]! + 12), at, attack: 0.5, decay: dur * 8, gain: 0.02 * this.tension, filter: 2400, send: 0.6, detune: 6 });
    // last stand: reversed-feel swells under the pad
    if (m.lastStand && inBar === 8) e.tone(e.music, { type: "square", freq: midiFreq(chord[1]!), at, attack: dur * 6, decay: 0.08, gain: 0.03, filter: 1600, send: 0.5 });
  }

  resetClock(): void {
    this.scheduled = -1;
  }
}
