// Words mode: every charted note carries a letter, and the letters spell easy
// English words. Easy words use only the home row (a s d f g h j k l) for
// first-time typists; Normal and Hard draw on common words plus a few words
// themed to each island. Words are fitted to the music's phrases.
import type { Difficulty } from "./chart";

// Home-row only: the first thing a typing class teaches.
export const HOME_ROW_WORDS = [
  "a", "ad", "ah", "as", "add", "ads", "aha", "all", "ash", "ask", "dad", "fad", "gag", "gal", "gas", "had", "has",
  "lad", "lag", "sad", "adds", "alas", "asks", "dads", "dash", "fads", "fall", "flag", "gala", "glad", "half", "hall",
  "hash", "lads", "lags", "lash", "lass", "sash", "falls", "flags", "flash", "flask", "glass", "halls", "salad",
  "salsa", "shall", "slash", "salads", "flasks", "alfalfa",
];

export const COMMON_WORDS = [
  "a", "i", "go", "hi", "up", "we", "me", "my", "yes", "sun", "sky", "sea", "joy", "fun", "hop", "run", "hug", "key",
  "tea", "jam", "cat", "dog", "fox", "owl", "bee", "bed", "pen", "cup", "box", "toy", "map", "six", "zip", "zoo",
  "red", "art", "ice", "day", "way", "new", "big", "hat", "bus", "pie", "egg", "song", "note", "play", "sing", "star",
  "moon", "wave", "boat", "bird", "tree", "leaf", "rain", "snow", "wind", "gold", "blue", "pink", "jump", "kind",
  "love", "lamp", "bell", "drum", "harp", "horn", "tune", "beat", "keys", "band", "cake", "milk", "plum", "frog",
  "duck", "fish", "seal", "bear", "deer", "home", "door", "room", "book", "page", "word", "ball", "kite", "ship",
  "road", "path", "hill", "lake", "pond", "isle", "rose", "lily", "seed", "grow", "glow", "calm", "soft", "fast",
  "slow", "cozy", "wish", "hope", "jazz", "quiz", "zoom", "king", "nest", "town", "farm", "time", "good", "nice",
  "warm", "cool", "gift", "card", "sock", "coat", "hand", "foot", "nose", "eyes", "smile", "laugh", "dream", "light",
  "dance", "happy", "sweet", "bread", "apple", "lemon", "peach", "grape", "berry", "whale", "mouse", "river", "cloud",
  "storm", "frost", "bloom", "spark", "shine", "brave", "quiet", "jolly", "merry", "sunny", "hello", "zebra", "queen",
  "crown", "magic", "music", "piano", "tempo", "quick", "chair", "plant", "beach", "shell", "train", "brush", "paint",
  "story", "sleep", "water", "green", "white", "black", "tiger", "panda", "koala", "honey", "sugar", "candy", "pizza",
];

export const LONG_WORDS = [
  "melody", "rhythm", "harmony", "concert", "keyboard", "sunshine", "rainbow", "thunder", "lantern", "festival",
  "carousel", "garden", "blossom", "meadow", "harbour", "village", "snowflake", "starlight", "moonlight", "twinkle",
  "whisper", "journey", "captain", "balloon", "windmill", "fountain", "sparkle", "wonderful", "adventure", "treasure",
  "kingdom", "dragon", "castle", "silver", "golden", "crystal", "ribbon", "butterfly", "pancake", "cinnamon",
  "chocolate", "blueberry", "mountain", "island", "voyage", "compass", "planet", "galaxy", "rocket", "puzzle",
  "picnic", "chorus", "violin", "trumpet", "clarinet", "guitar", "encore", "practice", "perfect", "applause",
  "graceful", "gentle", "sleepy", "dreamer", "quickly", "jumping", "jigsaw", "wizard", "yellow", "purple", "orange",
  "emerald", "sapphire", "friendly", "birthday", "sunflower", "pineapple", "keyboard", "marching", "painting",
];

// A few words for each island's mood, mixed into Normal and Hard.
export const THEME_WORDS: Record<string, string[]> = {
  meadow: ["meadow", "windmill", "flower", "sheep", "grass", "breeze", "dawn"],
  snow: ["snow", "frost", "sled", "mitten", "cocoa", "carol", "bells", "cozy"],
  festival: ["lantern", "parade", "drums", "flags", "fireworks", "festival"],
  pier: ["pier", "sail", "gull", "waves", "popcorn", "carousel", "ragtime"],
  garden: ["rose", "tulip", "daisy", "fern", "orchid", "petal", "garden"],
  neon: ["neon", "synth", "laser", "pixel", "disco", "remix", "bass"],
  harbour: ["harbour", "anchor", "beacon", "ship", "tide", "moonlit", "sailor"],
  spring: ["blossom", "bud", "nest", "lamb", "spring", "bloom"],
  summer: ["summer", "beach", "shell", "surf", "sunny", "lemonade"],
  autumn: ["autumn", "maple", "acorn", "leaves", "harvest", "pumpkin"],
  winter: ["winter", "snowman", "frost", "igloo", "sleigh", "icicle"],
  crown: ["crown", "castle", "bell", "tower", "cloud", "canon", "hush"],
};

const LENGTHS: Record<Difficulty, [number, number]> = { easy: [2, 5], normal: [3, 6], hard: [5, 9] };

export type Word = { text: string; first: number; last: number }; // indices into the note list

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function hashText(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function bank(difficulty: Difficulty, theme?: string) {
  const base = difficulty === "easy" ? HOME_ROW_WORDS : difficulty === "normal" ? COMMON_WORDS : [...LONG_WORDS, ...COMMON_WORDS];
  const themed = difficulty === "easy" ? [] : THEME_WORDS[theme ?? ""] ?? [];
  const byLength = new Map<number, string[]>();
  for (const w of [...base, ...themed, ...themed]) {
    const list = byLength.get(w.length) ?? [];
    list.push(w);
    byLength.set(w.length, list);
  }
  return byLength;
}

/**
 * Split a run of onset times into words. Breaths in the music (gaps clearly
 * longer than the usual note spacing) always end a word, so each word is typed
 * as one flowing burst. Deterministic for a given seed.
 */
export function assignWords(times: number[], difficulty: Difficulty, seed: number, theme?: string): Word[] {
  const words: Word[] = [];
  if (!times.length) return words;
  const random = rng(seed);
  const byLength = bank(difficulty, theme);
  const [minLen, maxLen] = LENGTHS[difficulty];
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0.5;
  const breath = Math.max(median * 1.6, median + 0.3);
  // Segments between breaths.
  const segments: [number, number][] = [];
  let from = 0;
  gaps.forEach((g, i) => {
    if (g >= breath) {
      segments.push([from, i]);
      from = i + 1;
    }
  });
  segments.push([from, times.length - 1]);
  const recent: string[] = [];
  const pick = (length: number) => {
    // The exact length if the bank has it, else the nearest shorter one.
    for (let l = length; l >= 1; l--) {
      const list = byLength.get(l);
      if (!list?.length) continue;
      const fresh = list.filter((w) => !recent.includes(w));
      const pool = fresh.length ? fresh : list;
      const word = pool[Math.floor(random() * pool.length)];
      recent.push(word);
      if (recent.length > 10) recent.shift();
      return word;
    }
    return "a";
  };
  for (const [a, b] of segments) {
    let i = a;
    while (i <= b) {
      const left = b - i + 1;
      let length = minLen + Math.floor(random() * (maxLen - minLen + 1));
      if (left - length > 0 && left - length < minLen) length = left - minLen >= minLen ? left - minLen : left; // no stranded tail
      length = Math.max(1, Math.min(length, left));
      const text = pick(length);
      words.push({ text, first: i, last: i + text.length - 1 });
      i += text.length;
    }
  }
  return words;
}

/** Letter index 0–25 for a word's character. */
export const letterIndex = (ch: string) => ch.toLowerCase().charCodeAt(0) - 97;
export const letterOf = (index: number) => String.fromCharCode(97 + index);
