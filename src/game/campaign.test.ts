// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildChart } from "./chart";
import { allStages, islandOpen, islandRestored, islands, nextGate, totalStars } from "./campaign";
import { pieceFromBytes } from "./songs";
import { morningLight, roomToBreathe } from "../exercises";
import type { Piece } from "../music";

function load(ref: (typeof allStages)[number]["stage"]["song"]): Piece {
  if ("exercise" in ref) return ref.exercise === "morning-light" ? morningLight() : roomToBreathe();
  return pieceFromBytes(ref, Uint8Array.from(readFileSync(`public/music/${ref.file}`)).buffer);
}

describe("campaign", () => {
  it("has nine islands with rising star gates and unique stage ids", () => {
    expect(islands).toHaveLength(9);
    for (let i = 1; i < islands.length; i++) expect(islands[i].gate).toBeGreaterThan(islands[i - 1].gate);
    const ids = allStages.map((s) => s.stage.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]{1,60}$/.test(id))).toBe(true);
  });

  it("keeps every gate reachable with two stars per earlier stage", () => {
    let available = 0;
    for (const island of islands) {
      expect(island.gate).toBeLessThanOrEqual(Math.ceil(available * (2 / 3)) + 1);
      available += island.stages.length * 3;
    }
  });

  it("opens islands by stars and reports the next gate", () => {
    expect(islandOpen(islands[1], 3)).toBe(false);
    expect(islandOpen(islands[1], 4)).toBe(true);
    expect(islandOpen(islands[8], 0, true)).toBe(true);
    expect(nextGate(5)?.id).toBe("festival");
    expect(totalStars({ arirang: 3, "fur-elise": 2, "canon-in-d": 9 })).toBe(8);
    expect(totalStars({ "my-abc123": 3 })).toBe(0);
    expect(islandRestored(islands[0], { "morning-light": 1, "room-to-breathe": 2 })).toBe(false);
    expect(islandRestored(islands[0], { "morning-light": 1, "room-to-breathe": 2, arirang: 1 })).toBe(true);
  });

  it("charts every bundled stage into a playable level on every difficulty", () => {
    const report: string[] = [];
    for (const { stage } of allStages) {
      const piece = load(stage.song);
      for (const difficulty of ["easy", "normal", "hard"] as const) {
        const chart = buildChart(piece, { difficulty, mode: "lanes" });
        const length = chart.end - chart.start;
        const nps = chart.notes.length / Math.max(1, length);
        expect(chart.notes.length, `${stage.id} ${difficulty}`).toBeGreaterThanOrEqual(12);
        expect(length, stage.id).toBeLessThanOrEqual(151);
        expect(nps, `${stage.id} ${difficulty} notes/s`).toBeLessThan(difficulty === "easy" ? 2.5 : 10.5);
        expect(chart.beats.length, stage.id).toBeGreaterThan(8);
        if (difficulty === "normal")
          report.push(
            `${stage.id.padEnd(26)} ${length.toFixed(0).padStart(4)}s ${String(chart.notes.length).padStart(4)} notes ${nps.toFixed(2)}/s holds ${chart.notes.filter((n) => n.hold).length} golden ${chart.golden.length}${chart.excerpt ? " excerpt" : ""}`,
          );
      }
      const words = buildChart(piece, { difficulty: "normal", mode: "words", seed: stage.id });
      expect(words.words!.map((w) => w.text).join("").length, stage.id).toBe(words.notes.length);
      const piano = buildChart(piece, { difficulty: "normal", mode: "piano" });
      expect(piano.range[1] - piano.range[0], stage.id).toBeLessThanOrEqual(60);
    }
    if (process.env.CHART_REPORT) console.log(report.join("\n"));
  });
});
