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

  it("mixes in island words", () => {
    const words = assignWords(steady(400), "normal", 9, "snow").map((w) => w.text);
    expect(words.some((w) => THEME_WORDS.snow.includes(w))).toBe(true);
  });
});
