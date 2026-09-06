// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  computerNote,
  mountComputerKeyboard,
  pcOffsets,
} from "./computer-keyboard";
import type { Player } from "./audio";
describe("computer keyboard", () => {
  it("maps every semitone once and keeps all octave choices in piano range", () => {
    expect(Object.values(pcOffsets).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 17 }, (_, i) => i),
    );
    expect(computerNote("KeyA", 4)).toBe(60);
    expect(computerNote("KeyW", 4)).toBe(61);
    expect(computerNote("KeyQ", 4)).toBeUndefined();
    expect(computerNote("Semicolon", 6)).toBe(100);
    expect(computerNote("KeyA", 2)).toBe(36);
  });
  it("handles chords, releases on keyup and cancels notes released before audio initializes", async () => {
    document.body.innerHTML =
      '<div id="computer-keys"></div><select id="computer-octave"><option value="4">4</option></select><select id="instrument"></select><div id="keyboard"></div><div id="status"></div>';
    let ready!: () => void;
    const stop = vi.fn();
    const player = {
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
  });
});
