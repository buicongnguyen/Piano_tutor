// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { mountCrystalEffects } from "./crystal-effects";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("bursts once per press, expires particles and clears when disabled", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
  }));
  document.body.innerHTML =
    '<select id="note-effect"><option value="crystal">Crystal</option><option value="none">None</option></select><div id="keyboard"><button class="pressed"></button></div>';
  const key = document.querySelector("button")!;
  key.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 20, height: 80 }) as DOMRect;
  const update = mountCrystalEffects();
  update();
  update();
  expect(document.querySelectorAll(".note-crystal")).toHaveLength(4);
  vi.advanceTimersByTime(1000);
  expect(document.querySelectorAll(".note-crystal")).toHaveLength(0);
  key.className = "";
  update();
  key.className = "pressed";
  update();
  expect(document.querySelectorAll(".note-crystal")).toHaveLength(4);
  const select = document.querySelector("select")!;
  select.value = "none";
  select.dispatchEvent(new Event("change"));
  update();
  expect(document.querySelectorAll(".note-crystal")).toHaveLength(0);
});
it("suppresses bursts for reduced motion", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
  }));
  document.body.innerHTML =
    '<select id="note-effect"><option value="crystal">Crystal</option></select><div id="keyboard"><button class="pressed"></button></div>';
  mountCrystalEffects()();
  expect(document.querySelectorAll(".note-crystal")).toHaveLength(0);
});
