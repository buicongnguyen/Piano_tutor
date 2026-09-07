// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { mountGeneratedSheet } from "./generated-sheet";
import { finish } from "./music";
vi.mock("opensheetmusicdisplay", () => ({ OpenSheetMusicDisplay: vi.fn() }));

describe("generated sheet lifecycle", () => {
  it("defers engraving while hidden and renders when shown without touching playback", async () => {
    let ready!: () => void;
    const pending = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const render = vi.fn();
    vi.mocked(OpenSheetMusicDisplay).mockImplementation(
      () =>
        ({ load: () => pending, render }) as unknown as OpenSheetMusicDisplay,
    );
    const root = document.createElement("div");
    document.body.replaceChildren(root);
    const rects = vi
      .spyOn(root, "getClientRects")
      .mockReturnValue([] as unknown as DOMRectList);
    const piece = finish({
      id: "test",
      title: "Test",
      composer: "Test",
      notes: [{ midi: 60, time: 0, duration: 1, velocity: 0.7 }],
    });
    const redraw = mountGeneratedSheet(root, piece);
    ready();
    await pending;
    expect(render).not.toHaveBeenCalled();
    rects.mockReturnValue([{}] as unknown as DOMRectList);
    redraw();
    expect(render).toHaveBeenCalledOnce();
    root.remove();
    redraw();
    expect(render).toHaveBeenCalledOnce();
  });
  it("ignores obsolete page loads when the user quickly changes pages", async () => {
    const ready: (() => void)[] = [];
    const renders: ReturnType<typeof vi.fn>[] = [];
    vi.mocked(OpenSheetMusicDisplay).mockImplementation(() => {
      const render = vi.fn();
      renders.push(render);
      return {
        load: () => new Promise<void>((resolve) => ready.push(resolve)),
        render,
      } as unknown as OpenSheetMusicDisplay;
    });
    const root = document.createElement("div");
    document.body.replaceChildren(root);
    vi.spyOn(root, "getClientRects").mockReturnValue([
      {},
    ] as unknown as DOMRectList);
    mountGeneratedSheet(
      root,
      finish({
        id: "long",
        title: "Long",
        composer: "Test",
        notes: [{ midi: 60, time: 35, duration: 1, velocity: 1 }],
      }),
    );
    root.querySelectorAll<HTMLButtonElement>("button")[1].click();
    ready[1]();
    await Promise.resolve();
    ready[0]();
    await Promise.resolve();
    expect(renders[0]).not.toHaveBeenCalled();
    expect(renders[1]).toHaveBeenCalledOnce();
    expect(root.textContent).toContain("Page 2 / 2");
  });
});
