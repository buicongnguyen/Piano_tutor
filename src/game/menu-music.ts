// "Coda's Theme": an original eight-bar menu loop on the sampled grand.
// I–vi–IV–V broken chords under a bright, singable melody at 92 BPM.
import type { SoundBank } from "./sound";

const BPM = 92;
const BEAT = 60 / BPM;
// [start beat, midi, beats]
const MELODY: [number, number, number][] = [
  [0, 76, 1], [1, 79, 1], [2, 84, 1.5], [3.5, 83, 0.5],
  [4, 81, 1], [5, 84, 1], [6, 76, 2],
  [8, 77, 1], [9, 81, 1], [10, 84, 1.5], [11.5, 81, 0.5],
  [12, 79, 1.5], [13.5, 77, 0.5], [14, 74, 2],
  [16, 76, 1], [17, 79, 1], [18, 84, 1], [19, 88, 1],
  [20, 86, 1.5], [21.5, 84, 0.5], [22, 83, 2],
  [24, 81, 1], [25, 84, 1], [26, 83, 1], [27, 79, 1],
  [28, 84, 3],
];
const CHORDS = [48, 45, 41, 43, 48, 40, 41, 43]; // C Am F G C Em F G (roots)
const QUALITY = [4, 3, 4, 4, 4, 3, 4, 4]; // major / minor third
const LOOP = 32;

export class MenuMusic {
  private timer = 0;
  private start = 0;
  private scheduledUntil = 0;
  playing = false;

  constructor(readonly bank: SoundBank) {}

  play() {
    if (this.playing || !this.bank.ctx) return;
    this.playing = true;
    this.start = this.bank.now + 0.3;
    this.scheduledUntil = 0;
    this.timer = window.setInterval(() => this.tick(), 90);
    this.tick();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
  }

  private tick() {
    if (!this.playing || !this.bank.ctx) return;
    const now = this.bank.now;
    const until = (now - this.start) / BEAT + 1.2; // beats ahead
    for (let beat = Math.ceil(this.scheduledUntil * 2) / 2; beat < until; beat += 0.5) {
      const loopBeat = ((beat % LOOP) + LOOP) % LOOP;
      const at = this.start + beat * BEAT;
      if (at < now - 0.02) continue;
      const bar = Math.floor(loopBeat / 4);
      const root = CHORDS[bar];
      const third = QUALITY[bar];
      // Left hand: root, fifth, octave, tenth — an eighth-note wash.
      const pattern = [root, root + 7, root + 12, root + 12 + third, root + 19, root + 12 + third, root + 12, root + 7];
      const step = Math.round((loopBeat % 4) * 2);
      this.bank.note(pattern[step], at, BEAT * 1.6, step === 0 ? 0.42 : 0.3, undefined, 0.8);
      for (const [start, midi, len] of MELODY)
        if (Math.abs(start - loopBeat) < 0.01) this.bank.note(midi, at, len * BEAT * 1.05, 0.55, undefined, 0.8);
    }
    this.scheduledUntil = Math.max(this.scheduledUntil, until);
  }
}
