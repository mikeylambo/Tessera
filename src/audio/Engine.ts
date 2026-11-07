import { cosmetic } from "../render/cosmetic";
/** Web Audio core: context, buses (music / sfx / voice / ui), reverb send, limiter. Synth voices are final unless the manifest overrides. */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  musicDuck!: GainNode;
  sfx!: GainNode;
  voice!: GainNode;
  ui!: GainNode;
  reverb!: ConvolverNode;
  reverbSend!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  volumes = { master: 1, music: 0.8, sfx: 0.9, voice: 0.9, ui: 0.9, muted: false };

  /** Must be called from a user gesture (title "Press any key" unlocks audio). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx({ latencyHint: "interactive" });
    this.ctx = ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.connect(limiter).connect(ctx.destination);
    this.musicDuck = ctx.createGain();
    this.music = ctx.createGain();
    this.music.connect(this.musicDuck).connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.voice = ctx.createGain();
    this.voice.connect(this.master);
    this.ui = ctx.createGain();
    this.ui.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.applyVolumes();
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setVolumes(v: Partial<AudioEngine["volumes"]>): void {
    this.volumes = { ...this.volumes, ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const m = this.volumes.muted ? 0 : this.volumes.master;
    this.master.gain.value = m * 0.8;
    this.music.gain.value = this.volumes.music * 0.55;
    this.sfx.gain.value = this.volumes.sfx;
    this.voice.gain.value = this.volumes.voice;
    this.ui.gain.value = this.volumes.ui * 0.7;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /** Music ducks 4 dB for 500 ms on Climax events; announcer ducks −8 dB. */
  duck(db: number, seconds: number): void {
    if (!this.ctx) return;
    const g = this.musicDuck.gain;
    const t = this.ctx.currentTime;
    const k = Math.pow(10, -db / 20);
    g.cancelScheduledValues(t);
    g.setTargetAtTime(k, t, 0.02);
    g.setTargetAtTime(1, t + seconds, 0.15);
  }

  noise(): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    this.noiseBuf = b;
    return b;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let seed = 777 + c * 31;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d[i] = ((seed / 4294967296) * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return b;
  }

  // ── voice helpers ─────────────────────────────────────────────────────────

  /** Enveloped oscillator into `dest`; returns the gain for chaining. */
  tone(dest: AudioNode, opts: { type?: OscillatorType; freq: number; at: number; attack?: number; decay: number; gain: number; detune?: number; glideTo?: number; send?: number; filter?: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = opts.type ?? "sine";
    o.frequency.setValueAtTime(opts.freq, opts.at);
    if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, opts.at + opts.decay);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, opts.at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), opts.at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, opts.at + a + opts.decay);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opts.filter;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(dest);
    if (opts.send) {
      const s = ctx.createGain();
      s.gain.value = opts.send;
      g.connect(s).connect(this.reverbSend);
    }
    o.start(opts.at);
    o.stop(opts.at + a + opts.decay + 0.05);
  }

  /** Filtered noise burst. */
  burst(dest: AudioNode, opts: { at: number; decay: number; gain: number; freq: number; q?: number; type?: BiquadFilterType; sweepTo?: number; attack?: number; send?: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass";
    f.frequency.setValueAtTime(opts.freq, opts.at);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, opts.at + opts.decay);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, opts.at);
    g.gain.exponentialRampToValueAtTime(opts.gain, opts.at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, opts.at + a + opts.decay);
    src.connect(f).connect(g).connect(dest);
    if (opts.send) {
      const s = ctx.createGain();
      s.gain.value = opts.send;
      g.connect(s).connect(this.reverbSend);
    }
    src.start(opts.at, cosmetic.range(0, 1.5));
    src.stop(opts.at + a + opts.decay + 0.05);
  }
}

/** D Dorian, columns 0–6 = D E F G A B C (GDD §26). */
export const DORIAN = [0, 2, 3, 5, 7, 9, 10];
export function dorianFreq(column: number, octave: number): number {
  const semis = DORIAN[Math.max(0, Math.min(6, column))]!;
  const midi = 12 * (octave + 1) + 2 + semis; // D in the given octave
  return 440 * Math.pow(2, (midi - 69) / 12);
}
export function midiFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
