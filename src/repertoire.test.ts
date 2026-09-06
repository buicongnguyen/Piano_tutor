// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseMidi } from "./music";
import { keyboardLayout } from "./keyboard";
import { repertoire } from "./repertoire";

describe("bundled internet editions", () => {
  for (const [file, notes, seconds] of [
    ["maple-leaf-rag.mid", 2566, 144],
    ["arabesque-no-1.mid", 1448, 176.249718],
    ["prelude-kumar.mid", 712, 252],
    ["flat-kumar.mid", 1670, 662],
    ["clair-de-lune.mid", 1468, 322.5],
    ["the-entertainer.mid", 2621, 252.9166],
    ["nocturne-op9-no2.mid", 1242, 202.2725],
    ["moonlight-1.mid", 1142, 276],
    ["moonlight-2.mid", 373, 179],
    ["moonlight-3.mid", 4863, 801.7135],
  ] as const) {
    it(`imports every note in ${file}, including both named hands`, () => {
      const piece = parseMidi(
        Uint8Array.from(readFileSync(`public/music/${file}`)).buffer,
        file,
      );
      expect(piece.notes).toHaveLength(notes);
      expect(piece.duration).toBeCloseTo(seconds, 1);
      expect(piece.notes.some((n) => n.hand === "left")).toBe(true);
      expect(piece.notes.some((n) => n.hand === "right")).toBe(true);
      expect(piece.notes.every((n) => n.hand)).toBe(true);
    });
  }
  it("preserves the complete contemporary Variations without guessing hands", () => {
    const piece = parseMidi(
      Uint8Array.from(readFileSync("public/music/variations-automne.mid"))
        .buffer,
      "Variations",
    );
    expect(piece.notes).toHaveLength(545);
    expect(piece.duration).toBeCloseTo(141.54975375, 3);
    expect(
      piece.notes.every((n) => n.duration > 0 && n.midi >= 21 && n.midi <= 108),
    ).toBe(true);
    expect(piece.notes.every((n) => n.hand === undefined)).toBe(true);
  });
  it("ships a real printable PDF for every repertoire entry", () => {
    for (const item of repertoire) {
      const bytes = readFileSync(`public/music/${item.sheet}`);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(10000);
      expect(bytes.subarray(-100).toString()).toContain("%%EOF");
    }
  });
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
      expect(piece.notes.some((n) => n.hand === "left" && n.midi >= 60)).toBe(
        true,
      );
      expect(piece.notes.some((n) => n.hand === "right" && n.midi < 60)).toBe(
        true,
      );
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
