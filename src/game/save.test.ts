import { describe, expect, it } from "vitest";
import type { Result } from "./judge";
import { bestStars, emptySave, KEY, loadSave, parseSave, recordKey, recordRun, storeSave } from "./save";

const result = (stars: number, score: number, extra: Partial<Result> = {}): Result => ({
  score,
  accuracy: [0.5, 0.65, 0.8, 0.95][stars],
  stars,
  rank: "B",
  fullCombo: false,
  maxCombo: 10,
  counts: { perfect: 10, great: 5, good: 2, miss: 1 },
  total: 18,
  strays: 0,
  meanOffsetMs: 0,
  holdPercent: 100,
  ...extra,
});

describe("save data", () => {
  it("rejects junk and keeps defaults", () => {
    for (const text of [null, "", "{", "[]", "42", '{"records":[1,2]}'])
      expect(parseSave(text)).toEqual(emptySave());
  });

  it("validates records, clamps numbers and drops unknown keys", () => {
    const save = parseSave(
      JSON.stringify({
        records: {
          "fur-elise|hard|piano": { stars: 9, score: -5, accuracy: 3, rank: "Z", fullCombo: "yes", plays: 2 },
          "bad key": { stars: 1 },
          "x|expert|lanes": { stars: 1 },
        },
        seen: ["intro", 5, "arrive:meadow"],
        freed: 1e12,
        lastIsland: "../../etc",
        settings: { noteSpeed: 99, offsetMs: -999, quality: "ultra", skin: "Neon!", difficulty: "hard", openAll: 1 },
      }),
    );
    expect(Object.keys(save.records)).toEqual(["fur-elise|hard|piano"]);
    expect(save.records["fur-elise|hard|piano"]).toEqual({ stars: 3, score: 0, accuracy: 1, rank: "D", fullCombo: false, plays: 2 });
    expect(save.seen).toEqual(["intro", "arrive:meadow"]);
    expect(save.freed).toBe(1e9);
    expect(save.lastIsland).toBe("meadow");
    expect(save.settings).toMatchObject({ noteSpeed: 10, offsetMs: -300, quality: "auto", skin: "cherry", difficulty: "hard", openAll: false });
  });

  it("accepts words-mode records and the new play options", () => {
    const save = parseSave(
      JSON.stringify({
        records: { "arirang|easy|words": { stars: 2, score: 10, accuracy: 0.8, rank: "B", fullCombo: false, plays: 1 } },
        settings: { mode: "words", laneKeys: "asdf", keepMelody: { lanes: true, piano: "yes" } },
      }),
    );
    expect(save.records["arirang|easy|words"].stars).toBe(2);
    expect(save.settings).toMatchObject({ mode: "words", laneKeys: "asdf", keepMelody: { lanes: true, piano: false, words: true } });
    expect(parseSave(JSON.stringify({ settings: { laneKeys: "wasd" } })).settings.laneKeys).toBe("dfjk");
  });

  it("starts phones in Tap mode with the song kept playing", () => {
    expect(parseSave(null, true).settings).toMatchObject({ mode: "tap", keepMelody: { tap: true } });
    expect(parseSave(null, false).settings.mode).toBe("lanes");
    expect(parseSave(JSON.stringify({ settings: { mode: "lanes" } }), true).settings.mode).toBe("lanes");
    expect(Object.keys(parseSave(JSON.stringify({ records: { "arirang|easy|tap": { stars: 1 } } })).records)).toEqual(["arirang|easy|tap"]);
  });

  it("keeps the best of every run and reports first clears", () => {
    const save = emptySave();
    const first = recordRun(save, "arirang", "easy", "lanes", result(1, 1000));
    expect(first).toEqual({ newBest: true, firstClear: true, starsGained: 1 });
    const worse = recordRun(save, "arirang", "easy", "lanes", result(0, 500, { rank: "D" }));
    expect(worse).toEqual({ newBest: false, firstClear: false, starsGained: 0 });
    expect(save.records[recordKey("arirang", "easy", "lanes")]).toMatchObject({ stars: 1, score: 1000, plays: 2 });
    const hard = recordRun(save, "arirang", "hard", "piano", result(3, 9000, { fullCombo: true }));
    expect(hard.starsGained).toBe(2);
    expect(bestStars(save)).toEqual({ arirang: 3 });
    expect(save.freed).toBe(17 * 3);
  });

  it("counts practice runs as plays only", () => {
    const save = emptySave();
    expect(recordRun(save, "arirang", "easy", "lanes", result(3, 9000), true)).toEqual({ newBest: false, firstClear: false, starsGained: 0 });
    expect(bestStars(save)).toEqual({ arirang: 0 });
    expect(save.freed).toBe(0);
  });

  it("round-trips through storage and survives storage failures", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const save = emptySave();
    recordRun(save, "canon-in-d", "normal", "lanes", result(2, 4000));
    expect(storeSave(storage, save)).toBe(true);
    expect(store.has(KEY)).toBe(true);
    expect(loadSave(storage)).toEqual(save);
    const broken = { getItem: () => { throw Error("denied"); }, setItem: () => { throw Error("full"); } };
    expect(loadSave(broken)).toEqual(emptySave());
    expect(storeSave(broken, save)).toBe(false);
  });
});
