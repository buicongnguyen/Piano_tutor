import { describe, it, expect } from "vitest";
import { keyBar, upcomingKeys } from "./key-cues";
const note = (midi: number, time: number, duration = 1) => ({
  midi,
  time,
  duration,
  velocity: 0.7,
});
describe("computer-key prediction", () => {
  it("aligns arrival and release with the computer button", () => {
    expect(keyBar(note(60, 2, 1.5), 2).bottom).toBe(72);
    const released = keyBar(note(60, 2, 1.5), 3.5);
    expect(released.bottom - released.length).toBe(72);
    expect(keyBar(note(60, 2, 3), 0).length).toBe(54);
  });
  it("groups chords, skips finished notes and marks unmapped pitches", () => {
    const cues = upcomingKeys(
      [note(60, 0), note(60, 1), note(64, 1), note(36, 2), note(62, 10)],
      1,
      new Map([
        [60, "A"],
        [64, "D"],
      ]),
    );
    expect(cues.map((c) => c.labels)).toEqual([["A", "D"], ["C2↕"]]);
    expect(cues.map((c) => c.outside)).toEqual([false, true]);
  });
});
