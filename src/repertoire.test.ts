// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseMidi } from "./music";
import { keyboardLayout } from "./keyboard";

describe("bundled internet editions", () => {
  for (const [file, minNotes, seconds] of [
    ["gymnopedie-no-1.mid", 282, 141],
    ["fur-elise.mid", 905, 130.4166],
  ] as const) {
    it(`${file} parses through the app importer and plays for over two minutes`, () => {
      const buffer = readFileSync(`public/music/${file}`);
      const bytes = Uint8Array.from(buffer);
      const piece = parseMidi(bytes.buffer, file);
      expect(piece.notes.length).toBe(minNotes);
      expect(piece.duration).toBeCloseTo(seconds, 1);
      expect(
        piece.notes.some(
          (n, i) =>
            i > 0 && Math.abs(n.time - piece.notes[i - 1].time) < 0.0001,
        ),
      ).toBe(true);
    });
  }
});
describe("physical keyboard geometry", () => {
  it("lays out all 88 keys with 52 white keys and no overflow", () => {
    const layout = keyboardLayout(21, 108);
    expect(layout.whiteCount).toBe(52);
    expect(layout.keys.length).toBe(88);
    expect(layout.keys[0].midi).toBe(21);
    expect(layout.keys.at(-1)?.midi).toBe(108);
    for (const key of layout.keys) {
      expect(key.left).toBeGreaterThanOrEqual(0);
      expect(
        key.left + (100 / layout.whiteCount) * (key.black ? 0.64 : 1),
      ).toBeLessThanOrEqual(100.0001);
    }
  });
});
