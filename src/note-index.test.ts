import { expect, it } from "vitest";
import { NoteIndex } from "./note-index";
import type { Note } from "./music";
const note = (time: number, duration: number, midi = 60): Note => ({ time, duration, midi, velocity: 0.6 });

it("matches a full scan across chords, overlaps, exact edges and backward seeks", () => {
  const notes = [note(10, 1, 72), note(0, 20, 48), note(1, 0.5), note(1, 3, 64), note(4, 0.2)];
  const index = new NoteIndex(notes);
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  for (const t of [-1, 0, 1, 1.5, 4, 4.2, 11, 20, 25, 2, 0]) {
    expect(index.between(t, t + 2)).toEqual(sorted.filter(n => n.time <= t + 2 && n.time + n.duration >= t));
    expect(index.activeAt(t)).toEqual(sorted.filter(n => n.time <= t && n.time + n.duration > t));
  }
  expect(index.range).toEqual([46, 74]);
  expect(notes[0].time).toBe(10); // indexing does not reorder caller data
});

it("handles empty scores and the final visible notes of a long score", () => {
  expect(new NoteIndex([]).activeAt(0)).toEqual([]);
  const notes = Array.from({ length: 30000 }, (_, i) => note(i, 0.2));
  const index = new NoteIndex(notes);
  expect(index.between(29998, 30000)).toEqual(notes.slice(-2));
  expect(index.between(5, 6)).toEqual(notes.slice(5, 7));
});
