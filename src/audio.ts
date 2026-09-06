import type { Note, Piece } from "./music";
import { soundDuration } from "./music";
import { SplendidGrandPiano, Soundfont } from "smplr";
export const instruments = {
  grand: { label: "Grand piano", sample: "" },
  classical: { label: "Classical piano", sample: "acoustic_grand_piano" },
  bright: { label: "Bright piano", sample: "bright_acoustic_piano" },
  electric: { label: "Electric piano", sample: "electric_piano_1" },
  guitar: { label: "Classical guitar", sample: "acoustic_guitar_nylon" },
  steel: { label: "Steel-string guitar", sample: "acoustic_guitar_steel" },
  harp: { label: "Harp", sample: "orchestral_harp" },
  organ: { label: "Church organ", sample: "church_organ" },
  violin: { label: "Violin", sample: "violin" },
  flute: { label: "Flute", sample: "flute" },
} as const;
export type InstrumentId = keyof typeof instruments;
export function activeAt(notes: Note[], time: number) {
  return notes.filter((n) => n.time <= time && n.time + n.duration > time);
}
export type HandBalance = { left: number; right: number };
export function performanceVelocity(note: Note, balance: HandBalance) {
  return Math.max(
    0,
    Math.min(1, note.velocity * (note.hand ? balance[note.hand] : 1)),
  );
}
export class Player {
  instrument: InstrumentId = "grand";
  private soundGeneration = 0;
  private instrumentCache = new Map<
    InstrumentId,
    ReturnType<typeof SplendidGrandPiano>
  >();
  get instrumentLabel() {
    return instruments[this.instrument].label;
  }
  async setInstrument(id: InstrumentId) {
    if (!(id in instruments) || id === this.instrument) return;
    this.pause();
    this.soundGeneration++;
    this.instrument = id;
    this.grand = undefined;
    this.grandReady = false;
    this.sampleAttempted = false;
    this.pendingGrand = undefined;
    this.soundState = "synth";
    await this.loadGrand();
  }
  context?: AudioContext;
  gain?: GainNode;
  piece?: Piece;
  playing = false;
  preparing = false;
  soundState: "synth" | "loading" | "grand" | "fallback" = "synth";
  position = 0;
  speed = 1;
  volume = 0.65;
  handBalance: HandBalance = { left: 0.75, right: 1 };
  loop = false;
  a = 0;
  b = 0;
  private anchor = 0;
  private offset = 0;
  private scheduled = new Set<number>();
  private voices = new Set<OscillatorNode>();
  private grand?: ReturnType<typeof SplendidGrandPiano>;
  private grandReady = false;
  private generation = 0;
  private sampleAttempted = false;
  private sampleCancels = new Set<() => void>();
  private voiceId = 0;
  private pendingGrand?: Promise<void>;
  async loadGrand() {
    if (this.grandReady) return;
    if (this.pendingGrand) return this.pendingGrand;
    const pending = this.prepareGrand();
    this.pendingGrand = pending;
    try {
      await this.pendingGrand;
    } finally {
      if (this.pendingGrand === pending) this.pendingGrand = undefined;
    }
  }
  private async prepareGrand() {
    const generation = this.soundGeneration;
    const instrument = this.instrument;
    this.sampleAttempted = true;
    this.soundState = "loading";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await this.init();
      if (generation !== this.soundGeneration) return;
      let voice = this.instrumentCache.get(instrument);
      if (!voice) {
        voice =
          instrument === "grand"
            ? SplendidGrandPiano(this.context!, {
                destination: this.gain!,
                decayTime: 0.12,
              })
            : Soundfont(this.context!, {
                destination: this.gain!,
                kit: "MusyngKite",
                instrument: instruments[instrument].sample,
              });
        this.instrumentCache.set(instrument, voice);
      }
      await Promise.race([
        voice.ready,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("Sample timeout")), 20000);
        }),
      ]);
      if (generation !== this.soundGeneration) return;
      this.grand = voice;
      this.grandReady = true;
      this.soundState = "grand";
    } catch (error) {
      if (generation !== this.soundGeneration) return;
      this.instrumentCache.delete(instrument);
      this.soundState = "fallback";
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async init() {
    this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -8;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      this.gain.connect(compressor).connect(this.context.destination);
    }
    this.gain.gain.value = this.volume * 0.2;
    await this.context.resume();
  }
  tone(midi: number, duration: number, velocity = 0.7, delay = 0, at?: number) {
    if (!this.context || !this.gain) return;
    const ctx = this.context;
    const start = at ?? ctx.currentTime + delay;
    if (this.grandReady) {
      const cancel = this.grand!.start({
        note: midi,
        time: start,
        duration,
        velocity: Math.round(velocity * 127),
        stopId: ++this.voiceId,
      });
      this.sampleCancels.add(cancel);
      setTimeout(
        () => this.sampleCancels.delete(cancel),
        (Math.max(0, start - ctx.currentTime) + duration + 1) * 1000,
      );
      return;
    }
    const env = ctx.createGain();
    env.connect(this.gain);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(velocity, start + 0.006);
    env.gain.exponentialRampToValueAtTime(
      Math.max(0.001, velocity * 0.2),
      start + Math.max(0.02, duration),
    );
    env.gain.exponentialRampToValueAtTime(0.001, start + duration + 0.12);
    [1, 2, 3].forEach((harmonic, i) => {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12) * harmonic;
      gain.gain.value = [0.75, 0.17, 0.08][i];
      osc.connect(gain).connect(env);
      this.voices.add(osc);
      osc.onended = () => {
        this.voices.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(start);
      osc.stop(start + duration + 0.15);
    });
    setTimeout(() => env.disconnect(), (delay + duration + 0.3) * 1000);
  }
  silence() {
    for (const cancel of this.sampleCancels) cancel();
    this.sampleCancels.clear();
    this.grand?.stop();
    for (const v of this.voices) {
      try {
        v.stop();
      } catch {
        /* already ended */
      }
    }
    this.voices.clear();
    this.scheduled.clear();
  }
  load(piece: Piece) {
    this.pause();
    this.piece = piece;
    this.position = 0;
    this.a = 0;
    this.b = piece.duration;
    this.loop = false;
  }
  async play() {
    const gen = ++this.generation;
    this.preparing = true;
    try {
      await this.init();
      if (gen !== this.generation) return;
      if (!this.sampleAttempted || this.pendingGrand) {
        try {
          await this.loadGrand();
        } catch {
          /* Explicitly labeled synth fallback if samples cannot load. */
        }
      }
      if (gen !== this.generation || !this.piece) return;
      this.preparing = false;
      if (
        this.position >= this.piece.duration ||
        (this.loop && (this.position < this.a || this.position >= this.b))
      )
        this.position = this.loop ? this.a : 0;
      this.silence();
      this.offset = this.position;
      this.anchor = this.context!.currentTime;
      this.playing = true;
      this.tick();
    } finally {
      if (gen === this.generation) this.preparing = false;
    }
  }
  pause() {
    this.generation++;
    this.preparing = false;
    if (this.playing) this.position = this.now();
    this.playing = false;
    this.silence();
  }
  now() {
    return this.playing
      ? this.offset + (this.context!.currentTime - this.anchor) * this.speed
      : this.position;
  }
  seek(time: number) {
    if (!Number.isFinite(time)) return;
    const playing = this.playing;
    this.pause();
    this.position = Math.max(0, Math.min(this.piece?.duration || 0, time));
    if (playing) void this.play();
  }
  setSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed <= 0) return;
    const playing = this.playing;
    this.pause();
    this.speed = speed;
    if (playing) void this.play();
  }
  tick() {
    if (!this.playing || !this.piece) return;
    this.position = this.now();
    const end = this.loop ? this.b : this.piece.duration;
    if (this.position >= end) {
      if (this.loop) this.seek(this.a);
      else {
        this.pause();
        this.position = this.piece.duration;
      }
      return;
    }
    this.piece.notes.forEach((n, i) => {
      if (
        this.scheduled.has(i) ||
        n.time + soundDuration(n) <= this.offset ||
        n.time >= end
      )
        return;
      if (n.time <= this.position + 0.12 * this.speed) {
        this.scheduled.add(i);
        const duration =
          (Math.min(n.time + soundDuration(n), end) -
            Math.max(n.time, this.position)) /
          this.speed;
        const velocity = performanceVelocity(n, this.handBalance);
        if (duration > 0 && velocity > 0)
          this.tone(
            n.midi,
            duration,
            velocity,
            Math.max(0, (n.time - this.position) / this.speed),
            this.anchor +
              (Math.max(n.time, this.position) - this.offset) / this.speed,
          );
      }
    });
  }
}
