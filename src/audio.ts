import { gmInstruments } from "./gm-instruments";
import type { Note, Piece } from "./music";
import { soundDuration } from "./music";
import { hasBothHands, scoreBeats, type PracticeHand } from "./practice";
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
  saw: { label: "Electronic · Saw lead", sample: "lead_2_sawtooth" },
  square: { label: "Electronic · Square lead", sample: "lead_1_square" },
  crystal: { label: "Electronic · Crystal synth", sample: "fx_3_crystal" },
  pad: { label: "Electronic · Warm pad", sample: "pad_2_warm" },
  bass: { label: "Electronic · Synth bass", sample: "synth_bass_1" },
} as const;
export type InstrumentId = keyof typeof instruments;
export const instrumentTips: Partial<Record<InstrumentId, string>> = {
  saw: "Bright synth lead for electronic melodies. Try Base C4 or C5 and short notes.",
  square:
    "Hollow synth lead for clear hooks. Try Base C4 and release each note cleanly.",
  crystal:
    "Bell-like electronic tone for delicate melodies and arpeggios. Try Base C4 or C5.",
  pad: "Soft synth pad for sustained chords. Try Base C3 or C4 with thumb sustain.",
  bass: "Synth bass for low rhythmic lines. Try Base C2 or C3 with short notes.",
};
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
  readonly onManual = new Set<(midi: number, down: boolean) => void>();
  manual(midi: number, down: boolean) {
    for (const listener of this.onManual) listener(midi, down);
  }
  playbackEnd?: number;
  readonly onSilence = new Set<() => void>();
  instrument: InstrumentId = "grand";
  originalInstruments = true;
  ensembleStatus = "";
  private ensembleVoices = new Map<number, ReturnType<typeof Soundfont>>();
  setOriginalInstruments(enabled: boolean) {
    this.pause();
    this.originalInstruments = enabled;
    this.ensembleVoices.clear();
    this.ensembleStatus = enabled ? "Original MIDI voices load on Play" : "";
  }
  private async prepareEnsemble(gen: number) {
    const programs = [
      ...new Set(
        this.piece?.notes.flatMap((n) =>
          n.program === undefined ? [] : [n.program],
        ),
      ),
    ];
    const requested = programs
      .filter((p) => Number.isInteger(p) && p >= 0 && p < 128)
      .slice(0, 16);
    if (!requested.length) {
      this.ensembleStatus = "";
      return;
    }
    this.ensembleStatus = "Loading original MIDI instruments…";
    const results = await Promise.allSettled(
      requested.map(async (program) => {
        const key = program === 0 ? "grand" : "midi-" + program;
        let voice = this.instrumentCache.get(key);
        if (!voice) {
          voice =
            program === 0
              ? SplendidGrandPiano(this.context!, {
                  destination: this.gain!,
                  decayTime: 0.12,
                })
              : Soundfont(this.context!, {
                  destination: this.gain!,
                  kit: "MusyngKite",
                  instrument: gmInstruments[program],
                });
          this.instrumentCache.set(key, voice);
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            voice.ready,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(Error("Instrument timeout")),
                20000,
              );
            }),
          ]);
          return [program, voice] as const;
        } catch (error) {
          if (this.instrumentCache.get(key) === voice)
            this.instrumentCache.delete(key);
          throw error;
        } finally {
          clearTimeout(timer);
        }
      }),
    );
    if (gen !== this.generation || !this.originalInstruments) return;
    this.ensembleVoices.clear();
    for (const result of results)
      if (result.status === "fulfilled")
        this.ensembleVoices.set(...result.value);
    const missing = programs.length - this.ensembleVoices.size;
    this.ensembleStatus =
      this.ensembleVoices.size +
      " original MIDI voices" +
      (missing
        ? " · " + missing + " use the selected sound as fallback"
        : " · sampled");
  }
  private soundGeneration = 0;
  private instrumentCache = new Map<
    string,
    ReturnType<typeof SplendidGrandPiano>
  >();
  get instrumentLabel() {
    return instruments[this.instrument].label;
  }
  async setInstrument(id: InstrumentId) {
    if (!Object.hasOwn(instruments, id) || id === this.instrument) return;
    this.setOriginalInstruments(false);
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
  practiceHand: PracticeHand;
  metronome = false;
  beats: number[] = [];
  private scheduledBeats = new Set<number>();
  setPracticeHand(hand: PracticeHand) {
    this.pause();
    this.practiceHand =
      this.piece && hasBothHands(this.piece.notes) ? hand : undefined;
  }
  setMetronome(enabled: boolean) {
    this.pause();
    this.metronome = enabled && this.beats.length > 0;
  }
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
  tone(
    midi: number,
    duration: number,
    velocity = 0.7,
    delay = 0,
    at?: number,
    program?: number,
  ) {
    if (!this.context || !this.gain) return;
    const ctx = this.context;
    const start = at ?? ctx.currentTime + delay;
    const voice =
      (this.originalInstruments && program !== undefined
        ? this.ensembleVoices.get(program)
        : undefined) ?? (this.grandReady ? this.grand : undefined);
    if (voice) {
      const cancel = voice.start({
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
    let remaining = 3;
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
        if (--remaining === 0) env.disconnect();
      };
      osc.start(start);
      osc.stop(start + duration + 0.15);
    });
  }
  hold(midi: number, velocity = 0.7): () => void {
    if (!this.context || !this.gain) return () => {};
    if (this.grandReady) {
      const cancel = this.grand!.start({
        note: midi,
        velocity: Math.round(velocity * 127),
        stopId: ++this.voiceId,
      });
      this.sampleCancels.add(cancel);
      return () => {
        cancel();
        this.sampleCancels.delete(cancel);
      };
    }
    const ctx = this.context,
      env = ctx.createGain(),
      osc = ctx.createOscillator();
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(velocity * 0.6, ctx.currentTime + 0.006);
    env.gain.exponentialRampToValueAtTime(
      Math.max(0.001, velocity * 0.12),
      ctx.currentTime + 0.5,
    );
    osc.connect(env).connect(this.gain);
    this.voices.add(osc);
    osc.onended = () => {
      this.voices.delete(osc);
      osc.disconnect();
      env.disconnect();
    };
    osc.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      env.gain.cancelAndHoldAtTime(ctx.currentTime);
      env.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
      try {
        osc.stop(ctx.currentTime + 0.12);
      } catch {
        /* Already silenced. */
      }
    };
  }
  silence() {
    for (const listener of this.onSilence) listener();
    for (const cancel of this.sampleCancels) cancel();
    this.sampleCancels.clear();
    // Wall-clock cleanup can run while the audio clock is suspended. Stop
    // each sampler as well as the retained per-note cancellation handles.
    for (const voice of new Set([this.grand, ...this.ensembleVoices.values()]))
      voice?.stop();
    for (const v of this.voices) {
      try {
        v.stop();
      } catch {
        /* already ended */
      }
    }
    this.voices.clear();
    this.scheduled.clear();
    this.scheduledBeats.clear();
  }
  load(piece: Piece) {
    this.pause();
    this.playbackEnd = undefined;
    this.piece = piece;
    this.ensembleVoices.clear();
    this.ensembleStatus =
      this.originalInstruments &&
      piece.notes.some((n) => n.program !== undefined)
        ? "Original MIDI voices load on Play"
        : "";
    if (!hasBothHands(piece.notes)) this.practiceHand = undefined;
    this.beats = scoreBeats(piece);
    if (!this.beats.length) this.metronome = false;
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
      if (this.originalInstruments) await this.prepareEnsemble(gen);
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
    if (this.ensembleStatus.startsWith("Loading original"))
      this.ensembleStatus = this.originalInstruments
        ? "Original MIDI voices load on Play"
        : "";
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
  clickBeat(at: number) {
    if (!this.context || !this.gain) return;
    const osc = this.context.createOscillator();
    const env = this.context.createGain();
    osc.frequency.value = 1000;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.18, at + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, at + 0.035);
    osc.connect(env).connect(this.gain);
    this.voices.add(osc);
    osc.onended = () => {
      this.voices.delete(osc);
      osc.disconnect();
      env.disconnect();
    };
    osc.start(at);
    osc.stop(at + 0.04);
  }
  tick() {
    if (!this.playing || !this.piece) return;
    this.position = this.now();
    const end = this.playbackEnd ?? (this.loop ? this.b : this.piece.duration);
    if (this.position >= end) {
      if (this.loop) this.seek(this.a);
      else {
        this.pause();
        this.position = end;
      }
      return;
    }
    if (this.metronome)
      for (const [i, beat] of this.beats.entries()) {
        if (beat >= end || beat > this.position + 0.12 * this.speed) break;
        if (
          beat < this.offset ||
          beat < this.position - 0.025 * this.speed ||
          this.scheduledBeats.has(i)
        )
          continue;
        this.scheduledBeats.add(i);
        this.clickBeat(
          Math.max(
            this.context!.currentTime,
            this.anchor + (beat - this.offset) / this.speed,
          ),
        );
      }
    this.piece.notes.forEach((n, i) => {
      if (this.practiceHand && n.hand === this.practiceHand) return;
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
            n.program,
          );
      }
    });
  }
}
