// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { mountKeyboard } from "./keyboard";
import type { Player } from "./audio";

function setup(init = async () => {}) {
  document.body.innerHTML =
    '<div id="keyboard"></div><button id="range-toggle"></button><button id="labels-toggle"></button><span id="range-label"></span><span id="status"></span>';
  const stop = vi.fn();
  const player = {
    init,
    hold: vi.fn(() => stop),
    onSilence: new Set<() => void>(),
  };
  const keys = mountKeyboard(player as unknown as Player);
  const key = keys.get(60)!;
  const down = (button = key) =>
    button.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  const up = (button = key) =>
    button.dispatchEvent(
      new KeyboardEvent("keyup", {
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  return { player, keys, key, stop, down, up };
}

describe("piano key holds", () => {
  it("releases captured pointer notes on cancellation and ignores the following mouse click", async () => {
    const { key, player, stop } = setup();
    key.setPointerCapture = vi.fn();
    key.dispatchEvent(
      Object.assign(new Event("pointerdown", { cancelable: true }), {
        button: 0,
        pointerId: 7,
      }),
    );
    await Promise.resolve();
    expect(key.setPointerCapture).toHaveBeenCalledWith(7);
    expect(player.hold).toHaveBeenCalledWith(60);
    key.dispatchEvent(new Event("lostpointercapture"));
    key.dispatchEvent(new MouseEvent("click", { detail: 1 }));
    await Promise.resolve();
    expect(stop).toHaveBeenCalledOnce();
    expect(player.hold).toHaveBeenCalledOnce();
  });
  it("holds independent chord notes until release, without retriggering repeats", async () => {
    const { player, keys, key, stop, down, up } = setup();
    down();
    down(keys.get(64)!);
    await Promise.resolve();
    key.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Enter", repeat: true }),
    );
    expect(player.hold.mock.calls).toEqual([[60], [64]]);
    expect(stop).not.toHaveBeenCalled();
    up();
    expect(stop).toHaveBeenCalledOnce();
    expect(key.classList.contains("pressed")).toBe(false);
    expect(keys.get(64)!.classList.contains("pressed")).toBe(true);
    up(keys.get(64)!);
    expect(stop).toHaveBeenCalledTimes(2);
  });
  it("does not start a released or silenced key after audio initialization", async () => {
    let ready!: () => void;
    const pending = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const { player, down, up } = setup(() => pending);
    down();
    up();
    down();
    for (const silence of player.onSilence) silence();
    ready();
    await pending;
    expect(player.hold).not.toHaveBeenCalled();
  });
  it("releases held notes when the keyboard is rebuilt or the window loses focus", async () => {
    const { down, stop, keys } = setup();
    down();
    await Promise.resolve();
    document.querySelector<HTMLButtonElement>("#range-toggle")!.click();
    expect(stop).toHaveBeenCalledOnce();
    down(keys.get(60)!);
    await Promise.resolve();
    window.dispatchEvent(new Event("blur"));
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
