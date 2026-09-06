// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  computerNote,
  mountComputerKeyboard,
  pcOffsets,
  computerLayout,
} from "./computer-keyboard";
import type { Player } from "./audio";
describe("computer keyboard", () => {
  it("adds distinct lower and upper keys for three and four rows", () => {
    expect(computerLayout(2).rows).toHaveLength(2);
    expect(computerLayout(3).rows).toHaveLength(3);
    expect(computerLayout(4).rows).toHaveLength(4);
    expect(computerNote("KeyZ", 4, 2)).toBeUndefined();
    expect(computerNote("KeyZ", 4, 3)).toBe(50);
    expect(computerNote("Digit1", 4, 3)).toBeUndefined();
    expect(computerNote("Digit1", 4, 4)).toBe(77);
    expect(computerNote("Digit0", 6, 4)).toBeUndefined();
    for (const rows of [2, 3, 4]) {
      const offsets = Object.values(computerLayout(rows).offsets);
      expect(new Set(offsets).size).toBe(offsets.length);
      expect(computerNote("KeyA", 4, rows)).toBe(60);
    }
  });
  it("maps every semitone once and keeps all octave choices in piano range", () => {
    expect(Object.values(pcOffsets).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 17 }, (_, i) => i),
    );
    expect(computerNote("KeyA", 4)).toBe(60);
    expect(computerNote("KeyW", 4)).toBe(61);
    expect(computerNote("KeyQ", 4)).toBeUndefined();
    expect(computerNote("Semicolon", 6)).toBe(100);
    expect(computerNote("KeyA", 2)).toBe(36);
    expect(computerNote("toString", 4)).toBeUndefined();
    expect(computerNote("KeyA", NaN)).toBeUndefined();
    expect(computerNote("KeyA", 8)).toBeUndefined();
  });
  it("handles chords, releases on keyup and cancels notes released before audio initializes", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    document.body.innerHTML =
      '<div id="computer-keys"></div><select id="computer-octave"><option value="4">4</option></select><select id="instrument"></select><div id="keyboard"></div><div id="status"></div>';
    let ready!: () => void;
    const stop = vi.fn();
    const player = {
      onSilence: new Set<() => void>(),
      init: vi.fn(
        () =>
          new Promise<void>((r) => {
            ready = r;
          }),
      ),
      hold: vi.fn((_midi: number) => stop),
    };
    mountComputerKeyboard(player as unknown as Player);
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "KeyA",
        bubbles: true,
        cancelable: true,
      }),
    );
    document.body.dispatchEvent(
      new KeyboardEvent("keyup", { code: "KeyA", bubbles: true }),
    );
    ready();
    await Promise.resolve();
    expect(player.hold).not.toHaveBeenCalled();
    player.init.mockResolvedValue();
    for (const code of ["KeyA", "KeyD"])
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true }),
      );
    await Promise.resolve();
    expect(player.hold.mock.calls.map((c) => c[0])).toEqual([60, 64]);
    document.body.dispatchEvent(
      new KeyboardEvent("keyup", { code: "KeyA", bubbles: true }),
    );
    expect(stop).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("blur"));
    expect(stop).toHaveBeenCalledTimes(2);
    // An old rejection must not release a newer press of the same key.
    let rejectOld!: (error: Error) => void;
    player.init.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          rejectOld = reject;
        }),
    );
    const down = () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          code: "KeyA",
          bubbles: true,
          cancelable: true,
        }),
      );
    const up = () =>
      document.body.dispatchEvent(
        new KeyboardEvent("keyup", { code: "KeyA", bubbles: true }),
      );
    down();
    up();
    down();
    await Promise.resolve();
    const releases = stop.mock.calls.length;
    rejectOld(Error("old request"));
    await Promise.resolve();
    expect(stop).toHaveBeenCalledTimes(releases);
    for (const silence of player.onSilence) silence();
    expect(stop).toHaveBeenCalledTimes(releases + 1);
    // A transport cancellation also invalidates keys still awaiting audio.
    player.init.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          ready = r;
        }),
    );
    const starts = player.hold.mock.calls.length;
    down();
    for (const silence of player.onSilence) silence();
    ready();
    await Promise.resolve();
    expect(player.hold).toHaveBeenCalledTimes(starts);
    // Events from non-elements must be harmless.
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
  });
});
