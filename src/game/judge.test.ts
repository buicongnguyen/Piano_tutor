import { describe, expect, it } from "vitest";
import type { Chart, ChartNote } from "./chart";
import { Judge } from "./judge";

function chart(times: number[], opts: { lanes?: number[]; holds?: number[]; golden?: number[][] } = {}): Chart {
  const notes: ChartNote[] = times.map((time, i) => ({
    id: i,
    time,
    end: opts.holds?.[i] ? time + opts.holds[i] : time,
    midi: 60 + i,
    lane: opts.lanes?.[i] ?? i % 4,
    hold: !!opts.holds?.[i],
    golden: !!opts.golden?.some((g) => g.includes(i)),
    group: i,
    velocity: 0.7,
    sound: 0.3,
  }));
  return {
    notes,
    accompaniment: [],
    mode: "lanes",
    lanes: 4,
    difficulty: "normal",
    start: 0,
    end: 60,
    excerpt: false,
    beats: [],
    bars: [],
    range: [60, 72],
    golden: (opts.golden ?? []).map((ids) => ({ start: times[ids[0]], end: times[ids.at(-1)!], ids })),
  };
}

describe("judge", () => {
  it("includes missed holds in completion but excludes assisted holds", () => {
    const ch=chart([1,3],{holds:[1,1]});
    const missed=new Judge(ch); missed.update(5);
    expect(missed.result().holdPercent).toBe(0);
    const partial=new Judge(ch); partial.press(0,1); partial.update(5);
    expect(partial.result().holdPercent).toBe(50);
    const assisted=new Judge(ch,{skip:[1]}); assisted.press(0,1); assisted.update(5);
    expect(assisted.result().holdPercent).toBe(100);
  });
  it("grades by timing window", () => {
    const j = new Judge(chart([1, 2, 3, 4]));
    expect(j.press(0, 1.02)[0]).toMatchObject({ type: "hit", judgement: "perfect" });
    expect(j.press(1, 2.07)[0]).toMatchObject({ type: "hit", judgement: "great" });
    expect(j.press(2, 2.88)[0]).toMatchObject({ type: "hit", judgement: "good" });
    expect(j.update(4.3)[0]).toMatchObject({ type: "miss", early: false });
    expect(j.counts).toEqual({ perfect: 1, great: 1, good: 1, miss: 1 });
  });

  it("scales windows by playback speed", () => {
    const j = new Judge(chart([1]), { speed: 0.5 });
    // 40 ms of song time is 80 ms of real time at half speed: Great, not Perfect.
    expect(j.press(0, 1.04)[0]).toMatchObject({ judgement: "great" });
  });

  it("counts a press with no note nearby as a stray without breaking combo", () => {
    const j = new Judge(chart([1, 2]));
    j.press(0, 1);
    expect(j.press(3, 1.5)[0]).toMatchObject({ type: "stray" });
    expect(j.combo).toBe(1);
    expect(j.strays).toBe(1);
  });

  it("counts a wrong key while a note is due elsewhere, breaking combo", () => {
    const j = new Judge(chart([1, 2], { lanes: [0, 1] }));
    j.press(0, 1);
    expect(j.press(3, 2.02)[0]).toMatchObject({ type: "wrong", lane: 3 });
    expect(j.combo).toBe(0);
    expect(j.wrong).toBe(1);
    // The right key still hits the note.
    expect(j.press(1, 2.03)[0]).toMatchObject({ type: "hit" });
  });

  it("lets a real keyboard add extra notes without penalty", () => {
    const j = new Judge(chart([1, 2], { lanes: [60, 64] }), { wrongKeys: false });
    j.press(60, 1);
    expect(j.press(48, 1.01)[0]).toMatchObject({ type: "stray" });
    expect(j.combo).toBe(1);
  });

  it("gives no stars for mashing every lane", () => {
    const times = Array.from({ length: 10 }, (_, i) => 1 + i);
    const j = new Judge(chart(times));
    for (const t of times) for (let lane = 0; lane < 4; lane++) j.press(lane, t);
    const r = j.result();
    expect(r.wrong).toBe(30);
    expect(r.stars).toBe(0);
    expect(r.fullCombo).toBe(false);
  });

  it("does not punish a late press at a note that just timed out twice", () => {
    const j = new Judge(chart([1, 1.35], { lanes: [0, 0] }));
    expect(j.update(1.16)[0]).toMatchObject({ type: "miss", early: false });
    // 0.18 s late for note 0, 0.17 s early for note 1: the old miss, not a new one.
    expect(j.press(0, 1.18)[0]).toMatchObject({ type: "stray" });
    expect(j.press(0, 1.35)[0]).toMatchObject({ type: "hit" });
    expect(j.counts.miss).toBe(1);
  });

  it("consumes a note on an early press in the miss zone", () => {
    const j = new Judge(chart([1]));
    expect(j.press(0, 0.83)[0]).toMatchObject({ type: "miss", early: true });
    expect(j.press(0, 1)[0]).toMatchObject({ type: "stray" });
  });

  it("builds the multiplier every ten notes and resets on a miss", () => {
    const times = Array.from({ length: 25 }, (_, i) => 1 + i * 0.5);
    const j = new Judge(chart(times, { lanes: times.map(() => 0) }));
    for (let i = 0; i < 20; i++) j.press(0, times[i]);
    expect(j.multiplier).toBe(3);
    // Combo 1-9 at x1, the 10th note starts x2, the 20th x3.
    expect(j.score).toBe(9 * 300 + 10 * 600 + 900);
    j.update(times[20] + 0.3);
    expect(j.combo).toBe(0);
    expect(j.multiplier).toBe(1);
    expect(j.maxCombo).toBe(20);
  });

  it("scores holds by the fraction held", () => {
    const j = new Judge(chart([1, 5], { holds: [2, 0], lanes: [0, 1] }));
    j.press(0, 1);
    const ev = j.release(0, 2);
    expect(ev[0]).toMatchObject({ type: "hold-end", complete: false });
    j.press(1, 5);
    expect(j.result().holdPercent).toBe(50);
  });

  it("completes a hold held to its end", () => {
    const j = new Judge(chart([1], { holds: [1] }));
    j.press(0, 1);
    const ev = j.update(2.01);
    expect(ev.find((e) => e.type === "hold-end")).toMatchObject({ complete: true });
    expect(j.finished).toBe(true);
  });

  it("fills the Encore gauge from a completed golden phrase and drains while active", () => {
    const times = [1, 1.5, 2, 2.5, 3, 3.5, 10, 10.5, 11, 11.5, 12, 12.5];
    const golden = [
      [0, 1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10, 11],
    ];
    const j = new Judge(chart(times, { lanes: times.map(() => 0), golden }));
    for (const t of times) j.press(0, t);
    // Two golden phrases in the song: each fills half the gauge.
    expect(j.encore).toBeCloseTo(1);
    expect(j.activateEncore()).toEqual([{ type: "encore", active: true }]);
    j.update(13);
    j.update(20);
    expect(j.encore).toBeLessThan(1);
    const ended = j.update(50);
    expect(j.encoreActive).toBe(false);
    expect(ended).toContainEqual({ type: "encore", active: false });
  });

  it("fills a quarter per phrase when a song has many golden phrases", () => {
    const times = Array.from({ length: 8 }, (_, i) => 1 + i);
    const golden = [[0, 1], [2, 3], [4, 5], [6, 7]];
    const j = new Judge(chart(times, { lanes: times.map(() => 0), golden }));
    for (const t of times.slice(0, 2)) j.press(0, t);
    expect(j.encore).toBeCloseTo(0.25);
  });

  it("breaks a golden phrase on a miss", () => {
    const times = [1, 1.5, 2, 2.5, 3, 3.5];
    const j = new Judge(chart(times, { lanes: times.map(() => 0), golden: [[0, 1, 2, 3, 4, 5]] }));
    j.press(0, 1);
    const events = j.update(2);
    expect(events).toContainEqual(expect.objectContaining({ type: "golden", complete: false }));
    expect(j.encore).toBe(0);
  });

  it("doubles points during Encore", () => {
    const times = [1, 1.5, 2, 2.5, 3, 3.5, 5];
    const j = new Judge(chart(times, { lanes: times.map(() => 0), golden: [[0, 1, 2, 3, 4, 5]] }));
    for (const t of times.slice(0, 6)) j.press(0, t);
    j.encore = 0.5;
    j.activateEncore();
    const [hit] = j.press(0, 5);
    expect(hit).toMatchObject({ type: "hit", points: 600 });
  });

  it("computes stars, rank and full combo", () => {
    const times = Array.from({ length: 10 }, (_, i) => 1 + i);
    const perfect = new Judge(chart(times, { lanes: times.map(() => 0) }));
    for (const t of times) perfect.press(0, t);
    expect(perfect.result()).toMatchObject({ stars: 3, rank: "S+", fullCombo: true, accuracy: 1 });
    const mixed = new Judge(chart(times, { lanes: times.map(() => 0) }));
    for (const t of times.slice(0, 7)) mixed.press(0, t);
    mixed.update(20);
    expect(mixed.result()).toMatchObject({ stars: 1, rank: "C", fullCombo: false });
  });

  it("earns the first star for hitting notes even when timing is loose", () => {
    const times = Array.from({ length: 10 }, (_, i) => 1 + i);
    const j = new Judge(chart(times, { lanes: times.map(() => 0) }));
    for (const t of times.slice(0, 7)) j.press(0, t + 0.11); // all Good (≈50% credit)
    j.update(20);
    const r = j.result();
    expect(r.accuracy).toBeLessThan(0.6);
    expect(r.stars).toBe(1);
  });

  it("breaks the combo and the full combo when a hold is dropped early", () => {
    const j = new Judge(chart([1, 5], { holds: [2, 0], lanes: [0, 1] }));
    j.press(0, 1);
    j.release(0, 1.3);
    expect(j.combo).toBe(0);
    j.press(1, 5);
    const r = j.result();
    expect(r.holdsDropped).toBe(1);
    expect(r.fullCombo).toBe(false);
  });

  it("never scores assisted notes", () => {
    const j = new Judge(chart([1, 2]), { skip: [1] });
    j.press(0, 1);
    j.update(5);
    expect(j.result()).toMatchObject({ total: 1, accuracy: 1, fullCombo: true });
  });

  it("waits at the gate in practice mode", () => {
    const j = new Judge(chart([1, 1, 2], { lanes: [0, 1, 2] }).notes.length ? chart([1, 1, 2], { lanes: [0, 1, 2] }) : chart([]), {
      practice: true,
    });
    // Notes 0 and 1 are separate groups in this fixture; the gate is note 0.
    expect(j.gate()?.id).toBe(0);
    expect(j.press(2, 5)[0]).toMatchObject({ type: "stray" });
    expect(j.press(0, 1)[0]).toMatchObject({ type: "hit" });
    expect(j.gate()?.id).toBe(1);
    expect(j.update(100)).toEqual([]);
    expect(j.result().stars).toBe(0);
  });

  it("returns zero metrics for an empty chart", () => {
    const r = new Judge(chart([])).result();
    expect(r).toMatchObject({ accuracy: 0, stars: 0, fullCombo: false, total: 0 });
  });
});
