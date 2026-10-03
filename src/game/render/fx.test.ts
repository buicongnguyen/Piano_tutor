import { expect, it } from "vitest";
import { Particles } from "./fx";
import type { BufferAttribute } from "three";

it("submits only active particles, removes expired ones, and uploads only their data", () => {
  const particles = new Particles(3000);
  const geometry = particles.points.geometry;
  expect(geometry.drawRange.count).toBe(0);
  particles.spawn({ x: 1, y: 2, z: 3, max: 0.1 });
  particles.spawn({ x: 4, y: 5, z: 6, max: 1 });
  particles.update(0.05);
  expect(geometry.drawRange.count).toBe(2);
  expect((geometry.attributes.position as BufferAttribute).updateRanges).toEqual([{ start: 0, count: 6 }]);
  particles.update(0.1);
  expect(geometry.drawRange.count).toBe(1);
  expect(geometry.attributes.position.getX(0)).toBe(4);
  particles.clear();
  expect(geometry.drawRange.count).toBe(0);
  const version = (geometry.attributes.position as BufferAttribute).version;
  particles.update(1);
  expect((geometry.attributes.position as BufferAttribute).version).toBe(version);
});

it("reuses full pool slots without duplicating particles or reviving cleared ones", () => {
  const particles = new Particles(2);
  for (const x of [1, 2, 3]) particles.spawn({ x, y: 0, z: 0, max: 1 });
  particles.update(0);
  const geometry = particles.points.geometry;
  expect(geometry.drawRange.count).toBe(2);
  expect([geometry.attributes.position.getX(0), geometry.attributes.position.getX(1)].sort()).toEqual([2, 3]);
  particles.clear();
  particles.spawn({ x: 10, y: 0, z: 0, max: 1 });
  particles.update(0);
  expect(geometry.drawRange.count).toBe(1);
  expect(geometry.attributes.position.getX(0)).toBe(10);
});
