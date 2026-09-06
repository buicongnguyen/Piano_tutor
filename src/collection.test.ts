import { describe, expect, it } from "vitest";
import { musicMatches } from "./collection";

describe("collection search", () => {
  it("finds River Flows in You with the requested spelling and composer", () => {
    // Metadata-only test; no substitute notes masquerade as Yiruma's song.
    for (const query of [
      "Rivers flow in you",
      "river flows",
      "YIRUMA",
      "yiruma river",
      "  River   flows  ",
    ])
      expect(musicMatches("River Flows in You", "Yiruma", query)).toBe(true);
    expect(
      musicMatches("Gymnopédie No. 1", "Erik Satie", "Rivers flow in you"),
    ).toBe(false);
  });
  it("searches accents, punctuation, composer and empty queries", () => {
    expect(musicMatches("Für Elise", "Ludwig van Beethoven", "fur elise")).toBe(
      true,
    );
    expect(
      musicMatches("Nocturne Op. 9 No. 2", "Frédéric Chopin", "chopin op 9"),
    ).toBe(true);
    expect(musicMatches("Clair de lune", "Claude Debussy", "")).toBe(true);
    expect(musicMatches("Clair de lune", "Claude Debussy", "satie")).toBe(
      false,
    );
  });
});
