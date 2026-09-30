import { describe, expect, it } from "vitest";
import { assignWords, COMMON_WORDS, HOME_ROW_WORDS, LONG_WORDS, THEME_WORDS } from "./words";

const steady = (n: number, step = 0.4) => Array.from({ length: n }, (_, i) => i * step);

function coverage(words: ReturnType<typeof assignWords>, n: number) {
  const seen: number[] = [];
  for (const w of words) {
    expect(w.last - w.first + 1).toBe(w.text.length);
    for (let i = w.first; i <= w.last; i++) seen.push(i);
  }
  expect(seen).toEqual(Array.from({ length: n }, (_, i) => i));
}

describe("word banks", () => {
  it("Easy words use only the home row", () => {
    for (const w of HOME_ROW_WORDS) expect(w, w).toMatch(/^[asdfghjkl]+$/);
  });
  it("every word is plain lowercase a–z and short enough to type in a phrase", () => {
    const all = [...HOME_ROW_WORDS, ...COMMON_WORDS, ...LONG_WORDS, ...Object.values(THEME_WORDS).flat()];
    for (const w of all) {
      expect(w, w).toMatch(/^[a-z]+$/);
      expect(w.length).toBeLessThanOrEqual(9);
    }
  });
});

describe("assignWords", () => {
  it("gives every note exactly one letter, in order", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const)
      for (const n of [1, 2, 7, 33, 120]) coverage(assignWords(steady(n), difficulty, 42), n);
  });

  it("never runs a word across a breath in the music", () => {
    const times = [0, 0.3, 0.6, 0.9, 1.2, 3.0, 3.3, 3.6, 3.9, 4.2, 4.5];
    const words = assignWords(times, "normal", 7);
    coverage(words, times.length);
    for (const w of words) expect(w.first <= 4 && w.last >= 5).toBe(false);
  });

  it("is deterministic for a seed and varies between seeds", () => {
    const a = assignWords(steady(60), "normal", 1).map((w) => w.text);
    expect(assignWords(steady(60), "normal", 1).map((w) => w.text)).toEqual(a);
    expect(assignWords(steady(60), "normal", 2).map((w) => w.text)).not.toEqual(a);
  });

  it("uses home-row words on Easy and longer words on Hard", () => {
    const easy = assignWords(steady(80), "easy", 3);
    expect(easy.map((w) => w.text).join("")).toMatch(/^[asdfghjkl]+$/);
    const hard = assignWords(steady(80), "hard", 3);
    const mean = hard.reduce((s, w) => s + w.text.length, 0) / hard.length;
    expect(mean).toBeGreaterThanOrEqual(4.5);
  });

  it("mixes in island words, at most about one in five", () => {
    const words = assignWords(steady(400), "normal", 9, "snow").map((w) => w.text);
    const themed = words.filter((w) => THEME_WORDS.snow.includes(w) && !COMMON_WORDS.includes(w));
    expect(themed.length).toBeGreaterThan(0);
    expect(themed.length).toBeLessThanOrEqual(Math.ceil(words.length / 5));
  });

  it("never repeats a word back to back", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const)
      for (let seed = 1; seed < 30; seed++) {
        const words = assignWords(steady(120, 0.3), difficulty, seed, "snow").map((w) => w.text);
        for (let i = 1; i < words.length; i++) expect(words[i], `${difficulty} ${seed}`).not.toBe(words[i - 1]);
      }
  });

  it("breaks words at local breaths and long pauses", () => {
    // A fast run, then slow notes a second and a half apart.
    const times = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1.5, 3.0, 4.5, 6.0, 7.5];
    const words = assignWords(times, "normal", 3);
    coverage(words, times.length);
    for (const w of words) {
      expect(times[w.last] - times[w.first]).toBeLessThanOrEqual(3);
      for (let i = w.first; i < w.last; i++) expect(times[i + 1] - times[i]).toBeLessThan(1);
    }
    // The run ends at its breath; only a lone note may join it, as its last letter.
    expect(words.find((w) => w.first <= 5 && w.last >= 6)?.last ?? 6).toBe(6);
  });

  it("joins a lone pickup note to its phrase instead of spelling one-letter words", () => {
    // Pickup, short breath, then a steady phrase.
    const times = [0, 0.8, 1.1, 1.4, 1.7, 2.0, 2.3];
    const words = assignWords(times, "normal", 5);
    expect(words[0].text.length).toBeGreaterThan(1);
  });
});
