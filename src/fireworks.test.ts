import { expect, it } from "vitest";
import { fireworkSpark, fireworkStyles } from "./fireworks";
import { validEffect } from "./waterfall";
it("supports every firework style with bounded depth and trajectories", () => {
  for (const style of fireworkStyles) {
    expect(validEffect(style)).toBe(style);
    for (let i = 0; i < 12; i++) {
      const spark = fireworkSpark(style, i, 12, 60);
      expect(Math.abs(spark.dx)).toBeLessThanOrEqual(62);
      expect(spark.dy).toBeLessThan(0);
      expect(spark.size).toBeGreaterThanOrEqual(7);
      expect(spark.size).toBeLessThanOrEqual(13);
    }
  }
  expect(fireworkSpark("firework-willow", 0, 12, 60).fall).toBe(40);
});
