// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mountStudioStage, stageMode } from "./studio-stage";
beforeEach(() => {
  document.body.innerHTML = '<div id="scene"></div><div id="controls"></div>';
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
  }));
});
describe("Blender scenery", () => {
  it("defaults to calm on constrained screens and validates saved preferences", () => {
    expect(stageMode(null, true)).toBe("calm");
    expect(stageMode("invalid", false)).toBe("cinematic");
    expect(stageMode("off", false)).toBe("off");
  });
  it("offers a responsive image and preserves the fallback on error", () => {
    const scene = document.querySelector<HTMLElement>("#scene")!;
    mountStudioStage(scene, document.querySelector("#controls")!);
    const img = scene.querySelector("img")!;
    expect(img.alt).toBe("");
    expect(scene.querySelector("source")!.srcset).toContain("mobile.png");
    img.dispatchEvent(new Event("load"));
    expect(scene.classList.contains("art-loaded")).toBe(true);
    img.dispatchEvent(new Event("error"));
    expect(scene.classList.contains("art-loaded")).toBe(false);
    const select = document.querySelector<HTMLSelectElement>("#stage-mode")!;
    select.value = "off";
    select.dispatchEvent(new Event("change"));
    expect(scene.dataset.stage).toBe("off");
    expect(scene.querySelector("picture")!.hidden).toBe(true);
  });
  it("respects reduced motion even when cinematic was saved", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "cinematic",
      setItem: vi.fn(),
    });
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
    }));
    const scene = document.querySelector<HTMLElement>("#scene")!;
    const stage = mountStudioStage(scene, document.querySelector("#controls")!);
    stage.pulse(true);
    expect(scene.dataset.stage).toBe("calm");
    expect(scene.classList.contains("stage-complete")).toBe(false);
  });
  it("ships both Blender renders within the image budgets", () => {
    for (const [file, width, limit] of [
      ["moonlit-piano.png", 1600, 1000000],
      ["moonlit-piano-mobile.png", 800, 350000],
    ] as const) {
      const bytes = readFileSync("public/art/" + file);
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.readUInt32BE(16)).toBe(width);
      expect(bytes.length).toBeLessThan(limit);
    }
  });
});
