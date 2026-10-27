import { expect, it } from "vitest";
import { BufferAttribute } from "three";
import { uploadChangedPrefix, uploadPrefix } from "./upload";

it("preserves pending ranges when a culled live prefix shrinks", () => {
  const a = new BufferAttribute(new Float32Array(30), 3);
  uploadPrefix(a, 10);
  uploadPrefix(a, 2);
  expect(a.updateRanges).toEqual([{ start: 0, count: 30 }]);
  for (let i = 0; i < 100; i++) uploadPrefix(a, 1);
  expect(a.updateRanges).toHaveLength(1);
});
it("skips identical Float32 contents, uploads changed slots and handles growth/reuse", () => {
  const a = new BufferAttribute(new Float32Array(12), 3);
  a.setXYZ(0, Math.PI, 2, 3);
  uploadChangedPrefix(a, 1);
  a.clearUpdateRanges();
  const version = a.version;
  a.setXYZ(0, Math.PI, 2, 3);
  uploadChangedPrefix(a, 1);
  expect(a.version).toBe(version);
  a.setXYZ(3, 4, 5, 6);
  uploadChangedPrefix(a, 4);
  a.setX(0, 9);
  uploadChangedPrefix(a, 1);
  expect(a.updateRanges).toEqual([{ start: 0, count: 12 }]);
  a.clearUpdateRanges();
  uploadChangedPrefix(a, 0);
  uploadChangedPrefix(a, 4);
  expect(a.updateRanges).toEqual([]);
  a.setXYZ(0, 4, 5, 6);
  uploadChangedPrefix(a, 3);
  expect(a.updateRanges.length).toBe(1);
  a.array = new Float32Array(24);
  uploadChangedPrefix(a, 8);
  expect(a.updateRanges).toEqual([{ start: 0, count: 24 }]);
});
