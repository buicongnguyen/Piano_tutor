import { describe, expect, it } from "vitest";
import type { Note, Piece } from "../music";
import { buildChart, laptopBase, leadNotes, onsetGroups, stageWindow } from "./chart";

const note = (time: number, midi: number, extra: Partial<Note> = {}): Note => ({
  time,
  duration: 0.25,
  midi,
  velocity: 0.7,
  ...extra,
});

function piece(notes: Note[], bpm = 120): Piece {
  const duration = Math.max(...notes.map((n) => n.time + n.duration));
  return {
    id: "t",
    title: "Test",
    composer: "Test",
    notes,
    duration,
    beatToSeconds: (b) => (b * 60) / bpm,
  };
}

// Two hands: an eighth-note right-hand melody over whole-note left-hand chords (120 BPM).
function twoHands(bars = 8) {
  const notes: Note[] = [];
  const tune = [60, 62, 64, 65, 67, 65, 64, 62];
  for (let i = 0; i < bars * 8; i++)
    notes.push(note(i * 0.25, tune[i % tune.length] + 12, { hand: "right", duration: 0.22 }));
  for (let b = 0; b < bars; b++) {
    notes.push(note(b * 2, 48, { hand: "left", duration: 1.9 }));
    notes.push(note(b * 2, 55, { hand: "left", duration: 1.9 }));
  }
  return piece(notes);
}

describe("lead extraction", () => {
  it("uses the right hand when both hands are labelled", () => {
    const { lead, rest } = leadNotes(twoHands());
    expect(lead.every((n) => n.hand === "right")).toBe(true);
    expect(rest.every((n) => n.hand === "left")).toBe(true);
  });

  it("picks the melodic track of an ensemble over the bass", () => {
    const notes: Note[] = [];
    for (let i = 0; i < 40; i++) notes.push(note(i * 0.25, 76 + (i % 5), { track: 1, program: 40 }));
    for (let i = 0; i < 40; i++) notes.push(note(i * 0.25, 40 + (i % 3), { track: 2, program: 32 }));
    for (let i = 0; i < 20; i++) notes.push(note(i * 0.5, 64, { track: 3, program: 41 }));
    const { lead } = leadNotes(piece(notes));
    expect(new Set(lead.map((n) => n.track))).toEqual(new Set([1]));
  });

  it("groups chords by onset and keeps the longest duplicate", () => {
    const groups = onsetGroups([note(0, 60), note(0.01, 64), note(0, 64, { duration: 1 }), note(1, 62)]);
    expect(groups.map((g) => g.map((n) => n.midi))).toEqual([[64, 60], [62]]);
    expect(groups[0][0].duration).toBe(1);
  });
});

describe("chart building", () => {
  it("never loses a note: chart + accompaniment (+ dropped doublings) cover the whole piece", () => {
    const p = twoHands();
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const chart = buildChart(p, { difficulty, mode: "lanes" });
      expect(chart.notes.length + chart.accompaniment.length + (chart.doubled ?? 0)).toBe(p.notes.length);
    }
  });

  it("drops accompaniment that doubles the charted melody so misses are audible", () => {
    const notes: Note[] = [];
    for (let i = 0; i < 16; i++) {
      notes.push(note(i * 0.5, 72 + (i % 5), { track: 1, program: 73 }));
      notes.push(note(i * 0.5 + 0.004, 72 + (i % 5), { track: 2, program: 40 })); // violin doubling
      notes.push(note(i * 0.5, 48, { track: 3, program: 32 }));
    }
    const chart = buildChart(piece(notes), { difficulty: "normal", mode: "lanes" });
    const onsets = new Set(chart.notes.map((n) => `${n.midi}@${n.time.toFixed(2)}`));
    expect(chart.accompaniment.some((n) => onsets.has(`${n.midi}@${n.time.toFixed(2)}`))).toBe(false);
    expect(chart.doubled).toBe(chart.notes.length);
  });

  it("ends Easy and Normal holds before the next note in any lane", () => {
    const notes = [note(0, 72, { duration: 3 }), note(1, 60), note(3.5, 74)];
    const normal = buildChart(piece(notes), { difficulty: "normal", mode: "lanes" });
    const hold = normal.notes.find((n) => n.midi === 72)!;
    expect(hold.hold ? hold.end : 0).toBeLessThanOrEqual(1);
  });

  it("thins easy charts and keeps normal charts denser", () => {
    const p = twoHands();
    const easy = buildChart(p, { difficulty: "easy", mode: "lanes" });
    const normal = buildChart(p, { difficulty: "normal", mode: "lanes" });
    expect(easy.notes.length).toBeLessThan(normal.notes.length);
    for (let i = 1; i < easy.notes.length; i++)
      expect(easy.notes[i].time - easy.notes[i - 1].time).toBeGreaterThanOrEqual(0.42 - 1e-9);
    expect(easy.lanes).toBe(4);
    expect(normal.lanes).toBe(6);
    expect(easy.notes.every((n) => n.lane >= 0 && n.lane < 4)).toBe(true);
  });

  it("prefers downbeats when thinning", () => {
    const p = twoHands();
    const easy = buildChart(p, { difficulty: "easy", mode: "lanes" });
    const onBeat = easy.notes.filter((n) => Math.abs(n.time / 0.5 - Math.round(n.time / 0.5)) < 0.01);
    expect(onBeat.length).toBe(easy.notes.length);
  });

  it("widens gaps at slower speed", () => {
    const p = twoHands();
    const full = buildChart(p, { difficulty: "normal", mode: "lanes", speed: 1 });
    const slow = buildChart(p, { difficulty: "normal", mode: "lanes", speed: 0.5 });
    expect(slow.notes.length).toBeGreaterThanOrEqual(full.notes.length);
  });

  it("turns long notes into holds and trims them before the next note in the lane", () => {
    const notes = [note(0, 72, { duration: 2 }), note(1, 72), note(3, 74, { duration: 0.2 })];
    const chart = buildChart(piece(notes), { difficulty: "normal", mode: "lanes" });
    const first = chart.notes[0];
    expect(first.hold).toBe(true);
    expect(first.end).toBeLessThanOrEqual(1 - 0.1);
    expect(chart.notes.at(-1)!.hold).toBe(false);
  });

  it("adds chord notes only on hard", () => {
    const notes: Note[] = [];
    for (let i = 0; i < 16; i++) {
      notes.push(note(i * 0.5, 76, { hand: "right" }));
      notes.push(note(i * 0.5, 69, { hand: "right" }));
      notes.push(note(i * 0.5, 45, { hand: "left" }));
    }
    const normal = buildChart(piece(notes), { difficulty: "normal", mode: "lanes" });
    const hard = buildChart(piece(notes), { difficulty: "hard", mode: "lanes" });
    expect(new Set(normal.notes.map((n) => n.group)).size).toBe(normal.notes.length);
    expect(hard.notes.length).toBe(normal.notes.length * 2);
    const byGroup = new Map<number, number[]>();
    for (const n of hard.notes) byGroup.set(n.group, [...(byGroup.get(n.group) ?? []), n.lane]);
    for (const lanes of byGroup.values()) expect(new Set(lanes).size).toBe(lanes.length);
  });

  it("spells words in words mode: one letter per note, no holds, typeable spacing", () => {
    const p = twoHands();
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const chart = buildChart(p, { difficulty, mode: "words", seed: "t" });
      expect(chart.words?.length).toBeGreaterThan(0);
      const spelled = chart.words!.map((w) => w.text).join("");
      expect(spelled.length).toBe(chart.notes.length);
      chart.notes.forEach((n, i) => {
        expect(n.lane).toBe(spelled.charCodeAt(i) - 97);
        expect(n.hold).toBe(false);
      });
      const min = { easy: 0.55, normal: 0.32, hard: 0.2 }[difficulty];
      for (let i = 1; i < chart.notes.length; i++)
        expect(chart.notes[i].time - chart.notes[i - 1].time).toBeGreaterThanOrEqual(min - 1e-9);
    }
  });

  it("charts two thumb lanes in tap mode, with both-sides doubles only on Hard", () => {
    const notes: Note[] = [];
    for (let i = 0; i < 24; i++) {
      notes.push(note(i * 0.5, [72, 74, 76, 74, 72, 79][i % 6], { hand: "right" }));
      if (i % 4 === 0) notes.push(note(i * 0.5, 64, { hand: "right" }));
      notes.push(note(i * 0.5, 48, { hand: "left" }));
    }
    const normal = buildChart(piece(notes), { difficulty: "normal", mode: "tap" });
    expect(normal.lanes).toBe(2);
    expect(new Set(normal.notes.map((n) => n.lane))).toEqual(new Set([0, 1]));
    expect(new Set(normal.notes.map((n) => n.group)).size).toBe(normal.notes.length);
    const hard = buildChart(piece(notes), { difficulty: "hard", mode: "tap" });
    const byGroup = new Map<number, number[]>();
    for (const n of hard.notes) byGroup.set(n.group, [...(byGroup.get(n.group) ?? []), n.lane]);
    expect([...byGroup.values()].some((l) => l.length === 2 && l.includes(0) && l.includes(1))).toBe(true);
    const easy = buildChart(piece(notes), { difficulty: "easy", mode: "tap" });
    for (let i = 1; i < easy.notes.length; i++) expect(easy.notes[i].time - easy.notes[i - 1].time).toBeGreaterThanOrEqual(0.5 - 1e-9);
  });

  it("uses real keys in piano mode", () => {
    const chart = buildChart(twoHands(), { difficulty: "normal", mode: "piano" });
    expect(chart.lanes).toBe(0);
    expect(chart.notes.every((n) => n.lane === n.midi)).toBe(true);
    expect(chart.range[0]).toBeGreaterThanOrEqual(72);
  });

  it("marks golden encore phrases in longer songs", () => {
    const notes: Note[] = [];
    for (let i = 0; i < 160; i++) notes.push(note(i * 0.5, 60 + (i % 12)));
    const chart = buildChart(piece(notes), { difficulty: "normal", mode: "lanes" });
    expect(chart.golden.length).toBeGreaterThanOrEqual(2);
    for (const g of chart.golden) {
      expect(g.ids.length).toBeGreaterThanOrEqual(6);
      expect(g.ids.every((id) => chart.notes[id].golden)).toBe(true);
    }
  });

  it("cuts long pieces at a breath and trims long intros", () => {
    const lead: Note[] = [];
    for (let i = 0; i < 600; i++) lead.push(note(20 + i * 0.5 + (i % 16 === 15 ? 0.3 : 0), 60));
    const win = stageWindow(lead, 330);
    expect(win.start).toBeCloseTo(17);
    expect(win.excerpt).toBe(true);
    expect(win.end - win.start).toBeGreaterThan(60);
    expect(win.end - win.start).toBeLessThanOrEqual(150.5);
    const short = stageWindow([note(1, 60)], 40);
    expect(short).toEqual({ start: 0, end: 40, excerpt: false });
  });

  it("places the laptop window over most of the melody", () => {
    const chart = buildChart(twoHands(), { difficulty: "normal", mode: "piano" });
    expect(laptopBase(chart)).toBe(72);
  });

  it("builds bar lines from the meter", () => {
    const p = { ...twoHands(), meter: 3 };
    const chart = buildChart(p, { difficulty: "normal", mode: "lanes" });
    expect(chart.bars[1] - chart.bars[0]).toBeCloseTo(1.5);
  });
});
