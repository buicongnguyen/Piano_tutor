import { afterEach, describe, it, expect, vi } from "vitest";
import { SplendidGrandPiano, Soundfont } from "smplr";
import { Player, performanceVelocity } from "./audio";
import { finish } from "./music";
vi.mock("smplr", () => ({ SplendidGrandPiano: vi.fn(), Soundfont: vi.fn() }));
afterEach(() => vi.useRealTimers());
describe("sampled piano mixing and scheduling", () => {
  it("notifies manual-key input before silencing playback", () => {
    const player = new Player();
    const cleanup = vi.fn();
    player.onSilence.add(cleanup);
    player.pause();
    expect(cleanup).toHaveBeenCalledOnce();
    player.seek(0);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
  it("keeps the newest instrument when older samples finish loading later", async () => {
    vi.useFakeTimers();
    let finishGuitar!: () => void;
    const guitarStart = vi.fn(() => vi.fn()),
      fluteStart = vi.fn(() => vi.fn());
    vi.mocked(Soundfont).mockImplementation(
      (_ctx, options) =>
        ({
          ready:
            options?.instrument === "acoustic_guitar_nylon"
              ? new Promise<void>((resolve) => {
                  finishGuitar = resolve;
                })
              : Promise.resolve(),
          start:
            options?.instrument === "acoustic_guitar_nylon"
              ? guitarStart
              : fluteStart,
          stop: vi.fn(),
        }) as unknown as ReturnType<typeof Soundfont>,
    );
    const player = new Player();
    player.init = async () => {
      player.context = { currentTime: 0 } as AudioContext;
      player.gain = {} as GainNode;
    };
    player.position = 1.25;
    const guitar = player.setInstrument("guitar");
    await Promise.resolve();
    await player.setInstrument("flute");
    finishGuitar();
    await guitar;
    player.tone(60, 0.5);
    expect(fluteStart).toHaveBeenCalledOnce();
    expect(guitarStart).not.toHaveBeenCalled();
    expect(player.instrument).toBe("flute");
    expect(player.position).toBe(1.25);
    expect(player.playing).toBe(false);
    await player.setInstrument("guitar");
    player.tone(60, 0.5);
    expect(guitarStart).toHaveBeenCalledOnce();
    expect(Soundfont).toHaveBeenCalledTimes(2);
  });
  it("ignores invalid transport values without corrupting playback state", () => {
    const player = new Player();
    player.position = 0.5;
    for (const value of [0, -1, NaN, Infinity]) player.setSpeed(value);
    expect(player.speed).toBe(1);
    for (const value of [NaN, Infinity, -Infinity]) player.seek(value);
    expect(player.position).toBe(0.5);
  });
  it("scales exact sound lengths at different speeds and clips seek/loop boundaries", async () => {
    vi.useFakeTimers();
    const start = vi.fn(() => vi.fn());
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
        id: "lengths",
        title: "Lengths",
        composer: "Test",
        notes: [
          {
            midi: 60,
            time: 0,
            duration: 0.5,
            soundingDuration: 2,
            velocity: 0.7,
          },
          { midi: 64, time: 0, duration: 1, velocity: 0.7 },
        ],
      }),
    );
    player.speed = 2;
    await player.play();
    expect(
      start.mock.calls.map(
        (args) => (args as unknown as [{ duration: number }])[0].duration,
      ),
    ).toEqual([1, 0.5]);
    expect(SplendidGrandPiano).toHaveBeenCalledWith(
      player.context,
      expect.objectContaining({ decayTime: 0.12 }),
    );
    player.pause();
    start.mockClear();
    player.position = 0.75;
    player.loop = true;
    player.a = 0;
    player.b = 1.5;
    await player.play();
    expect(
      start.mock.calls.map(
        (args) => (args as unknown as [{ duration: number }])[0].duration,
      ),
    ).toEqual([0.375, 0.125]);
    player.pause();
  });
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
