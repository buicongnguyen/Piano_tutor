import { describe, expect, it } from "vitest";
import { ShoalSim, steer, turn } from "./shoal-sim";

const DT = 1 / 60;
const make = (seed = 7, count = 36) => new ShoalSim({ count, species: 2, roadHalf: 6, seed, sea: -3.14 });
const run = (sim: ShoalSim, seconds: number, flow = 3, harmony = 1) => {
  for (let i = 0; i < seconds / DT; i++) sim.update(DT, flow, harmony);
};

describe("fish schools", () => {
  it("turns the short way round, by at most the given share", () => {
    expect(turn(0.1, -0.1, 1)).toBeCloseTo(-0.1);
    expect(turn(3, -3, 1)).toBeCloseTo(3 + (2 * Math.PI - 6));
    expect(turn(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(turn(0, 1, -1)).toBe(0);
    // steer also caps the turn speed.
    expect(steer(0, Math.PI - 0.01, 1, 4, 0.1)).toBeCloseTo(0.4);
    expect(steer(0, -0.1, 1, 4, 0.1)).toBeCloseTo(-0.1);
  });

  it("swims smoothly beside the road and stays in the scrolling sea", () => {
    const sim = make();
    run(sim, 2);
    const span = sim.near - sim.far;
    for (let i = 0; i < 60 * 40; i++) {
      const before = sim.fish.map((f) => ({ x: f.x, z: f.z, h: f.heading }));
      sim.update(DT, 3, 1);
      sim.fish.forEach((f, k) => {
        const b = before[k];
        const dz = f.z - b.z;
        const wrapped = Math.abs(Math.abs(dz) - span) < 10;
        if (!wrapped) {
          // No teleports: one frame moves a fish a few centimetres, never metres.
          expect(Math.hypot(f.x - b.x, dz)).toBeLessThan(0.2);
          // A capped turn rate: curves, not snaps.
          expect(Math.abs(Math.atan2(Math.sin(f.heading - b.h), Math.cos(f.heading - b.h)))).toBeLessThan(0.11);
        }
        expect(Math.abs(f.x)).toBeGreaterThanOrEqual(sim.inner - 1 - 1e-9); // never under the road
        expect(Math.abs(f.x)).toBeLessThan(sim.outer + 5);
        expect(f.z).toBeGreaterThan(sim.far - 12);
        expect(f.z).toBeLessThan(sim.near + 12);
      });
    }
  });

  it("brings fish back as Harmony rises", () => {
    const sim = make(3, 60);
    run(sim, 6, 0, 0);
    const shown = () => sim.fish.filter((f) => f.show > 0.5).length;
    const low = shown();
    expect(low).toBeLessThan(sim.fish.length * 0.5);
    run(sim, 6, 0, 1);
    expect(shown()).toBe(sim.fish.length);
  });

  it("leaps on cue, splashes out and back in, and rests between single leaps", () => {
    const sim = make(11, 60);
    run(sim, 4, 0, 1);
    const splashes: boolean[] = [];
    sim.onSplash = (_x, _z, landing) => splashes.push(landing);
    expect(sim.leap()).toBe(true);
    expect(sim.leap()).toBe(false); // too soon after the last
    const jumper = sim.fish.find((f) => f.leap)!;
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      sim.update(DT, 0, 1);
      peak = Math.max(peak, jumper.y);
    }
    expect(peak).toBeGreaterThan(-3.14 + 1);
    expect(jumper.leap).toBeUndefined();
    expect(jumper.lift).toBeLessThan(0.05);
    expect(splashes).toEqual([false, true]);
  });

  it("sends a school over in a ripple, and scatters fish away from the road on a miss", () => {
    const sim = make(5, 60);
    run(sim, 4, 0, 1);
    const n = sim.wave();
    expect(n).toBeGreaterThan(2);
    run(sim, 0.5, 0, 1);
    expect(sim.fish.filter((f) => f.leap).length).toBeGreaterThan(1);
    run(sim, 2, 0, 1);
    const near = sim.fish.filter((f) => !f.leap && f.z > -60);
    const before = near.map((f) => Math.abs(f.x));
    expect(sim.scatter()).toBe(near.length);
    run(sim, 0.4, 0, 1);
    const outward = near.filter((f, i) => Math.abs(f.x) > before[i]).length;
    expect(outward).toBeGreaterThan(near.length * 0.8);
  });
});
