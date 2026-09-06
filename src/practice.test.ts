import { describe, it, expect, vi } from "vitest";
import { Midi } from "@tonejs/midi";
import { Player } from "./audio";
import { finish, parseMidi } from "./music";
import { hasBothHands, scoreBeats } from "./practice";
const duet = () =>
  finish({
    id: "duet",
    title: "Duet",
    composer: "Test",
    beatToSeconds: (b) => (b < 2 ? b * 0.5 : 1 + (b - 2)),
    notes: [
      { time: 0, duration: 3, midi: 48, velocity: 0.8, hand: "left" },
      { time: 0, duration: 3, midi: 72, velocity: 0.8, hand: "right" },
    ],
  });
function setup() {
  const player = new Player();
  player.init = async () => {
    player.context = { currentTime: 10 } as AudioContext;
  };
  player.loadGrand = async () => {};
  const tone = vi.spyOn(player, "tone").mockImplementation(() => {});
  const click = vi.spyOn(player, "clickBeat").mockImplementation(() => {});
  player.load(duet());
  return { player, tone, click };
}
describe("accompaniment practice", () => {
  it("only plays the opposite hand and pauses cleanly when changing modes", async () => {
    const { player, tone } = setup();
    player.setPracticeHand("right");
    await player.play();
    expect(tone.mock.calls.map((c) => c[0])).toEqual([48]);
    expect(tone.mock.calls[0][2]).toBeCloseTo(0.6);
    player.setPracticeHand("left");
    expect(player.playing).toBe(false);
    tone.mockClear();
    await player.play();
    expect(tone.mock.calls.map((c) => c[0])).toEqual([72]);
    player.pause();
    const unknown = duet();
    unknown.notes[0].hand = undefined;
    player.load(unknown);
    player.setPracticeHand("right");
    expect(hasBothHands(unknown.notes)).toBe(false);
    expect(player.practiceHand).toBeUndefined();
  });
  it("follows tempo changes, scales clicks with speed, and avoids replaying a beat on seek", async () => {
    const { player, click } = setup();
    expect(player.beats).toEqual([0, 0.5, 1, 2]);
    player.setMetronome(true);
    player.setSpeed(2);
    await player.play();
    expect(click.mock.calls).toEqual([[10]]);
    // Simulate the audio clock approaching the next beat.
    Object.assign(player.context!, { currentTime: 10.2 });
    player.tick();
    player.tick();
    expect(click.mock.calls).toEqual([[10], [10.25]]);
    player.pause();
    player.position = 0.51;
    click.mockClear();
    await player.play();
    expect(click).not.toHaveBeenCalled();
    player.pause();
    player.loop = true;
    player.a = 0;
    player.b = 0.5;
    player.position = 0;
    click.mockClear();
    await player.play();
    Object.assign(player.context!, { currentTime: 10.2 });
    player.tick();
    expect(click).toHaveBeenCalledTimes(1);
    player.pause();
  });
  it("extracts the MIDI quarter-note grid including tempo changes and rejects invalid grids", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    midi.header.tempos.push({ ticks: midi.header.ppq * 2, bpm: 60 });
    midi.header.update();
    midi
      .addTrack()
      .addNote({
        midi: 60,
        ticks: 0,
        durationTicks: midi.header.ppq * 4,
        velocity: 0.7,
      });
    const piece = parseMidi(Uint8Array.from(midi.toArray()).buffer, "Tempo");
    expect(scoreBeats(piece)).toEqual([0, 0.5, 1, 2]);
    expect(scoreBeats({ ...piece, beatToSeconds: () => 0 })).toEqual([]);
    expect(scoreBeats({ ...piece, beatToSeconds: undefined })).toEqual([]);
  });
});
