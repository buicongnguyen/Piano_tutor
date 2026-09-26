// Turns any Piece into a playable stage chart. The melody (lead) becomes the
// notes the player hits; everything else — including lead notes a lighter
// difficulty leaves out — is played automatically, so every difficulty still
// sounds like the whole piece.
import { soundDuration, type Note, type Piece } from "../music";
import { hasBothHands } from "../practice";
import { contourLanes } from "./lanes";

export type Difficulty = "easy" | "normal" | "hard";
export type KeyMode = "lanes" | "piano";

export type ChartNote = {
  id: number;
  time: number; // onset, song seconds
  end: number; // hold tail end (equals time for taps)
  midi: number; // sounding pitch
  lane: number; // lanes mode: 0..lanes-1; piano mode: the MIDI key
  hold: boolean;
  golden: boolean;
  group: number; // onset group (chord) index
  velocity: number;
  sound: number; // sounding duration for audio
  program?: number;
};

export type Chart = {
  notes: ChartNote[];
  accompaniment: Note[];
  mode: KeyMode;
  lanes: number; // 0 in piano mode
  difficulty: Difficulty;
  start: number; // song time the stage starts at (intro trimmed)
  end: number; // song time the stage ends at
  excerpt: boolean;
  doubled?: number; // accompaniment notes dropped because they doubled the melody
  beats: number[];
  bars: number[];
  range: [number, number];
  golden: { start: number; end: number; ids: number[] }[];
};

export const LANES: Record<Difficulty, number> = { easy: 4, normal: 6, hard: 6 };
// Minimum real-time gap between charted onsets.
const MIN_GAP: Record<Difficulty, number> = { easy: 0.42, normal: 0.19, hard: 0.1 };
const HOLD_MIN: Record<Difficulty, number> = { easy: 0.85, normal: 0.6, hard: 0.5 };
const ONSET = 0.03; // notes closer than this share an onset

export type ChartOptions = {
  difficulty: Difficulty;
  mode: KeyMode;
  speed?: number; // playback rate; gaps are judged in real time
  maxLength?: number; // longest stage before an excerpt is cut (seconds)
};

/** Split a piece into its melody line and everything else. */
export function leadNotes(piece: Piece): { lead: Note[]; rest: Note[] } {
  const notes = [...piece.notes].sort((a, b) => a.time - b.time || b.midi - a.midi);
  let lead: Note[];
  if (hasBothHands(notes)) lead = notes.filter((n) => n.hand === "right");
  else {
    const tracks = new Map<number, Note[]>();
    for (const n of notes) {
      const list = tracks.get(n.track ?? -1) ?? [];
      list.push(n);
      tracks.set(n.track ?? -1, list);
    }
    if (tracks.size > 1) {
      let best: Note[] = [],
        bestScore = -1;
      for (const list of tracks.values()) {
        const mean = list.reduce((s, n) => s + n.midi, 0) / list.length;
        const bass = list[0].program !== undefined && list[0].program >= 32 && list[0].program <= 39;
        const weight = bass ? 0.05 : Math.max(0.1, Math.min(1.25, (mean - 46) / 22));
        const handBonus = list.every((n) => n.hand === "right") ? 1.5 : 1;
        const score = list.length ** 0.8 * weight * handBonus;
        if (score > bestScore) {
          bestScore = score;
          best = list;
        }
      }
      lead = best;
    } else lead = notes;
  }
  const chosen = new Set(lead);
  return { lead, rest: notes.filter((n) => !chosen.has(n)) };
}

/** Group notes into onsets (chords), highest pitch first within a group. */
export function onsetGroups(notes: Note[]): Note[][] {
  const sorted = [...notes].sort((a, b) => a.time - b.time || b.midi - a.midi);
  const groups: Note[][] = [];
  for (const n of sorted) {
    const g = groups.at(-1);
    if (g && n.time - g[0].time <= ONSET) {
      if (!g.some((m) => m.midi === n.midi)) g.push(n);
      else {
        // Layered duplicates: keep the longest copy of that pitch.
        const i = g.findIndex((m) => m.midi === n.midi);
        if (n.duration > g[i].duration) g[i] = n;
      }
    } else groups.push([n]);
  }
  for (const g of groups) g.sort((a, b) => b.midi - a.midi);
  return groups;
}

export function beatGrid(piece: Piece, from: number, to: number) {
  const beats: number[] = [];
  if (piece.beatToSeconds) {
    for (let i = 0; i < 20000; i++) {
      const t = piece.beatToSeconds(i);
      if (!Number.isFinite(t) || (beats.length && t <= beats.at(-1)!)) break;
      if (t > to) break;
      beats.push(t);
    }
  }
  if (beats.length < 2) {
    beats.length = 0;
    for (let t = 0; t <= to; t += 0.5) beats.push(t);
  }
  const meter = piece.meter && piece.meter >= 1 ? Math.round(piece.meter) : 4;
  const bars = beats.filter((_, i) => i % meter === 0);
  return {
    beats: beats.filter((t) => t >= from - 0.001),
    bars: bars.filter((t) => t >= from - 0.001),
  };
}

/** Choose the stage window: trim long intros, cut long pieces at a breath near two minutes. */
export function stageWindow(lead: Note[], duration: number, maxLength = 150) {
  const first = lead[0]?.time ?? 0;
  const start = Math.max(0, first - 3);
  if (duration - start <= maxLength) return { start, end: duration, excerpt: false };
  const target = start + Math.min(115, maxLength * 0.78);
  let best = target,
    bestCost = Infinity;
  for (let i = 0; i < lead.length - 1; i++) {
    const end = lead[i].time + lead[i].duration;
    const gap = lead[i + 1].time - end;
    if (end < start + 60 || end > start + maxLength) continue;
    const cost = Math.abs(end - target) - Math.min(gap, 1.5) * 20;
    if (gap >= 0.12 && cost < bestCost) {
      bestCost = cost;
      best = end;
    }
  }
  return { start, end: Math.min(duration, best + 0.4), excerpt: true };
}

function strength(t: number, beats: number[], bars: number[]) {
  const near = (list: number[]) => list.some((b) => Math.abs(b - t) < 0.04);
  if (near(bars)) return 3;
  if (near(beats)) return 2;
  for (let i = 0; i < beats.length - 1; i++)
    if (Math.abs((beats[i] + beats[i + 1]) / 2 - t) < 0.035) return 1;
  return 0;
}

export function buildChart(piece: Piece, options: ChartOptions): Chart {
  const { difficulty, mode } = options;
  const speed = options.speed && options.speed > 0 ? options.speed : 1;
  const { lead, rest } = leadNotes(piece);
  const groupsAll = onsetGroups(lead);
  const window = stageWindow(
    groupsAll.map((g) => g[0]),
    piece.duration,
    options.maxLength,
  );
  const { beats, bars } = beatGrid(piece, window.start, window.end);
  const inWindow = groupsAll.filter((g) => g[0].time >= window.start && g[0].time < window.end - 0.05);

  // Greedy thinning in real time, preferring stronger beats when two onsets crowd.
  const gap = MIN_GAP[difficulty] * speed;
  const kept: { g: Note[]; s: number }[] = [];
  for (const g of inWindow) {
    const s = strength(g[0].time, beats, bars);
    const last = kept.at(-1);
    if (!last || g[0].time - last.g[0].time >= gap) kept.push({ g, s });
    else if (s > last.s) {
      const before = kept.at(-2);
      if (!before || g[0].time - before.g[0].time >= gap) kept[kept.length - 1] = { g, s };
    }
  }
  const chordSize = difficulty === "hard" ? (mode === "piano" ? 3 : 2) : 1;
  const chosen: Note[][] = kept.map(({ g }) =>
    g.filter((n, i) => i === 0 || (i < chordSize && g[i - 1].midi - n.midi >= 3)).slice(0, chordSize),
  );
  const used = new Set(chosen.flat());

  const laneCount = mode === "lanes" ? LANES[difficulty] : 0;
  const laneOf =
    mode === "lanes"
      ? contourLanes(
          chosen.map((g) => ({ pitches: g.map((n) => n.midi) })),
          laneCount,
        )
      : chosen.map((g) => g.map((n) => n.midi));

  const notes: ChartNote[] = [];
  chosen.forEach((g, gi) =>
    g.forEach((n, k) =>
      notes.push({
        id: 0,
        time: n.time,
        end: n.time,
        midi: n.midi,
        lane: laneOf[gi][k],
        hold: false,
        golden: false,
        group: gi,
        velocity: n.velocity,
        sound: soundDuration(n),
        program: n.program,
      }),
    ),
  );
  // Collapse any lane collisions inside a group (possible on narrow roads).
  const unique: ChartNote[] = [];
  for (const n of notes)
    if (!unique.some((m) => m.group === n.group && m.lane === n.lane)) unique.push(n);
    else used.delete(chosen[n.group].find((m) => m.midi === n.midi)!);
  unique.sort((a, b) => a.time - b.time || a.lane - b.lane);

  // Holds: long key-downs (at least 1.5 beats) become sustains. On Hard they are
  // trimmed before the next note in the same lane (hold one key, play others);
  // on Easy and Normal before the next note anywhere, so one hand is never split.
  const holdMin = HOLD_MIN[difficulty] * speed;
  const beatAt = (t: number) => {
    let i = 0;
    while (i < beats.length - 2 && beats[i + 1] <= t) i++;
    return beats.length > 1 ? beats[i + 1] - beats[i] : 0.5;
  };
  const nextInLane = new Map<number, number>();
  let nextOnset = Infinity;
  for (let i = unique.length - 1; i >= 0; i--) {
    const n = unique[i];
    const source = chosen[n.group].find((m) => m.midi === n.midi)!;
    // Notes are sorted by time, so a chord's notes are contiguous.
    if (i < unique.length - 1 && unique[i + 1].group !== n.group) nextOnset = unique[i + 1].time;
    const next = chordSize > 1 ? (nextInLane.get(n.lane) ?? Infinity) : nextOnset;
    const tail = Math.min(n.time + source.duration, next - 0.12 * speed, window.end);
    if (tail - n.time >= Math.max(holdMin, 1.5 * beatAt(n.time))) {
      n.hold = true;
      n.end = tail;
    }
    nextInLane.set(n.lane, n.time);
  }
  unique.forEach((n, i) => (n.id = i));

  // Golden (Encore) phrases: a run of 6–10 onsets roughly every 20 seconds.
  const golden: Chart["golden"] = [];
  const groupIds = [...new Set(unique.map((n) => n.group))];
  let nextAt = window.start + 8;
  for (let i = 0; i < groupIds.length; i++) {
    const first = unique.find((n) => n.group === groupIds[i])!;
    if (first.time < nextAt || first.time > window.end - 8) continue;
    const run = groupIds.slice(i, i + 6 + (i % 5));
    if (run.length < 6) break;
    const ids = unique.filter((n) => run.includes(n.group)).map((n) => n.id);
    for (const id of ids) unique[id].golden = true;
    golden.push({ start: first.time, end: Math.max(...ids.map((id) => unique[id].end)), ids });
    nextAt = first.time + 20;
    i += run.length;
  }

  // Drop accompaniment that doubles a charted note (same pitch, same onset):
  // otherwise another instrument plays the melody and misses go unheard.
  const charted = new Set(unique.map((n) => `${n.midi}:${Math.round(n.time * 50)}`));
  const doubles = (n: Note) =>
    [-1, 0, 1].some((d) => charted.has(`${n.midi}:${Math.round(n.time * 50) + d}`));
  const pool = [...rest, ...lead.filter((n) => !used.has(n))].filter(
    (n) => n.time >= window.start - 0.001 && n.time < window.end,
  );
  const accompaniment = pool.filter((n) => !doubles(n)).sort((a, b) => a.time - b.time);
  const pitches = unique.map((n) => n.midi);
  return {
    notes: unique,
    accompaniment,
    mode,
    lanes: laneCount,
    difficulty,
    start: window.start,
    end: window.end,
    excerpt: window.excerpt,
    doubled: pool.length - accompaniment.length,
    beats,
    bars,
    range: pitches.length ? [Math.min(...pitches), Math.max(...pitches)] : [60, 72],
    golden,
  };
}

/** For laptop keys in piano mode: the C that best centres a 17-key chromatic window. */
export function laptopBase(chart: Chart, span = 17): number {
  let best = 60,
    bestCount = -1;
  // The laptop layouts accept base octaves 2–6 (C2..C6) only.
  for (let c = 36; c <= 84; c += 12) {
    const count = chart.notes.filter((n) => n.midi >= c && n.midi < c + span).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

/** Real-piano display window: the octave-aligned span (≤ `octaves`) holding the most notes. */
export function pianoWindow(chart: Chart, octaves = 3): [number, number] {
  const [lo, hi] = chart.range;
  const span = octaves * 12;
  const first = Math.max(21, Math.floor(lo / 12) * 12);
  const last = Math.min(108, Math.ceil((hi + 1) / 12) * 12);
  if (last - first <= span) return [first, Math.min(108, Math.max(last, first + 12))];
  let best = first,
    bestCount = -1;
  for (let c = first; c + span <= last + 12; c += 12) {
    const count = chart.notes.filter((n) => n.midi >= c && n.midi <= c + span).length;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return [best, Math.min(108, best + span)];
}
