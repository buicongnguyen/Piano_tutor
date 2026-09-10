import { describe, it, expect } from "vitest";
import {
  challengeNotes,
  phrasesFor,
  Performance,
  progressKey,
  readProgress,
  saveProgress,
} from "./journey";
import type { Piece, Note } from "./music";
const note = (time: number, midi = 60, duration = 1): Note => ({
  time,
  midi,
  duration,
  velocity: 0.7,
});
const piece = (notes: Note[]): Piece => ({
  id: "random",
  title: "Test",
  composer: "Original",
  duration: 60,
  notes,
});
describe("Light the River", () => {
  it("orders identified melody notes before building phrases", () => {
    const p = piece(
      [note(21), note(0), note(1)].map((n) => ({
        ...n,
        hand: "right" as const,
      })),
    );
    expect(phrasesFor(p).map((p) => p.start)).toEqual([0, 21]);
    expect(
      new Performance({ start: 0, end: 0, targets: [] }, 1).result().score,
    ).toBe(0);
  });
  it("requires one physical press for layered duplicates of a melody note", () => {
    const p = piece(
      [note(0, 60, 0.5), note(0, 60, 1), note(1, 62)].map((n) => ({
        ...n,
        hand: "right" as const,
      })),
    );
    const targets = challengeNotes(p);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toBe(p.notes[1]);
  });
  it("accepts melodies or identified hands, rejects guessed ensemble hands", () => {
    expect(challengeNotes(piece([note(0), note(1)]))).toHaveLength(2);
    expect(challengeNotes(piece([note(0), note(0, 64)]))).toHaveLength(0);
    expect(
      challengeNotes(
        piece([
          { ...note(0), hand: "right" },
          { ...note(0, 48), hand: "left" },
        ]),
      ),
    ).toHaveLength(1);
  });
  it("keeps simultaneous targets and long holds within a phrase", () => {
    const p = piece(
      [
        note(0),
        { ...note(19, 64, 3), hand: "right" },
        { ...note(19, 67, 3), hand: "right" },
        note(22),
      ].map((n) => ({ ...n, hand: "right" as const })),
    );
    const phrases = phrasesFor(p);
    expect(phrases).toHaveLength(2);
    expect(phrases[0].end).toBe(22);
    expect(phrases[0].targets).toHaveLength(3);
  });
  it("uses stable musical identity and detects changed notes", () => {
    const p = piece([note(0)]),
      f = phrasesFor(p)[0];
    expect(progressKey(p, f)).toBe(progressKey({ ...p, id: "different" }, f));
    expect(progressKey(p, f)).not.toBe(progressKey(piece([note(0, 61)]), f));
  });
  it("scores real-time timing and holds consistently at half speed", () => {
    const f = { start: 0, end: 2, targets: [note(0), note(1)] };
    const r = new Performance(f, 0.5);
    expect(r.down(60, 0)).toBe(true);
    expect(r.down(60, 0.01)).toBe(false);
    r.up(60, 1);
    r.down(60, 1);
    r.up(60, 2);
    expect(r.result().score).toBe(100);
    expect(r.result().matched).toBe(2);
    const late = new Performance(f, 0.5);
    expect(late.down(60, 0.2)).toBe(false);
  });
  it("penalizes misses, extra presses and unreleased notes", () => {
    const r = new Performance(
      { start: 0, end: 2, targets: [note(0), note(1, 62)] },
      1,
    );
    r.down(60, 0);
    r.down(70, 0.2);
    expect(r.result()).toMatchObject({
      matched: 1,
      total: 2,
      extras: 1,
      hold: 0,
    });
    expect(r.result().score).toBeLessThan(50);
  });
  it("rejects malformed storage and clamps valid saved scores", () => {
    expect(readProgress({ getItem: () => "{bad" })).toEqual({});
    expect(
      readProgress({
        getItem: () =>
          JSON.stringify({
            "a:0.000:1.000": { learned: true, best: 999 },
            evil: { learned: true, best: 8 },
          }),
      }),
    ).toEqual({ "a:0.000:1.000": { learned: true, best: 100 } });
    expect(
      saveProgress(
        {
          setItem: () => {
            throw Error("full");
          },
        },
        {},
      ),
    ).toBe(false);
  });
});
