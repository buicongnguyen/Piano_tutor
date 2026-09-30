// One AudioContext for the whole game: a sampled grand for the player's notes
// and menu music, General MIDI voices for ensemble accompaniment, a synth
// fallback when samples can't load, and separate music / effects buses.
import { SplendidGrandPiano, Soundfont } from "smplr";
import { gmInstruments } from "../gm-instruments";

type Sampler = ReturnType<typeof SplendidGrandPiano>;
export type Stop = () => void;

const TIMEOUT = 20000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(Error("Sample timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export class SoundBank {
  ctx?: AudioContext;
  master?: GainNode;
  music?: GainNode;
  sfx?: GainNode;
  piano?: Sampler;
  pianoState: "idle" | "loading" | "ready" | "fallback" = "idle";
  private pendingPiano?: Promise<boolean>;
  private voices = new Map<number, Sampler>();
  private failed = new Set<number>(); // GM programs that failed to load this session
  onInterrupted?: () => void; // the OS suspended or interrupted audio
  private stops = new Set<Stop>();
  private oscillators = new Set<OscillatorNode>();
  musicVolume = 0.8;
  effectsVolume = 0.7;

  get ready() {
    return !!this.ctx;
  }

  /** Must run from a user gesture the first time (autoplay policy). */
  async init() {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -10;
      compressor.knee.value = 10;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.music = ctx.createGain();
      this.sfx = ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(compressor).connect(ctx.destination);
      this.ctx = ctx;
      this.setVolumes(this.musicVolume, this.effectsVolume);
      ctx.addEventListener("statechange", () => {
        if (ctx.state !== "running") this.onInterrupted?.();
      });
    }
    if (this.ctx.state !== "running") await this.ctx.resume().catch(() => undefined);
  }

  setVolumes(music: number, effects: number) {
    this.musicVolume = music;
    this.effectsVolume = effects;
    if (this.music) this.music.gain.value = 0.32 * music;
    if (this.sfx) this.sfx.gain.value = 0.5 * effects;
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  /** Seconds between scheduling a sound and hearing it. */
  get latency() {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | undefined;
    if (!c) return 0;
    return (c.outputLatency || 0) + (c.baseLatency || 0);
  }

  /** Audio-context time that is being heard at `perfMs` (performance.now() clock). */
  heardAt(perfMs: number) {
    const c = this.ctx;
    if (!c) return 0;
    const stamp = c.getOutputTimestamp?.();
    if (stamp && stamp.contextTime && stamp.performanceTime)
      return stamp.contextTime + (perfMs - stamp.performanceTime) / 1000;
    return c.currentTime - this.latency + (perfMs - performance.now()) / 1000;
  }

  loadPiano(): Promise<boolean> {
    if (this.pianoState === "ready") return Promise.resolve(true);
    if (this.pendingPiano) return this.pendingPiano;
    this.pianoState = "loading";
    this.pendingPiano = (async () => {
      try {
        await this.init();
        const piano = SplendidGrandPiano(this.ctx!, { destination: this.music!, decayTime: 0.35 });
        await withTimeout(piano.ready, TIMEOUT);
        this.piano = piano;
        this.pianoState = "ready";
        return true;
      } catch {
        this.pianoState = "fallback";
        return false;
      } finally {
        this.pendingPiano = undefined;
      }
    })();
    return this.pendingPiano;
  }

  /** Load General MIDI voices for accompaniment (piano program 0 uses the grand). */
  async loadPrograms(programs: number[]): Promise<number> {
    await this.init();
    const wanted = [...new Set(programs)]
      .filter((p) => Number.isInteger(p) && p > 0 && p < 128 && !this.failed.has(p))
      .slice(0, 10);
    const results = await Promise.allSettled(
      wanted.map(async (program) => {
        if (this.voices.has(program)) return;
        const voice = Soundfont(this.ctx!, {
          destination: this.music!,
          kit: "MusyngKite",
          instrument: gmInstruments[program],
        });
        try {
          await withTimeout(voice.ready, TIMEOUT);
        } catch (error) {
          this.failed.add(program); // play with the piano instead; don't retry every stage
          throw error;
        }
        this.voices.set(program, voice);
      }),
    );
    return results.filter((r) => r.status === "fulfilled").length;
  }

  failedProgram(program: number) {
    return this.failed.has(program);
  }

  hasProgram(program?: number) {
    return program !== undefined && this.voices.has(program);
  }

  /** Schedule a note at audio time `at`. Returns a stop handle. */
  note(midi: number, at: number, duration: number, velocity: number, program?: number, gain = 1): Stop {
    if (!this.ctx || !this.music) return () => undefined;
    const voice = (program ? this.voices.get(program) : undefined) ?? (this.pianoState === "ready" ? this.piano : undefined);
    const vel = Math.max(1, Math.min(127, Math.round(velocity * gain * 127)));
    if (voice) {
      const stop = voice.start({ note: midi, time: at, duration: Math.max(0.05, duration), velocity: vel });
      this.stops.add(stop);
      setTimeout(() => this.stops.delete(stop), (Math.max(0, at - this.ctx.currentTime) + duration + 2) * 1000);
      return () => {
        stop(this.ctx!.currentTime);
        this.stops.delete(stop);
      };
    }
    return this.synth(midi, at, duration, velocity * gain);
  }

  private synth(midi: number, at: number, duration: number, velocity: number): Stop {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.connect(this.music!);
    const v = Math.max(0.02, velocity) * 0.55;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(v, at + 0.006);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, v * 0.25), at + Math.max(0.05, duration));
    env.gain.exponentialRampToValueAtTime(0.0005, at + duration + 0.25);
    const oscs = [1, 2, 3].map((h, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i ? "sine" : "triangle";
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12) * h;
      g.gain.value = [0.8, 0.18, 0.07][i];
      osc.connect(g).connect(env);
      osc.start(at);
      osc.stop(at + duration + 0.3);
      this.oscillators.add(osc);
      osc.onended = () => {
        this.oscillators.delete(osc);
        osc.disconnect();
        g.disconnect();
      };
      return osc;
    });
    return () => {
      const t = ctx.currentTime;
      env.gain.cancelScheduledValues(t);
      env.gain.setTargetAtTime(0, t, 0.03);
      for (const o of oscs)
        try {
          o.stop(t + 0.15);
        } catch {
          /* already stopped */
        }
    };
  }

  /** Stop every sounding and scheduled note (pause, quit). */
  stopAll() {
    for (const stop of this.stops) stop();
    this.stops.clear();
    this.piano?.stop();
    for (const v of this.voices.values()) v.stop();
    for (const o of this.oscillators)
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    this.oscillators.clear();
  }

  // ------------------------------------------------------------ effects

  /** A short synthesized effect on the effects bus. */
  blip(kind: "tap" | "select" | "back" | "stray" | "miss" | "star" | "combo" | "encore" | "count" | "go" | "unlock", pitch = 0) {
    const ctx = this.ctx,
      out = this.sfx;
    if (!ctx || !out || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.005;
    const tone = (freq: number, start: number, dur: number, type: OscillatorType, vol: number, slide = 1) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, start + dur);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + dur + 0.02);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    };
    const noise = (start: number, dur: number, vol: number, from: number, to: number) => {
      const len = Math.ceil(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(to, start + dur);
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(filter).connect(g).connect(out);
      src.start(start);
      src.onended = () => {
        src.disconnect();
        filter.disconnect();
        g.disconnect();
      };
    };
    const penta = [0, 2, 4, 7, 9, 12, 14, 16];
    const f = (semi: number) => 523.25 * 2 ** (semi / 12);
    switch (kind) {
      case "tap":
        tone(f(penta[pitch % penta.length]), t, 0.07, "sine", 0.18);
        break;
      case "select":
        tone(f(7), t, 0.09, "triangle", 0.2);
        tone(f(12), t + 0.06, 0.14, "triangle", 0.2);
        break;
      case "back":
        tone(f(7), t, 0.08, "triangle", 0.18);
        tone(f(0), t + 0.05, 0.12, "triangle", 0.16);
        break;
      case "stray":
        tone(180, t, 0.07, "triangle", 0.12, 0.7);
        break;
      case "miss":
        tone(120, t, 0.14, "sine", 0.22, 0.6);
        noise(t, 0.08, 0.06, 900, 300);
        break;
      case "star":
        [0, 4, 7, 12].forEach((s, i) => tone(f(s + 12 + pitch), t + i * 0.045, 0.35, "sine", 0.14));
        tone(f(24 + pitch), t + 0.18, 0.6, "triangle", 0.08);
        break;
      case "combo":
        [0, 4, 7, 11, 14].forEach((s, i) => tone(f(s + 12), t + i * 0.035, 0.22, "sine", 0.1));
        break;
      case "encore":
        noise(t, 0.7, 0.25, 300, 5000);
        [0, 4, 7, 12, 16].forEach((s, i) => tone(f(s), t + 0.1 + i * 0.05, 0.9, "sawtooth", 0.035));
        break;
      case "count":
        tone(f(7), t, 0.1, "square", 0.08);
        break;
      case "go":
        tone(f(12), t, 0.25, "square", 0.1);
        tone(f(19), t, 0.25, "square", 0.06);
        break;
      case "unlock":
        [0, 7, 12, 16, 19, 24].forEach((s, i) => tone(f(s - 5), t + i * 0.07, 0.5, "triangle", 0.12));
        noise(t + 0.3, 0.6, 0.12, 2000, 8000);
        break;
    }
  }
}
