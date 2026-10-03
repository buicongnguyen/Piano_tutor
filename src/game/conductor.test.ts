import { describe, expect, it } from "vitest";
import type { Chart, ChartNote } from "./chart";
import { Conductor } from "./conductor";
import { Judge } from "./judge";
import type { SoundBank } from "./sound";

// Fake processing/output clocks; zero latency is the default for existing scenarios.
function fakeBank(latency = 0) {
  const notes: { midi: number; at: number; duration: number }[] = [];
  let now = 0;
  const bank = {
    ctx: { get currentTime() { return now; } },
    get now() { return now; },
    heardAt: () => now - latency,
    note: (midi: number, at: number, duration: number) => {
      notes.push({ midi, at, duration });
      return () => undefined;
    },
    stopAll: () => undefined,
  } as unknown as SoundBank;
  return { bank, notes, advance: (s: number) => (now += s) };
}

const note = (id: number, time: number, lane = 0): ChartNote => ({
  id, time, end: time, midi: 60 + id, lane, hold: false, golden: false, group: id, velocity: 0.7, sound: 0.3,
});

function chart(notes: ChartNote[]): Chart {
  return {
    notes,
    accompaniment: [
      { time: 0.5, duration: 0.4, midi: 48, velocity: 0.6 },
      { time: 2, duration: 0.4, midi: 50, velocity: 0.6 },
      { time: 3, duration: 5, midi: 52, velocity: 0.6 },
    ],
    mode: "lanes", lanes: 4, difficulty: "easy", start: 0, end: 4, excerpt: false,
    beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], bars: [0, 2], range: [60, 64], golden: [],
  };
}

describe("conductor", () => {
  it("caps lookahead at an uncleared practice gate and schedules after clearing", () => {
    const {bank, notes, advance} = fakeBank();
    const ch = chart([note(0, 1)]);
    ch.accompaniment = [{time:1.05,midi:48,duration:.3,velocity:.6}];
    const c = new Conductor(bank,ch,{speed:1,practice:true,offsetMs:0,approach:1});
    let gate: number | undefined = 1;
    c.gate=()=>gate; c.start();
    advance(.1+.95-c.startTime); c.update(false);
    expect(notes).toHaveLength(0);
    advance(.2); c.update(false); expect(c.waiting).toBe(1);
    advance(5); c.update(false); expect(notes).toHaveLength(0);
    gate=undefined; c.update(false);
    expect(notes.map(n=>n.midi)).toEqual([48]);
  });
  it("keeps calibration in real milliseconds at every practice speed", () => {
    for (const speed of [.5,.75,1]) {
      const {bank,advance}=fakeBank();
      const options={speed,practice:true,offsetMs:0,approach:1};
      const a=new Conductor(bank,chart([note(0,1)]),options);
      const b=new Conductor(bank,chart([note(0,1)]),{...options,offsetMs:100});
      expect((a.time()-b.time())/speed).toBeCloseTo(.1);
      a.start(); b.start(); advance(1);
      expect((a.time()-b.time())/speed).toBeCloseTo(.1,2);
      a.pause(); b.pause();
      expect((a.time()-b.time())/speed).toBeCloseTo(.1,2);
    }
  });
  it("starts early enough for the first note to travel the road", () => {
    const { bank } = fakeBank();
    const c = new Conductor(bank, chart([note(0, 1)]), { speed: 1, practice: false, offsetMs: 0, approach: 2 });
    expect(c.startTime).toBeLessThanOrEqual(1 - 2);
  });

  it("follows the audio clock, applies the offset and schedules ahead", () => {
    const { bank, notes, advance } = fakeBank();
    const c = new Conductor(bank, chart([note(0, 1)]), { speed: 1, practice: false, offsetMs: 20, approach: 1.5 });
    c.start();
    advance(0.1 + (0.5 - c.startTime) - 0.1); // song time 0.4
    c.update(false);
    expect(c.time()).toBeCloseTo(0.4 - 0.02, 2);
    expect(notes.map((n) => n.midi)).toEqual([48]); // 0.5 is inside the 150 ms lookahead
    advance(1.6);
    c.update(false);
    expect(notes.map((n) => n.midi)).toEqual([48, 50]);
  });

  it("clips accompaniment at the stage end and finishes once the judge is done", () => {
    const { bank, notes, advance } = fakeBank();
    const c = new Conductor(bank, chart([note(0, 1)]), { speed: 1, practice: false, offsetMs: 0, approach: 1.5 });
    c.start();
    for (let i = 0; i < 80; i++) {
      advance(0.1);
      c.update(true);
    }
    const long = notes.find((n) => n.midi === 52)!;
    expect(long.duration).toBeLessThanOrEqual(4 + 1.6 - 3 + 1e-9);
    expect(c.state).toBe("ended");
  });

  it("waits at each note in practice mode until the judge clears it", () => {
    const { bank, notes, advance } = fakeBank();
    const ch = chart([note(0, 1), note(1, 2.5, 1)]);
    const judge = new Judge(ch, { practice: true });
    const c = new Conductor(bank, ch, { speed: 1, practice: true, offsetMs: 0, approach: 1 });
    c.gate = () => judge.gate()?.time;
    c.start();
    for (let i = 0; i < 60; i++) {
      advance(0.1);
      c.update(false);
    }
    expect(c.waiting).toBe(1);
    expect(c.time()).toBeCloseTo(1, 5);
    expect(notes.some((n) => n.midi === 50)).toBe(false); // nothing past the gate
    judge.press(0, c.time());
    c.update(false);
    expect(c.waiting).toBeUndefined();
    for (let i = 0; i < 12; i++) {
      advance(0.1);
      c.update(false);
    }
    expect(c.time()).toBeGreaterThan(2);
    for (let i = 0; i < 20; i++) {
      advance(0.1);
      c.update(false);
    }
    expect(c.waiting).toBe(2.5);
    expect(notes.some((n) => n.midi === 50)).toBe(true);
  });

  it("never fires a backlog of accompaniment after a stall", () => {
    const { bank, notes, advance } = fakeBank();
    const c = new Conductor(bank, chart([note(0, 3.5)]), { speed: 1, practice: false, offsetMs: 0, approach: 1 });
    c.start();
    advance(0.2);
    c.update(false);
    advance(3); // the tab stalled for three seconds
    c.update(false);
    expect(notes.filter((n) => n.midi === 48 || n.midi === 50)).toHaveLength(0);
  });

  it("keeps the clock at the end once the stage ends", () => {
    const { bank, advance } = fakeBank();
    const c = new Conductor(bank, chart([note(0, 1)]), { speed: 1, practice: false, offsetMs: 0, approach: 1 });
    c.start();
    for (let i = 0; i < 90; i++) {
      advance(0.1);
      c.update(true);
    }
    expect(c.state).toBe("ended");
    expect(c.time()).toBeGreaterThan(4);
  });

  it("keep-the-song mode plays the melody itself and hits add no second copy", () => {
    const { bank, notes, advance } = fakeBank();
    const melody = [note(0, 1), note(1, 1.5, 1)];
    const c = new Conductor(bank, chart(melody), { speed: 1, practice: false, offsetMs: 0, approach: 1, auto: melody, keepMelody: true });
    c.start();
    for (let i = 0; i < 30; i++) {
      advance(0.1);
      c.update(false);
    }
    expect(notes.filter((n) => n.midi === 60 || n.midi === 61)).toHaveLength(2);
    c.hit(melody[0]);
    expect(notes.filter((n) => n.midi === 60)).toHaveLength(1);
  });

  it("rewinds a little on resume", () => {
    const { bank, advance } = fakeBank();
    const c = new Conductor(bank, chart([note(0, 3)]), { speed: 1, practice: false, offsetMs: 0, approach: 1 });
    c.start();
    advance(4);
    c.update(false);
    const before = c.time();
    c.pause();
    advance(10);
    expect(c.time()).toBeCloseTo(before, 2);
    c.resume(2);
    expect(c.time()).toBeCloseTo(before - 2 - 0.1, 1); // resume schedules 100 ms ahead
  });
});

for (const latency of [0.08, 0.18, 0.25]) {
  for (const speed of [0.5, 1]) {
    it(`schedules ahead with ${latency * 1000}ms output latency at speed ${speed}`, () => {
      const { bank, notes, advance } = fakeBank(latency);
      const melody = [note(0, 1), note(1, 1.5, 1)];
      const ch = chart(melody);
      const c = new Conductor(bank, ch, { speed, practice: false, offsetMs: 75, approach: 1, auto: melody, keepMelody: true });
      c.start();
      advance(0.1 + (0.5 - c.startTime) / speed - 0.1);
      c.update(false);
      expect(notes).toHaveLength(1);
      expect(notes[0].at - bank.now).toBeCloseTo(0.1, 6);
      // Walk the rest of the song. Even a slow output device must not drop notes.
      for (let i = 0; i < 600; i++) { advance(1 / 60); c.update(false); }
      expect(notes).toHaveLength(ch.accompaniment.length + melody.length);
      const scheduled = [...ch.accompaniment, ...melody].sort((a, b) => a.time - b.time);
      notes.forEach((n, i) => expect(n.at).toBeCloseTo(0.1 + (scheduled[i].time - c.startTime) / speed, 6));
    });
  }
}

it("keeps the visual clock behind processing time on a delayed output", () => {
  const { bank, advance } = fakeBank(0.25);
  const c = new Conductor(bank, chart([note(0, 1)]), { speed: 1, practice: false, offsetMs: 50, approach: 1 });
  c.start();
  advance(1);
  expect(c.time()).toBeCloseTo(c.startTime + 1 - 0.1 - 0.25 - 0.05, 6);
});

it("retains practice gates on delayed audio and sounds the cleared melody", () => {
  const { bank, notes, advance } = fakeBank(0.25);
  const melody = [note(0, 1), note(1, 2.5, 1)];
  const c = new Conductor(bank, chart(melody), { speed: 1, practice: true, offsetMs: 0, approach: 1, auto: melody, keepMelody: true });
  let gate: number | undefined = 1;
  c.gate = () => gate;
  c.start();
  for (let i = 0; i < 360; i++) { advance(1 / 60); c.update(false); }
  expect(c.waiting).toBe(1);
  expect(notes.map(n => n.midi)).toEqual([48]);
  gate = 2.5;
  c.update(false);
  expect(c.waiting).toBeUndefined();
  expect(notes.at(-1)?.midi).toBe(60);
  expect(notes.at(-1)!.at - bank.now).toBeCloseTo(0.02, 6);
});
