import { afterEach, expect, it } from "vitest";
import { keyLabel, setKeyboardLayout } from "./keyboard-layout";

afterEach(() => setKeyboardLayout(undefined));

it("labels physical keys as printed on the player's layout, else QWERTY", () => {
  expect(keyLabel("KeyQ", "Q")).toBe("Q");
  setKeyboardLayout(new Map([["KeyQ", "a"], ["KeyA", "q"], ["Semicolon", "m"]]));
  expect(keyLabel("KeyQ", "Q")).toBe("A");
  expect(keyLabel("Semicolon", ";")).toBe("M");
  expect(keyLabel("KeyZ", "Z")).toBe("Z"); // unknown code keeps the fallback
});
