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
  it("places a complete octave on eight home fingers with unique chromatic extensions", () => {
    expect(
      ["KeyA", "KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL", "Semicolon"].map(
        (code) => computerNote(code, 4, 2, "home"),
      ),
    ).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(computerNote("KeyG", 4, 2, "home")).toBeUndefined();
    for (const rows of [2, 3, 4]) {
      const values = Object.values(computerLayout(rows, "home").offsets);
      expect(new Set(values).size).toBe(values.length);
    }
  });
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
      '<select id="computer-mapping"><option value="classic">Classic</option><option value="home">Home</option></select><select id="computer-sustain"><option value="off">Off</option><option value="hold">Hold</option><option value="toggle">Toggle</option></select><button id="pc-sustain"></button><button id="pc-release"></button><div id="pc-help"></div><div id="computer-keys"></div><select id="computer-octave"><option value="4">4</option></select><select id="instrument"></select><div id="keyboard"></div><div id="status"></div>';
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
    player.init.mockResolvedValue();
    const pedal =
      document.querySelector<HTMLSelectElement>("#computer-sustain")!;
    const send = (type: string, code: string) =>
      document.body.dispatchEvent(
        new KeyboardEvent(type, { code, bubbles: true, cancelable: true }),
      );
    pedal.value = "hold";
    pedal.dispatchEvent(new Event("change"));
    send("keydown", "Space");
    down();
    await Promise.resolve();
    const beforePedalRelease = stop.mock.calls.length;
    up();
    expect(stop).toHaveBeenCalledTimes(beforePedalRelease);
    expect(
      document.querySelector("#pc-sustain")?.getAttribute("aria-pressed"),
    ).toBe("true");
    send("keyup", "Space");
    expect(stop).toHaveBeenCalledTimes(beforePedalRelease + 1);
    // Toggle sustain lets a low-rollover keyboard build a chord sequentially.
    pedal.value = "toggle";
    pedal.dispatchEvent(new Event("change"));
    send("keydown", "Space");
    send("keyup", "Space");
    down();
    await Promise.resolve();
    up();
    send("keydown", "KeyD");
    await Promise.resolve();
    send("keyup", "KeyD");
    const beforeLift = stop.mock.calls.length;
    send("keydown", "Space");
    send("keyup", "Space");
    expect(stop).toHaveBeenCalledTimes(beforeLift + 2);
    // Re-striking a sustained key cancels its previous voice.
    send("keydown", "Space");
    send("keyup", "Space");
    down();
    await Promise.resolve();
    up();
    const beforeRestrike = stop.mock.calls.length;
    down();
    await Promise.resolve();
    expect(stop).toHaveBeenCalledTimes(beforeRestrike + 1);
    send("keydown", "Escape");
    expect(stop).toHaveBeenCalledTimes(beforeRestrike + 2);
    expect(
      document.querySelector("#pc-sustain")?.getAttribute("aria-pressed"),
    ).toBe("false");
    // Pending sustained audio cannot start after the pedal has been lifted.
    player.init.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          ready = r;
        }),
    );
    send("keydown", "Space");
    send("keyup", "Space");
    const beforePending = player.hold.mock.calls.length;
    down();
    up();
    send("keydown", "Space");
    send("keyup", "Space");
    ready();
    await Promise.resolve();
    expect(player.hold).toHaveBeenCalledTimes(beforePending);
    // Layout switching updates keys and releases existing voices.
    down();
    await Promise.resolve();
    const mapping =
      document.querySelector<HTMLSelectElement>("#computer-mapping")!;
    const beforeSwitch = stop.mock.calls.length;
    mapping.value = "home";
    mapping.dispatchEvent(new Event("change"));
    expect(stop).toHaveBeenCalledTimes(beforeSwitch + 1);
    expect(
      document.querySelector('[aria-label="Computer J: G4"]'),
    ).not.toBeNull();
    expect(document.querySelector("#pc-help")?.textContent).toContain(
      "Home fingers",
    );
    // Events from non-elements must be harmless.
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
  });
});
