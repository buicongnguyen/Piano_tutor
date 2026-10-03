import { expect, it } from "vitest";
import { beatIndexAt } from "./timeline";

it("finds beats before, on and between onsets, including rewinds", () => {
  const beats = [0, 0.5, 1, 1, 2, 3];
  for (const time of [-1, 0, 0.75, 1, 10, 0.25, -1]) {
    let expected = -1;
    beats.forEach((b, i) => { if (b <= time) expected = i; });
    expect(beatIndexAt(beats, time)).toBe(expected);
  }
  expect(beatIndexAt([], 1)).toBe(-1);
});
