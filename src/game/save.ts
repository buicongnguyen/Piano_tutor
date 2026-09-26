// Local save data: progress per stage, story beats seen and player settings.
// Everything is validated on load; storage failures never break play.
import type { Difficulty, KeyMode } from "./chart";
import type { Result } from "./judge";

export type StageRecord = {
  stars: number;
  score: number;
  accuracy: number;
  rank: Result["rank"];
  fullCombo: boolean;
  plays: number;
};

export type Settings = {
  noteSpeed: number; // 1..10, higher = faster road
  offsetMs: number; // audio/visual offset, positive = judge later
  music: number; // 0..1
  effects: number; // 0..1
  quality: "auto" | "low" | "medium" | "high";
  labels: boolean;
  motion: "auto" | "reduced" | "full";
  openAll: boolean;
  laptop: "chromatic" | "home";
  difficulty: Difficulty;
  mode: KeyMode;
  practiceSpeed: number; // 0.5..1
  skin: string;
};

export type SaveData = {
  v: 1;
  records: Record<string, StageRecord>; // key: `${stage}|${difficulty}|${mode}`
  seen: string[];
  freed: number; // lifetime notes hit ("stillnotes freed")
  lastIsland: string;
  settings: Settings;
};

export const KEY = "stillnote-encore-v1";

export const defaultSettings = (): Settings => ({
  noteSpeed: 5,
  offsetMs: 0,
  music: 0.8,
  effects: 0.7,
  quality: "auto",
  labels: true,
  motion: "auto",
  openAll: false,
  laptop: "chromatic",
  difficulty: "easy",
  mode: "lanes",
  practiceSpeed: 0.75,
  skin: "cherry",
});

export const emptySave = (): SaveData => ({
  v: 1,
  records: {},
  seen: [],
  freed: 0,
  lastIsland: "meadow",
  settings: defaultSettings(),
});

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
const pick = <T extends string>(v: unknown, options: readonly T[], d: T): T =>
  options.includes(v as T) ? (v as T) : d;
const RANKS = ["S+", "S", "A", "B", "C", "D"] as const;

export function parseSave(text: string | null): SaveData {
  const out = emptySave();
  if (!text) return out;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return out;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return out;
  const d = data as Record<string, unknown>;
  if (d.records && typeof d.records === "object" && !Array.isArray(d.records))
    for (const [key, value] of Object.entries(d.records as Record<string, unknown>).slice(0, 2000)) {
      if (!/^[a-z0-9-]{1,60}\|(easy|normal|hard)\|(lanes|piano)$/.test(key)) continue;
      if (!value || typeof value !== "object") continue;
      const r = value as Record<string, unknown>;
      out.records[key] = {
        stars: Math.round(num(r.stars, 0, 3, 0)),
        score: Math.round(num(r.score, 0, 1e9, 0)),
        accuracy: num(r.accuracy, 0, 1, 0),
        rank: pick(r.rank, RANKS, "D"),
        fullCombo: r.fullCombo === true,
        plays: Math.round(num(r.plays, 0, 1e6, 0)),
      };
    }
  if (Array.isArray(d.seen))
    out.seen = d.seen.filter((s): s is string => typeof s === "string" && s.length < 80).slice(0, 500);
  out.freed = Math.round(num(d.freed, 0, 1e9, 0));
  if (typeof d.lastIsland === "string" && /^[a-z]{1,20}$/.test(d.lastIsland)) out.lastIsland = d.lastIsland;
  const s = (d.settings && typeof d.settings === "object" ? d.settings : {}) as Record<string, unknown>;
  const def = defaultSettings();
  out.settings = {
    noteSpeed: num(s.noteSpeed, 1, 10, def.noteSpeed),
    offsetMs: Math.round(num(s.offsetMs, -300, 300, def.offsetMs)),
    music: num(s.music, 0, 1, def.music),
    effects: num(s.effects, 0, 1, def.effects),
    quality: pick(s.quality, ["auto", "low", "medium", "high"] as const, def.quality),
    labels: typeof s.labels === "boolean" ? s.labels : def.labels,
    motion: pick(s.motion, ["auto", "reduced", "full"] as const, def.motion),
    openAll: s.openAll === true,
    laptop: pick(s.laptop, ["chromatic", "home"] as const, def.laptop),
    difficulty: pick(s.difficulty, ["easy", "normal", "hard"] as const, def.difficulty),
    mode: pick(s.mode, ["lanes", "piano"] as const, def.mode),
    practiceSpeed: num(s.practiceSpeed, 0.5, 1, def.practiceSpeed),
    skin: typeof s.skin === "string" && /^[a-z]{1,16}$/.test(s.skin) ? s.skin : def.skin,
  };
  return out;
}

export const recordKey = (stage: string, difficulty: Difficulty, mode: KeyMode) =>
  `${stage}|${difficulty}|${mode}`;

/** Best stars per stage across every difficulty and key mode. */
export function bestStars(save: SaveData): Record<string, number> {
  const best: Record<string, number> = {};
  for (const [key, r] of Object.entries(save.records)) {
    const stage = key.split("|")[0];
    best[stage] = Math.max(best[stage] ?? 0, r.stars);
  }
  return best;
}

export type RecordOutcome = { newBest: boolean; firstClear: boolean; starsGained: number };

/** Merge a finished run into the save. Practice runs only count plays. */
export function recordRun(
  save: SaveData,
  stage: string,
  difficulty: Difficulty,
  mode: KeyMode,
  result: Result,
  practice = false,
): RecordOutcome {
  const key = recordKey(stage, difficulty, mode);
  const before = bestStars(save)[stage] ?? 0;
  const prior = save.records[key];
  const plays = (prior?.plays ?? 0) + 1;
  if (practice) {
    save.records[key] = prior
      ? { ...prior, plays }
      : { stars: 0, score: 0, accuracy: 0, rank: "D", fullCombo: false, plays };
    return { newBest: false, firstClear: false, starsGained: 0 };
  }
  const newBest = !prior || result.score > prior.score;
  save.records[key] = {
    stars: Math.max(prior?.stars ?? 0, result.stars),
    score: Math.max(prior?.score ?? 0, result.score),
    accuracy: Math.max(prior?.accuracy ?? 0, result.accuracy),
    rank: newBest ? result.rank : prior!.rank,
    fullCombo: (prior?.fullCombo ?? false) || result.fullCombo,
    plays,
  };
  save.freed += result.counts.perfect + result.counts.great + result.counts.good;
  const after = bestStars(save)[stage] ?? 0;
  return { newBest, firstClear: before === 0 && after > 0, starsGained: after - before };
}

export function loadSave(storage: Pick<Storage, "getItem"> | undefined): SaveData {
  try {
    return parseSave(storage?.getItem(KEY) ?? null);
  } catch {
    return emptySave();
  }
}

export function storeSave(storage: Pick<Storage, "setItem"> | undefined, save: SaveData) {
  try {
    storage?.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
