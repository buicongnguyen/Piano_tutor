import { expect, it } from "vitest";
import { importedStage } from "./songs";
import { emptySave, storeSave } from "./save";
it("keeps different arrangements with the same filename and size separate", () => {
  const piece = {
    id: "same.mid100",
    title: "Same",
    composer: "Test",
    duration: 1,
    notes: [{ midi: 60, time: 0, duration: 1, velocity: 0.8 }],
  };
  expect(importedStage(piece).stage.id).toBe(
    importedStage({ ...piece }).stage.id,
  );
  expect(importedStage(piece).stage.id).not.toBe(
    importedStage({ ...piece, notes: [{ ...piece.notes[0], midi: 64 }] }).stage
      .id,
  );
});
it("does not claim a successful save without storage", () => {
  expect(storeSave(undefined, emptySave())).toBe(false);
});
