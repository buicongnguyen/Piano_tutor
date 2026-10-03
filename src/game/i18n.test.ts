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

it("keeps dollar signs in untranslated text literally (song titles)", () => {
  expect(t("Cash $$ Money", "vi")).toBe("Cash $$ Money");
  expect(t("  Rock $& Roll ", "vi")).toBe("  Rock $& Roll ");
  expect(t("♪ 12 stillnotes freed", "vi")).toBe("♪ Đã giải phóng 12 nốt nhạc");
});

it("translates the new judge and record labels", () => {
  expect(t("✗ WRONG KEY", "vi")).toBe("✗ SAI PHÍM");
  expect(t("Top rank S+", "vi")).toBe("Hạng cao nhất S+");
  expect(t("ENTER", "vi")).toBe("ENTER");
  expect(t("⌨️ 31 WPM · song pace 40 WPM · 9 of 12 words typed perfectly", "vi")).toBe(
    "⌨️ 31 từ/phút · nhịp bài 40 từ/phút · Gõ đúng 9 trong 12 từ",
  );
});

it("translates hit streaks and milestone celebrations", () => {
  expect(t("HIT STREAK", "vi")).toBe("LIÊN TIẾP");
  expect(t("ON FIRE!", "vi")).toBe("BÙNG CHÁY!");
  expect(t("25 IN A ROW!", "vi")).toBe("25 NỐT LIÊN TIẾP!");
});
