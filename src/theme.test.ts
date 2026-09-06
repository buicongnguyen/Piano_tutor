// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mountTheme, resolveTheme } from "./theme";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("theme preference", () => {
  it("resolves explicit preferences and system fallback", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });
  it("persists changes and follows OS changes only in system mode", () => {
    let change = () => {};
    const media = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => {
        change = fn;
      },
    };
    vi.stubGlobal("matchMedia", () => media);
    document.body.innerHTML =
      "<select><option>system</option><option>light</option><option>dark</option></select>";
    const select = document.querySelector("select")!;
    mountTheme(select);
    media.matches = true;
    change();
    expect(document.documentElement.dataset.theme).toBe("dark");
    select.value = "light";
    select.dispatchEvent(new Event("change"));
    change();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("stillnote-theme")).toBe("light");
    mountTheme(select);
    expect(select.value).toBe("light");
  });
  it("works when browser storage is blocked", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
    }));
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    document.body.innerHTML =
      "<select><option>system</option><option>dark</option></select>";
    const select = document.querySelector("select")!;
    mountTheme(select);
    select.value = "dark";
    select.dispatchEvent(new Event("change"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
