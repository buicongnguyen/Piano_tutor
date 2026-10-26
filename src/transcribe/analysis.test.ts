import { describe, expect, it } from "vitest";
import { detectChords, estimateKey, estimateTempo, melodyLine, nameChord, chroma, type RawNote } from "./analysis";

const n = (start: number, midi: number, duration = 0.4, velocity = 0.7): RawNote => ({ start, midi, duration, velocity });
const chord = (start: number, pitches: number[], duration: number) => pitches.map((p) => n(start, p, duration));

describe("audio analysis", () => {
  it("finds the tempo and the beat of a steady part", () => {
    const notes = Array.from({ length: 32 }, (_, i) => n(0.25 + i * 0.5, 60 + (i % 4)));
    const t = estimateTempo(notes);
    expect(t.bpm).toBeGreaterThan(117);
    expect(t.bpm).toBeLessThan(123);
    expect(Math.abs(t.offset - 0.25)).toBeLessThan(0.05);
  });

  it("names triads, sevenths and minor chords", () => {
    expect(nameChord(chroma(chord(0, [62, 65, 69], 1)), 2, false)?.name).toBe("Dm");
    expect(nameChord(chroma(chord(0, [55, 59, 62, 65], 1)), 7, false)?.name).toBe("G7");
    expect(nameChord(chroma(chord(0, [60, 64, 67], 1)), 0, false)?.name).toBe("C");
    expect(nameChord(chroma(chord(0, [58, 62, 65], 1)), 10, true)?.name).toBe("Bb");
  });

  it("detects a progression per beat and the key", () => {
    // ii–V–I–vi in C at 120 BPM, two beats each.
    const prog = [
      [50, 62, 65, 69],
      [43, 59, 62, 65],
      [48, 60, 64, 67],
      [45, 60, 64, 69],
    ];
    const notes = prog.flatMap((p, i) => chord(i * 1, p, 0.95));
    const spans = detectChords(notes, { bpm: 120, offset: 0 }, 4);
    expect(spans.map((s) => s.name)).toEqual(["Dm", "G7", "C", "Am"]);
    expect(estimateKey(notes).name).toMatch(/^(C major|A minor)$/);
  });

  it("keeps the top voice as the melody", () => {
    const notes = [...chord(0, [48, 52, 72], 1), n(0.5, 74, 0.5), ...chord(1, [50, 76], 1)];
    const melody = melodyLine(notes);
    expect([...melody].map((i) => notes[i].midi).sort()).toEqual([72, 74, 76]);
  });
});
