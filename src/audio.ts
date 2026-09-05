import type { Note, Piece } from "./music";
import { SplendidGrandPiano } from "smplr";
export function activeAt(notes: Note[], time: number) {
  return notes.filter((n) => n.time <= time && n.time + n.duration > time);
}
export class Player {
  context?: AudioContext;
  gain?: GainNode;
  piece?: Piece;
  playing = false;
  position = 0;
  speed = 1;
  volume = 0.65;
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
  async loadGrand() {
    await this.init();
    this.grand ??= SplendidGrandPiano(this.context!, {
      destination: this.gain!,
    });
    await Promise.race([
      this.grand.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(Error("Sample timeout")), 45000),
      ),
    ]);
    this.grandReady = true;
  }
  async init() {
    this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    this.gain.gain.value = this.volume * 0.2;
    await this.context.resume();
  }
  tone(midi: number, duration: number, velocity = 0.7, delay = 0) {
    if (!this.context || !this.gain) return;
    const ctx = this.context;
    const start = ctx.currentTime + delay;
    if (this.grandReady) {
      this.grand!.start({
        note: midi,
        time: start,
        duration,
        velocity: Math.round(velocity * 127),
      });
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
    await this.init();
    if (gen !== this.generation || !this.piece) return;
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
  }
  pause() {
    this.generation++;
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
    const playing = this.playing;
    this.pause();
    this.position = Math.max(0, Math.min(this.piece?.duration || 0, time));
    if (playing) void this.play();
  }
  setSpeed(speed: number) {
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
        n.time + n.duration <= this.offset ||
        n.time >= end
      )
        return;
      if (n.time <= this.position + 0.12 * this.speed) {
        this.scheduled.add(i);
        const duration =
          (Math.min(n.time + n.duration, end) -
            Math.max(n.time, this.position)) /
          this.speed;
        if (duration > 0)
          this.tone(
            n.midi,
            duration,
            n.velocity,
            Math.max(0, (n.time - this.position) / this.speed),
          );
      }
    });
  }
}
