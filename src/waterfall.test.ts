import { describe, expect, it } from "vitest";
import { fallingBar, validEffect } from "./waterfall";
describe("falling note timing", () => {
  const note = { midi: 60, time: 2, duration: 1.5, velocity: 0.7 };
  it("reaches the keyboard on onset and clears it on key release", () => {
    expect(fallingBar(note, 2, 150).bottom).toBe(150);
    const released = fallingBar(note, 3.5, 150);
    expect(released.bottom - released.length).toBe(150);
  });
  it("uses key duration rather than pedal sustain for bar length", () => {
    expect(fallingBar({ ...note, soundingDuration: 5 }, 1, 150).length).toBe(
      75,
    );
    expect(fallingBar({ ...note, duration: 3 }, 1, 150).length).toBe(150);
  });
  it("validates saved effects including the off option", () => {
    for (const effect of ["none", "ripple", "sparkles", "glow"])
      expect(validEffect(effect)).toBe(effect);
    expect(validEffect("bad")).toBe("ripple");
  });
});
