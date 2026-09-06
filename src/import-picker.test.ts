// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { openScorePicker } from "./import-picker";
describe("native score picker", () => {
  it("opens immediately and clears the previous selection for re-import", () => {
    const input = {
      value: "old.mid",
      showPicker: vi.fn(),
      click: vi.fn(),
    } as unknown as HTMLInputElement;
    openScorePicker(input);
    expect(input.showPicker).toHaveBeenCalledOnce();
    expect(input.value).toBe("");
    expect(input.click).not.toHaveBeenCalled();
    input.value = "old.mid";
    openScorePicker(input);
    expect(input.value).toBe("");
    expect(input.showPicker).toHaveBeenCalledTimes(2);
  });
  it("uses a native input click when showPicker is missing or blocked", () => {
    const input = { value: "", click: vi.fn() } as unknown as HTMLInputElement;
    openScorePicker(input);
    expect(input.click).toHaveBeenCalledOnce();
    input.showPicker = () => {
      throw new DOMException("Not supported");
    };
    openScorePicker(input);
    expect(input.click).toHaveBeenCalledTimes(2);
  });
});
