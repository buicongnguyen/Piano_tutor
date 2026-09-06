import { afterEach, describe, it, expect, vi } from "vitest";
import { SplendidGrandPiano } from "smplr";
import { Player, performanceVelocity } from "./audio";
import { finish } from "./music";
vi.mock("smplr", () => ({ SplendidGrandPiano: vi.fn() }));
afterEach(() => vi.useRealTimers());
describe("sampled piano mixing and scheduling", () => {
  it("preserves expressive differences and original data while balancing hands", () => {
    const quiet = {
      midi: 72,
      time: 0,
      duration: 1,
      velocity: 0.4,
      hand: "left" as const,
    };
    const loud = { ...quiet, velocity: 0.8 };
    expect(performanceVelocity(quiet, { left: 0.75, right: 1 })).toBeCloseTo(
      0.3,
    );
    expect(performanceVelocity(loud, { left: 0.75, right: 1 })).toBeCloseTo(
      0.6,
    );
    expect(performanceVelocity(quiet, { left: 1, right: 1 })).toBe(0.4);
    expect(
      performanceVelocity({ ...quiet, hand: undefined }, { left: 0, right: 0 }),
    ).toBe(0.4);
    expect(
      performanceVelocity({ ...loud, velocity: 1 }, { left: 1.25, right: 1 }),
    ).toBe(1);
    expect(performanceVelocity(quiet, { left: 0, right: 1 })).toBe(0);
    expect(quiet.velocity).toBe(0.4);
  });
  it("uses a shared onset for chords, retains strength, and cancels queued samples", async () => {
    vi.useFakeTimers();
    const cancellations: ReturnType<typeof vi.fn>[] = [];
    const start = vi.fn(() => {
      const stop = vi.fn();
      cancellations.push(stop);
      return stop;
    });
    vi.mocked(SplendidGrandPiano).mockReturnValue({
      ready: Promise.resolve(),
      start,
      stop: vi.fn(),
    } as unknown as ReturnType<typeof SplendidGrandPiano>);
    const player = new Player();
    player.init = async () => {
      player.context = { currentTime: 10 } as AudioContext;
      player.gain = {} as GainNode;
    };
    player.load(
      finish({
        id: "mix",
        title: "Chord",
        composer: "Test",
        notes: [
          { midi: 48, time: 0, duration: 2, velocity: 0.4, hand: "left" },
          { midi: 64, time: 0, duration: 1, velocity: 0.8 },
          { midi: 67, time: 0.05, duration: 0.5, velocity: 0.6 },
        ],
      }),
    );
    await player.play();
    expect(player.soundState).toBe("grand");
    expect(start).toHaveBeenCalledTimes(3);
    const events = start.mock.calls as unknown as [
      { time: number; velocity: number; duration: number; stopId: number },
    ][];
    expect(events.map(([e]) => e.time)).toEqual([10, 10, 10.05]);
    expect(events.map(([e]) => e.velocity)).toEqual([38, 102, 76]);
    expect(events.map(([e]) => e.duration)).toEqual([2, 1, 0.5]);
    expect(new Set(events.map(([e]) => e.stopId)).size).toBe(3);
    player.pause();
    for (const stop of cancellations) expect(stop).toHaveBeenCalledOnce();
  });
});
