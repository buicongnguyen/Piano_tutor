import { describe, expect, it } from "vitest";
import { chordLanes, contourLanes } from "./lanes";

const single = (pitches: number[]) => pitches.map((p) => ({ pitches: [p] }));

describe("contour lanes", () => {
  it("keeps every lane on the road", () => {
    const pitches = Array.from({ length: 200 }, (_, i) => 40 + ((i * 37) % 50));
    for (const lanes of [4, 6])
      for (const [l] of contourLanes(single(pitches), lanes)) {
        expect(l).toBeGreaterThanOrEqual(0);
        expect(l).toBeLessThan(lanes);
      }
  });

  it("repeats a lane for a repeated pitch and follows melodic direction", () => {
    const tune = [60, 62, 64, 64, 65, 67, 67, 65, 64, 62, 60, 72, 71, 69, 67];
    const lanes = contourLanes(single(tune), 6).map((g) => g[0]);
    for (let i = 1; i < tune.length; i++) {
      if (tune[i] === tune[i - 1]) expect(lanes[i]).toBe(lanes[i - 1]);
      else if (tune[i] > tune[i - 1] && lanes[i - 1] < 5) expect(lanes[i]).toBeGreaterThan(lanes[i - 1]);
      else if (tune[i] < tune[i - 1] && lanes[i - 1] > 0) expect(lanes[i]).toBeLessThan(lanes[i - 1]);
    }
  });

  it("maps scale steps to neighbouring lanes rather than leaps", () => {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
    const lanes = contourLanes(single(scale), 6).map((g) => g[0]);
    for (let i = 1; i < lanes.length; i++) expect(Math.abs(lanes[i] - lanes[i - 1])).toBeLessThanOrEqual(1);
  });

  it("uses most of the road for a wide melody", () => {
    const tune = [55, 60, 64, 67, 72, 76, 79, 76, 72, 67, 64, 60, 55, 60, 67, 72, 79];
    const used = new Set(contourLanes(single(tune), 6).map((g) => g[0]));
    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it("centres a narrow passage", () => {
    const lanes = contourLanes(single([64, 65, 64, 65]), 6).map((g) => g[0]);
    expect(new Set(lanes).size).toBe(2);
    expect(Math.min(...lanes)).toBeGreaterThan(0);
    expect(Math.max(...lanes)).toBeLessThan(5);
  });
});

describe("chord lanes", () => {
  it("gives chord tones distinct lanes below the top note", () => {
    expect(chordLanes([72, 67], 4, 6)).toEqual([4, 3]);
    expect(chordLanes([72, 60], 4, 6)).toEqual([4, 2]);
  });
  it("shifts a chord right when it would fall off the left edge", () => {
    const lanes = chordLanes([72, 64], 0, 6);
    expect(new Set(lanes).size).toBe(2);
    expect(Math.min(...lanes)).toBe(0);
  });
  it("stays on a narrow road", () => {
    const lanes = chordLanes([84, 76, 67], 3, 4);
    expect(new Set(lanes).size).toBe(3);
    for (const l of lanes) expect(l).toBeGreaterThanOrEqual(0), expect(l).toBeLessThan(4);
  });
});
