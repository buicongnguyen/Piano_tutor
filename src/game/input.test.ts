import { describe, expect, it } from "vitest";
import { LANE_KEYS, laneCodes, laneForKey, laneForMidi, laneLabels } from "./input";

describe("input mapping", () => {
  it("maps home-row keys to arcade lanes", () => {
    expect(LANE_KEYS[4].map((k) => laneForKey(k, { kind: "lanes", lanes: 4 }))).toEqual([0, 1, 2, 3]);
    expect(LANE_KEYS[6].map((k) => laneForKey(k, { kind: "lanes", lanes: 6 }))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(laneForKey("KeyS", { kind: "lanes", lanes: 4 })).toBeUndefined();
    expect(laneForKey("KeyQ", { kind: "lanes", lanes: 6 })).toBeUndefined();
  });

  it("supports ASDF (left hand) and JKL; (right hand) lane keys", () => {
    expect(laneLabels(4, "asdf")).toEqual(["A", "S", "D", "F"]);
    expect(laneCodes(4, "jkl")).toEqual(["KeyJ", "KeyK", "KeyL", "Semicolon"]);
    const asdf = { kind: "lanes" as const, lanes: 4, preset: "asdf" as const };
    expect(["KeyA", "KeyS", "KeyD", "KeyF"].map((k) => laneForKey(k, asdf))).toEqual([0, 1, 2, 3]);
    expect(laneForKey("KeyJ", asdf)).toBeUndefined();
    expect(laneForKey("Quote", { kind: "lanes", lanes: 6, preset: "jkl" })).toBe(5);
  });

  it("reads typed letters in words mode (any keyboard layout)", () => {
    const words = { kind: "words" as const };
    expect(laneForKey("KeyA", words, "a")).toBe(0);
    expect(laneForKey("KeyQ", words, "A")).toBe(0); // AZERTY: the Q position types A
    expect(laneForKey("KeyZ", words, "z")).toBe(25);
    expect(laneForKey("Digit1", words, "1")).toBeUndefined();
    expect(laneForKey("KeyP", words)).toBe(15);
    expect(laneForMidi(60, words)).toBeUndefined();
  });

  it("maps tap mode to left and right from either hand or the arrows", () => {
    const tap = { kind: "tap" as const };
    expect(["KeyF", "KeyD", "ArrowLeft"].map((k) => laneForKey(k, tap))).toEqual([0, 0, 0]);
    expect(["KeyJ", "KeyK", "ArrowRight"].map((k) => laneForKey(k, tap))).toEqual([1, 1, 1]);
    expect(laneForKey("KeyA", tap)).toBeUndefined();
    expect([laneForMidi(48, tap), laneForMidi(72, tap)]).toEqual([0, 1]);
  });

  it("maps the chromatic laptop layout from the chosen base C", () => {
    const mode = { kind: "piano" as const, base: 60, layout: "chromatic" as const };
    expect(laneForKey("KeyA", mode)).toBe(60);
    expect(laneForKey("KeyW", mode)).toBe(61);
    expect(laneForKey("Semicolon", mode)).toBe(76);
    expect(laneForKey("KeyA", { ...mode, base: 72 })).toBe(72);
    expect(laneForKey("KeyA", { kind: "piano", base: 48, layout: "home" })).toBe(48);
    expect(laneForKey("KeyJ", { kind: "piano", base: 48, layout: "home" })).toBe(55);
  });

  it("passes MIDI keys straight through in piano mode", () => {
    expect(laneForMidi(61, { kind: "piano", base: 60, layout: "chromatic" })).toBe(61);
  });

  it("maps white keys C–A of any octave to arcade lanes", () => {
    const lanes6 = { kind: "lanes" as const, lanes: 6 };
    expect([60, 62, 64, 65, 67, 69].map((m) => laneForMidi(m, lanes6))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(laneForMidi(48, lanes6)).toBe(0);
    expect(laneForMidi(61, lanes6)).toBeUndefined();
    expect(laneForMidi(71, lanes6)).toBeUndefined();
    expect(laneForMidi(67, { kind: "lanes", lanes: 4 })).toBeUndefined();
  });
});
