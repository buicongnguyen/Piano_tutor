// Fish schools in the sea beside the Piano Road. The idea comes from the Zoo
// Garden pond fish (cute_game): every fish steers toward a goal with a capped
// turn rate, so it swims in smooth curves, and the renderer swings its tail
// with a sine. Here the goals are slots in a school that wanders up and down
// the road, the whole sea scrolls past with the music, and the fish answer the
// player: a Perfect makes one leap, a combo milestone sends a school over in a
// wave, a miss scatters the fish nearby, and they return as Harmony rises.
// Pure logic with no three.js, so it runs in tests; render/shoals.ts draws it
// with one instanced mesh per species.
import { rng } from "./words";

/** Turn `from` toward `to` (radians) by at most `amount` of the remaining angle. */
export const turn = (from: number, to: number, amount: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, Math.max(0, amount));

/** Like `turn`, but never faster than `maxRate` radians per second: a U-turn is a curve, not a snap. */
export function steer(from: number, to: number, share: number, maxRate: number, dt: number) {
  const step = Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, Math.max(0, share));
  return from + Math.max(-maxRate * dt, Math.min(maxRate * dt, step));
}

export type Leap = { t: number; dur: number; fromX: number; fromZ: number; dirX: number; dirZ: number; dist: number; height: number; spin: number };

export type Fish = {
  school: number;
  species: number;
  slotX: number; // place in the school, in the school's frame (x across, z along)
  slotZ: number;
  x: number;
  y: number;
  z: number;
  heading: number; // radians; velocity is (sin, cos) in (x, z), like the model facing +Z
  pitch: number; // nose up is positive
  roll: number;
  speed: number;
  size: number;
  rank: number; // 0..1: fish with a low rank come back first as Harmony rises
  show: number; // 0..1 fade
  phase: number;
  wagRate: number; // tail swings per second, in radians
  wagAmp: number;
  lift: number; // 0 under the surface, 1 in the air (full colour)
  flee: number; // seconds of darting away left
  leap?: Leap;
};

type School = { x: number; z: number; heading: number; speed: number; dir: number; side: number; phase: number };

export type ShoalOptions = {
  count: number; // fish in total
  species: number; // species to share out between schools
  roadHalf: number; // the road's half width: fish swim beside it, not under it
  seed: number;
  sea: number; // water surface height
  near?: number; // z behind the camera where fish wrap to the far end
  far?: number;
};

export const SCHOOL_SIZE = 6;
const LEAP_GAP = 0.45; // seconds between single leaps

export class ShoalSim {
  readonly fish: Fish[] = [];
  readonly inner: number;
  readonly outer: number;
  readonly near: number;
  readonly far: number;
  private schools: School[] = [];
  private random: () => number;
  private clock = 0;
  private lastLeap = -Infinity;
  private queued: { at: number; fish: Fish }[] = [];
  /** Water breaks: where, and whether it's a landing (bigger splash). */
  onSplash?: (x: number, z: number, landing: boolean, species: number) => void;

  constructor(readonly options: ShoalOptions) {
    const random = (this.random = rng(options.seed));
    this.inner = options.roadHalf + 2.2;
    this.outer = options.roadHalf + 16;
    this.near = options.near ?? 24;
    this.far = options.far ?? -150;
    const schools = Math.max(1, Math.round(options.count / SCHOOL_SIZE));
    for (let s = 0; s < schools; s++) {
      const side = s % 2 ? 1 : -1;
      const school: School = {
        x: side * (this.inner + 1 + random() * (this.outer - this.inner - 2)),
        z: this.near - 10 - random() * (this.near - 10 - this.far),
        heading: random() * Math.PI * 2,
        speed: 1.1 + random() * 0.9,
        dir: random() < 0.5 ? 1 : -1,
        side,
        phase: random() * 10,
      };
      this.schools.push(school);
    }
    for (let i = 0; i < options.count; i++) {
      const s = i % schools;
      const school = this.schools[s];
      const slotX = (random() - 0.5) * 2.6;
      const slotZ = -(0.3 + random() * 2.8);
      this.fish.push({
        school: s,
        species: s % Math.max(1, options.species),
        slotX,
        slotZ,
        x: school.x + slotX,
        y: options.sea,
        z: school.z + slotZ,
        heading: school.heading,
        pitch: 0,
        roll: 0,
        speed: school.speed,
        size: 1.5 + random() * 0.7, // metres: big enough to read from the chase camera
        rank: random(),
        show: 0,
        phase: random() * Math.PI * 2,
        wagRate: 9,
        wagAmp: 0.5,
        lift: 0,
        flee: 0,
      });
    }
  }

  /** Advance by `dt` seconds. `flow` is how fast the sea scrolls toward the camera. */
  update(dt: number, flow: number, harmony: number) {
    this.clock += dt;
    const span = this.near - this.far;
    for (const s of this.schools) {
      // Wander up or down the road with a gentle sway; turn back before the edges.
      let want = (s.dir > 0 ? 0 : Math.PI) + Math.sin(this.clock * 0.35 + s.phase) * 0.7;
      const ax = Math.abs(s.x);
      if (ax < this.inner + 1.5) want = Math.atan2(s.side, 0.6 * s.dir);
      else if (ax > this.outer - 1.5) want = Math.atan2(-s.side, 0.6 * s.dir);
      s.heading = turn(s.heading, want, dt * 0.9);
      s.x += Math.sin(s.heading) * s.speed * dt;
      s.z += Math.cos(s.heading) * s.speed * dt + flow * dt;
      s.x = s.side * Math.min(this.outer, Math.max(this.inner, Math.abs(s.x)));
      // Off either end of the sea: the whole school wraps round, out of sight.
      const shift = s.z > this.near ? -span : s.z < this.far ? span : 0;
      if (shift) {
        s.z += shift;
        for (const f of this.fish)
          if (this.schools[f.school] === s && !f.leap) {
            f.z += shift;
            f.show = 0; // fade back in rather than pop
          }
      }
    }
    for (let i = this.queued.length - 1; i >= 0; i--)
      if (this.queued[i].at <= this.clock) {
        this.startLeap(this.queued[i].fish);
        this.queued.splice(i, 1);
      }
    const back = 0.3 + 0.7 * Math.min(1, Math.max(0, harmony));
    for (const f of this.fish) {
      f.show += ((f.rank < back ? 1 : 0) - f.show) * Math.min(1, dt * 1.2);
      if (f.leap) {
        this.updateLeap(f, dt, flow);
        continue;
      }
      const s = this.schools[f.school];
      const c = Math.cos(s.heading),
        n = Math.sin(s.heading);
      // The slot in world space: across is (c, -n), along is (n, c).
      const tx = s.x + f.slotX * c + f.slotZ * n;
      const tz = s.z - f.slotX * n + f.slotZ * c;
      const before = f.heading;
      let want: number, speed: number, rate: number, maxRate: number;
      if (f.flee > 0) {
        f.flee -= dt;
        want = Math.atan2(Math.sign(f.x) || 1, 0.35);
        speed = 4.6;
        rate = 6;
        maxRate = 6.4;
      } else {
        const dx = tx - f.x,
          dz = tz - f.z,
          dist = Math.hypot(dx, dz);
        want = dist > 0.25 ? Math.atan2(dx, dz) : s.heading;
        speed = Math.min(3.8, Math.max(0.45, s.speed + (dist - 0.3) * 1.6));
        rate = 3.2;
        maxRate = 4.5;
      }
      f.heading = steer(f.heading, want, dt * rate, maxRate, dt);
      f.speed += (speed - f.speed) * Math.min(1, dt * 3);
      f.x += Math.sin(f.heading) * f.speed * dt;
      f.z += Math.cos(f.heading) * f.speed * dt + flow * dt;
      if (Math.abs(f.x) < this.inner - 1) f.x = Math.sign(f.x || 1) * (this.inner - 1); // never under the road
      // Bank into turns; the tail beats faster the harder the fish swims.
      const yawRate = dt > 0 ? Math.atan2(Math.sin(f.heading - before), Math.cos(f.heading - before)) / dt : 0;
      f.roll += (Math.max(-0.45, Math.min(0.45, -yawRate * 0.12)) - f.roll) * Math.min(1, dt * 6);
      f.pitch += (0 - f.pitch) * Math.min(1, dt * 8);
      f.wagRate = f.flee > 0 ? 20 : 7 + f.speed * 3.2;
      f.wagAmp = f.flee > 0 ? 0.7 : 0.45;
      f.lift += (0 - f.lift) * Math.min(1, dt * 10);
      f.y = this.options.sea + Math.sin(this.clock * 1.3 + f.phase) * 0.012;
    }
  }

  private updateLeap(f: Fish, dt: number, flow: number) {
    const l = f.leap!;
    l.t += dt;
    l.fromZ += flow * dt;
    const k = Math.min(1, l.t / l.dur);
    f.x = l.fromX + l.dirX * l.dist * k;
    f.z = l.fromZ + l.dirZ * l.dist * k;
    f.y = this.options.sea + Math.sin(k * Math.PI) * l.height;
    // Nose follows the arc (softened): up on the way out, down into the water.
    f.pitch = Math.atan2(l.height * Math.PI * Math.cos(k * Math.PI), l.dist) * 0.7;
    f.roll = Math.sin(k * Math.PI) * 0.6 * l.spin;
    f.lift = Math.min(1, Math.sin(k * Math.PI) * 4);
    f.wagRate = 24;
    f.wagAmp = 0.65;
    if (k >= 1) {
      f.leap = undefined;
      f.y = this.options.sea;
      f.pitch = 0;
      this.onSplash?.(f.x, f.z, true, f.species);
    }
  }

  private startLeap(f: Fish) {
    if (f.leap) return;
    const r = this.random;
    f.flee = 0;
    f.leap = {
      t: 0,
      dur: 0.75 + f.size * 0.1,
      fromX: f.x,
      fromZ: f.z,
      dirX: Math.sin(f.heading),
      dirZ: Math.cos(f.heading),
      dist: 3.6 + r() * 1.6,
      height: 1.3 + r() * 0.9,
      spin: r() < 0.5 ? -1 : 1,
    };
    this.onSplash?.(f.x, f.z, false, f.species);
  }

  private visible(f: Fish) {
    return !f.leap && f.show > 0.6 && f.z > -38 && f.z < -8;
  }

  /** One fish leaps beside the road (on `side` if given: -1 left, 1 right). */
  leap(side?: number): boolean {
    if (this.clock - this.lastLeap < LEAP_GAP) return false;
    let best: Fish | undefined,
      bestScore = Infinity;
    for (const f of this.fish) {
      if (!this.visible(f) || (side && Math.sign(f.x) !== Math.sign(side))) continue;
      const score = Math.abs(f.x) + this.random() * 3; // near the road, with some variety
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    if (!best) return false;
    this.lastLeap = this.clock;
    this.startLeap(best);
    return true;
  }

  /** A whole school leaps in a ripple: combo milestones and golden phrases. */
  wave(): number {
    const counts = new Map<number, number>();
    for (const f of this.fish) if (this.visible(f)) counts.set(f.school, (counts.get(f.school) ?? 0) + 1);
    const school = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (school === undefined) return 0;
    const members = this.fish.filter((f) => f.school === school && !f.leap && f.show > 0.3);
    members.forEach((f, i) => this.queued.push({ at: this.clock + i * 0.09, fish: f }));
    return members.length;
  }

  /** A miss: fish near the camera dart away from the road. */
  scatter(): number {
    let n = 0;
    for (const f of this.fish)
      if (!f.leap && f.z > -60) {
        f.flee = 0.8 + this.random() * 0.5;
        n++;
      }
    return n;
  }
}
