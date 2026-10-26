// Music analysis for transcribed audio: tempo and beat grid, key, chords per beat
// and the melody line. Pure functions over note events, so they run in tests and
// are shared by the piano game and the guitar trainer.

export type RawNote = { start: number; duration: number; midi: number; velocity: number };
export type ChordSpan = { start: number; end: number; name: string; root: number; quality: string };
export type Tempo = { bpm: number; offset: number }; // first beat at `offset` seconds

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Pitch-class name, spelled with flats in flat keys. */
export const pcName = (pc: number, flats = false) => (flats ? FLATS : SHARPS)[((pc % 12) + 12) % 12];

/**
 * Tempo from note onsets: an onset envelope at 100 Hz, autocorrelated over 55–190
 * BPM with a gentle preference for 75–140 (the octave errors of autocorrelation
 * usually pick half or double time), then the beat phase that lines up most onsets.
 */
export function estimateTempo(notes: RawNote[]): Tempo {
  if (notes.length < 4) return { bpm: 100, offset: notes[0]?.start ?? 0 };
  const rate = 100;
  const end = Math.max(...notes.map((n) => n.start)) + 1;
  const env = new Float32Array(Math.ceil(end * rate) + 1);
  for (const n of notes) {
    const i = Math.round(n.start * rate);
    env[i] += 0.3 + n.velocity;
    if (i + 1 < env.length) env[i + 1] += (0.3 + n.velocity) * 0.5; // blur by a frame
  }
  let best = 100,
    bestScore = -1;
  for (let bpm = 55; bpm <= 190; bpm += 0.5) {
    const lag = (60 / bpm) * rate;
    let score = 0;
    for (const k of [1, 2]) {
      const l = lag * k;
      const l0 = Math.floor(l),
        f = l - l0;
      let s = 0;
      for (let i = 0; i + l0 + 1 < env.length; i++) s += env[i] * (env[i + l0] * (1 - f) + env[i + l0 + 1] * f);
      score += s / k;
    }
    const prefer = Math.exp(-0.5 * (Math.log2(bpm / 105) / 0.45) ** 2);
    score *= 0.6 + 0.4 * prefer;
    if (score > bestScore) [bestScore, best] = [score, bpm];
  }
  const period = 60 / best;
  let offset = 0,
    bestPhase = -1;
  for (let k = 0; k < 40; k++) {
    const phase = (k / 40) * period;
    let s = 0;
    for (const n of notes) {
      const d = (((n.start - phase) % period) + period) % period;
      const dist = Math.min(d, period - d) / period;
      s += (0.3 + n.velocity) * Math.exp(-((dist / 0.06) ** 2));
    }
    if (s > bestPhase) [bestPhase, offset] = [s, phase];
  }
  const first = Math.min(...notes.map((n) => n.start));
  while (offset + period <= first) offset += period; // the first beat near the music's start
  return { bpm: Math.round(best * 10) / 10, offset };
}

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(a: number[], b: number[]) {
  const ma = a.reduce((s, x) => s + x, 0) / 12,
    mb = b.reduce((s, x) => s + x, 0) / 12;
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Duration-weighted pitch-class profile. */
export function chroma(notes: RawNote[], from = -Infinity, to = Infinity) {
  const c = new Array(12).fill(0);
  for (const n of notes) {
    const overlap = Math.min(to, n.start + n.duration) - Math.max(from, n.start);
    if (overlap > 0) c[n.midi % 12] += overlap * (0.3 + n.velocity);
  }
  return c;
}

/** Key by the Krumhansl–Schmuckler profiles: e.g. { tonic: 2, mode: "minor", name: "D minor" }. */
export function estimateKey(notes: RawNote[]) {
  const c = chroma(notes);
  let best = { tonic: 0, mode: "major" as "major" | "minor", score: -2 };
  for (let t = 0; t < 12; t++)
    for (const [mode, prof] of [
      ["major", MAJOR],
      ["minor", MINOR],
    ] as const) {
      const rotated = prof.map((_, i) => prof[(i - t + 12) % 12]);
      const s = correlate(c, rotated);
      if (s > best.score) best = { tonic: t, mode, score: s };
    }
  // Flat keys: F, Bb, Eb, Ab, Db majors and their relative minors.
  const majorTonic = best.mode === "major" ? best.tonic : (best.tonic + 3) % 12;
  const flats = [5, 10, 3, 8, 1].includes(majorTonic);
  return { tonic: best.tonic, mode: best.mode, flats, name: `${pcName(best.tonic, flats)} ${best.mode}` };
}

const QUALITIES: [string, number[]][] = [
  ["", [0, 4, 7]],
  ["m", [0, 3, 7]],
  ["7", [0, 4, 7, 10]],
  ["maj7", [0, 4, 7, 11]],
  ["m7", [0, 3, 7, 10]],
  ["dim", [0, 3, 6]],
  ["sus4", [0, 5, 7]],
];

/** The best chord for one chroma vector (with the bass pitch class as a hint). */
export function nameChord(c: number[], bass: number | undefined, flats: boolean) {
  const total = c.reduce((s, x) => s + x, 0);
  if (total <= 1e-6) return undefined;
  const norm = Math.sqrt(c.reduce((s, x) => s + x * x, 0));
  let best: { root: number; quality: string; score: number } | undefined;
  for (let root = 0; root < 12; root++)
    for (const [quality, steps] of QUALITIES) {
      const t = new Array(12).fill(0);
      for (const s of steps) t[(root + s) % 12] = 1;
      let dot = 0;
      for (let i = 0; i < 12; i++) dot += c[i] * t[i];
      let score = dot / (norm * Math.sqrt(steps.length));
      if (bass === root) score += 0.12; // the bass usually plays the root
      if (steps.length === 4) score -= 0.04; // prefer plain triads unless the 7th is really there
      if (quality === "dim" || quality === "sus4") score -= 0.03;
      if (!best || score > best.score) best = { root, quality, score };
    }
  if (!best || best.score < 0.55) return undefined;
  return { root: best.root, quality: best.quality, name: pcName(best.root, flats) + best.quality };
}

/**
 * Chords per beat, merged where they repeat, with very short changes absorbed into
 * their neighbours (a passing note is not a new chord).
 */
export function detectChords(notes: RawNote[], tempo: Tempo, end: number, flats = false, beatsPer = 1): ChordSpan[] {
  const period = (60 / tempo.bpm) * beatsPer;
  const spans: ChordSpan[] = [];
  let start = tempo.offset;
  while (start > period) start -= period;
  for (let t = start; t < end; t += period) {
    const window = notes.filter((n) => n.start < t + period && n.start + n.duration > t);
    const bass = window.length ? window.reduce((a, b) => (b.midi < a.midi ? b : a)).midi % 12 : undefined;
    const chord = nameChord(chroma(window, t, t + period), bass, flats);
    if (!chord) continue;
    const last = spans.at(-1);
    if (last && last.name === chord.name && Math.abs(last.end - t) < 1e-6) last.end = t + period;
    else spans.push({ start: t, end: t + period, ...chord });
  }
  // Absorb blips shorter than one beat that sit between two equal chords.
  for (let i = spans.length - 2; i >= 1; i--) {
    const [a, b, c] = [spans[i - 1], spans[i], spans[i + 1]];
    if (b.end - b.start < period * 1.01 && a.name === c.name && Math.abs(a.end - b.start) < 1e-6 && Math.abs(b.end - c.start) < 1e-6) {
      a.end = c.end;
      spans.splice(i, 2);
    }
  }
  return spans;
}

/**
 * The melody line: one note (or a rest) per onset, chosen by a Viterbi path that
 * prefers high, loud notes, small steps and the melody's own register. A greedy
 * "highest note" skyline jumps to every stray harmonic or chord top in a full mix;
 * the path keeps a singable line. Returns the indices of melody notes.
 */
export function melodyLine(notes: RawNote[], minDuration = 0.08, minVelocity = 0.15) {
  const usable = notes.map((n, i) => ({ n, i })).filter(({ n }) => n.duration >= minDuration && n.velocity >= minVelocity);
  if (!usable.length) return new Set<number>();
  usable.sort((a, b) => a.n.start - b.n.start || b.n.midi - a.n.midi);
  // Onset groups (notes within 40 ms).
  const groups: { n: RawNote; i: number }[][] = [];
  for (const u of usable) {
    const g = groups.at(-1);
    if (g && u.n.start - g[0].n.start < 0.04) g.push(u);
    else groups.push([u]);
  }
  // The register: where the tops of the groups usually sit.
  const tops = groups.map((g) => g[0].n.midi).sort((a, b) => a - b);
  const centre = tops[Math.floor(tops.length * 0.6)];
  type St = { cost: number; pitch: number; back: number; pick: number };
  const layers: St[][] = [];
  groups.forEach((g, gi) => {
    const prev = layers[gi - 1];
    const options = [...g.map((u, k) => ({ pitch: u.n.midi, vel: u.n.velocity, k })), { pitch: -1, vel: 0, k: -1 }];
    layers.push(
      options.map((o) => {
        const own =
          o.k < 0
            ? 1.2 // a rest: allowed, but the line should mostly sound
            : -0.04 * (o.pitch - centre) - o.vel * 0.8 + (Math.abs(o.pitch - centre) > 12 ? (Math.abs(o.pitch - centre) - 12) * 0.25 : 0);
        if (!prev) return { cost: own, pitch: o.pitch, back: -1, pick: o.k };
        let best = Infinity,
          back = 0;
        prev.forEach((p, j) => {
          const leap = p.pitch < 0 || o.pitch < 0 ? 0 : Math.abs(o.pitch - p.pitch);
          const c = p.cost + own + (leap > 4 ? (leap - 4) * 0.12 : 0) + (leap > 12 ? 1 : 0);
          if (c < best) [best, back] = [c, j];
        });
        return { cost: best, pitch: o.pitch, back, pick: o.k };
      }),
    );
  });
  const melody = new Set<number>();
  let j = layers.at(-1)!.reduce((b, s, k, a) => (s.cost < a[b].cost ? k : b), 0);
  for (let gi = layers.length - 1; gi >= 0; gi--) {
    const s = layers[gi][j];
    if (s.pick >= 0) melody.add(groups[gi][s.pick].i);
    j = Math.max(0, s.back);
  }
  return melody;
}
