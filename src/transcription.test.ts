// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { finish, parseXml } from "./music";
import { transcribe } from "./transcription";

describe("display-only MIDI transcription", () => {
  it("preserves chords, independent overlapping durations, rests and bar-line ties", () => {
    const piece = finish({
      id: "test",
      title: "A < B & C",
      composer: "Test",
      notes: [
        { midi: 48, time: 0, duration: 5, velocity: 0.5 },
        { midi: 60, time: 0.5, duration: 1, velocity: 0.7 },
        { midi: 64, time: 0.5, duration: 1, velocity: 0.7 },
        { midi: 67, time: 1, duration: 2, velocity: 0.7 },
        { midi: 72, time: 1.5, duration: 0.5, velocity: 0.7 },
      ],
    });
    const before = JSON.stringify(piece);
    const xml = transcribe(piece).xml(0);
    const generated = parseXml(xml);
    expect(generated.title).toBe("A < B & C · generated transcription");
    const timing = (notes: typeof piece.notes) =>
      notes
        .map((n) => [n.midi, n.time, n.duration])
        .sort((a, b) => a[0] - b[0]);
    expect(timing(generated.notes)).toEqual(timing(piece.notes));
    expect(xml).toContain("<chord/>");
    expect(xml).toContain('<tie type="start"/>');
    expect(JSON.stringify(piece)).toBe(before);
    expect(piece.notes.every((n) => n.hand === undefined)).toBe(true);
  });
  it("uses the MIDI tempo map to recover beats instead of treating seconds as beats", () => {
    const piece = finish({
      id: "tempo",
      title: "Tempo",
      composer: "Test",
      beatToSeconds: (beat) => (beat <= 4 ? beat / 2 : 2 + (beat - 4)),
      notes: [{ midi: 60, time: 3, duration: 1, velocity: 1 }],
    });
    const note = parseXml(transcribe(piece).xml(0)).notes[0];
    // Original start is beat 5, lasting one beat; generated XML is at 120 BPM.
    expect(note.time).toBe(2.5);
    expect(note.duration).toBe(0.5);
  });
  it("includes the entire performance in bounded pages and preserves cross-page notes", () => {
    const piece = finish({
      id: "long",
      title: "Long",
      composer: "Test",
      notes: [
        { midi: 60, time: 31.5, duration: 2, velocity: 1 },
        { midi: 72, time: 66, duration: 0.5, velocity: 1 },
      ],
    });
    const score = transcribe(piece);
    expect(score.pages).toBe(3);
    const page2 = score.xml(1);
    expect(page2).toContain('measure number="17"');
    expect(parseXml(page2).notes[0].duration).toBe(1.5);
    expect(parseXml(score.xml(2)).notes[0].midi).toBe(72);
  });
});
