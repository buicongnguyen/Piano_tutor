// @vitest-environment jsdom
import { afterEach, expect, it, vi as mock } from "vitest";
import {
  LANGUAGE_KEY,
  mountLanguage,
  readLanguage,
  t,
  languageControl,
} from "./i18n";
import { STORY } from "./story";
import { viStory } from "./vi-story";
afterEach(() => mock.unstubAllGlobals());
it("validates saved language and falls back when storage is unavailable", () => {
  expect(readLanguage({ getItem: () => "en" }, "vi-VN")).toBe("en");
  expect(
    readLanguage(
      {
        getItem: () => {
          throw Error();
        },
      },
      "vi-VN",
    ),
  ).toBe("vi");
  expect(readLanguage({ getItem: () => "invalid" }, "ko")).toBe("en");
});
it("has a Vietnamese version of every story line", () => {
  for (const [key, lines] of Object.entries(STORY)) {
    expect(viStory[key]).toHaveLength(lines.length);
    for (const line of lines) expect(t(line.text, "vi")).not.toBe(line.text);
  }
});
it("translates dynamic UI and restores English without changing typing targets or values", async () => {
  const data = new Map([[LANGUAGE_KEY, "en"]]);
  mock.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
  document.body.innerHTML =
    languageControl +
    '<button aria-label="Pause">▶ Play</button><div class="hud-words">Play</div><h2 translate="no">Ocean</h2>';
  const stop = mountLanguage(document.body);
  const select = document.querySelector("select")!;
  select.value = "vi";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.documentElement.lang).toBe("vi");
  expect(document.querySelector("button")!.textContent).toBe("▶ Chơi");
  expect(document.querySelector("button")!.getAttribute("aria-label")).toBe(
    "Tạm dừng",
  );
  expect(document.querySelector(".hud-words")!.textContent).toBe("Play");
  expect(document.querySelector("h2")!.textContent).toBe("Ocean");
  document.querySelector("button")!.textContent = "Resume";
  await new Promise((r) => setTimeout(r, 0));
  expect(document.querySelector("button")!.textContent).toBe("Tiếp tục");
  select.value = "en";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(document.querySelector("button")!.textContent).toBe("Resume");
  expect(select.value).toBe("en");
  stop();
});
