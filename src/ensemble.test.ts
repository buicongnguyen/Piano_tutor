import { afterEach, describe, expect, it, vi } from "vitest";
import { SplendidGrandPiano, Soundfont } from "smplr";
import { Player } from "./audio";
import { finish, parseMidi } from "./music";
import { readFileSync } from "node:fs";
vi.mock("smplr", () => ({ SplendidGrandPiano: vi.fn(), Soundfont: vi.fn() }));
afterEach(() => vi.useRealTimers());
function setup(failCello = false, pending?: Promise<void>) {
  vi.useFakeTimers();
  const piano = vi.fn(() => vi.fn()),
    violin = vi.fn(() => vi.fn()),
    cello = vi.fn(() => vi.fn());
  vi.mocked(SplendidGrandPiano).mockReturnValue({
    ready: Promise.resolve(),
    start: piano,
    stop: vi.fn(),
  } as unknown as ReturnType<typeof SplendidGrandPiano>);
  vi.mocked(Soundfont).mockImplementation(
    (_ctx, options) =>
      ({
        ready:
          options?.instrument === "cello" && failCello
            ? Promise.reject(Error("Unavailable"))
            : (pending ?? Promise.resolve()),
        start: options?.instrument === "violin" ? violin : cello,
        stop: vi.fn(),
      }) as unknown as ReturnType<typeof Soundfont>,
  );
  const player = new Player();
  player.init = async () => {
    player.context = { currentTime: 10 } as AudioContext;
    player.gain = {} as GainNode;
  };
  player.load(
    finish({
      id: "ensemble",
      title: "Ensemble",
      composer: "Test",
      notes: [
        { midi: 72, time: 0, duration: 1, velocity: 0.8, program: 40 },
        { midi: 48, time: 0, duration: 2, velocity: 0.4, program: 42 },
      ],
    }),
  );
  return { player, piano, violin, cello };
}
describe("original MIDI instruments", () => {
  it("retains violin, viola and cello programs in the Four Seasons importer", () => {
    const piece = parseMidi(
      Uint8Array.from(readFileSync("public/music/spring-1.mid")).buffer,
      "Spring",
    );
    expect([...new Set(piece.notes.map((n) => n.program))].sort()).toEqual([
      40, 41, 42,
    ]);
  });
  it("routes simultaneous voices independently while preserving durations and manual sound", async () => {
    const { player, piano, violin, cello } = setup();
    await player.play();
    expect(violin).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 72,
        time: 10,
        duration: 1,
        velocity: 102,
      }),
    );
    expect(cello).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 48,
        time: 10,
        duration: 2,
        velocity: 51,
      }),
    );
    expect(piano).not.toHaveBeenCalled();
    player.hold(60);
    expect(piano).toHaveBeenCalledOnce();
    player.setOriginalInstruments(false);
    expect(player.playing).toBe(false);
    piano.mockClear();
    await player.play();
    expect(piano).toHaveBeenCalledTimes(2);
    player.pause();
  });
  it("reports missing voices and falls back without dropping their notes", async () => {
    const { player, piano, violin, cello } = setup(true);
    await player.play();
    expect(violin).toHaveBeenCalledOnce();
    expect(cello).not.toHaveBeenCalled();
    expect(piano).toHaveBeenCalledWith(
      expect.objectContaining({ note: 48, duration: 2 }),
    );
    expect(player.ensembleStatus).toContain(
      "1 use the selected sound as fallback",
    );
    player.pause();
  });
  it("does not restart playback or publish stale state after cancelling a load", async () => {
    let ready!: () => void;
    const pending = new Promise<void>((r) => {
      ready = r;
    });
    const { player, violin, cello } = setup(false, pending);
    const playing = player.play();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    player.setOriginalInstruments(false);
    ready();
    await playing;
    expect(player.playing).toBe(false);
    expect(player.ensembleStatus).toBe("");
    expect(violin).not.toHaveBeenCalled();
    expect(cello).not.toHaveBeenCalled();
  });
});
