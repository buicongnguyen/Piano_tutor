// @vitest-environment jsdom
import { expect, it } from "vitest";
import { t } from "./game/i18n";
import "./studio-vi";

it("translates classic studio controls and keeps song titles and note names", () => {
  expect(t("Import file", "vi")).toBe("Import file");
  expect(t("＋ Import file", "vi")).toBe("＋ Nhập tệp");
  expect(t("Metronome", "vi")).toBe("Máy đếm nhịp");
  expect(t("Clair de lune", "vi")).toBe("Clair de lune");
  expect(t("Play C♯4", "vi")).toBe("Chơi C♯4");
  expect(t("Page 1 / 2", "vi")).toBe("Trang 1 / 2");
  expect(t("36 ready to play · 6 require a file import", "vi")).toContain(
    "bài sẵn sàng",
  );
});
it("keeps the game's wording and English output", () => {
  expect(t("Metronome", "en")).toBe("Metronome");
  expect(t("🔒 Locked", "en")).toBe("🔒 Locked");
  expect(t("to open it (you have 3).", "vi")).toBe("để mở (bạn đang có 3).");
});
