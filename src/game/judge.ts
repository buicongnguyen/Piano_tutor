// Scoring for a stage: timing windows, combo multiplier, holds, Harmony,
// the Encore gauge and the final result. Pure and deterministic: all times are
// song seconds; windows are real seconds (song delta / speed).
import type { Chart, ChartNote } from "./chart";

export type Judgement = "perfect" | "great" | "good" | "miss";
export const WINDOWS = { perfect: 0.045, great: 0.09, good: 0.14, miss: 0.2 };
export const POINTS = { perfect: 300, great: 200, good: 100, miss: 0 };
export const WEIGHT = { perfect: 1, great: 0.8, good: 0.5, miss: 0 };
const HARMONY = { perfect: 0.03, great: 0.025, good: 0.015, miss: -0.07 };
export const STAR_ACCURACY = [0.6, 0.75, 0.88];
export const ENCORE_READY = 0.5;
const ENCORE_DRAIN = 0.25 / 8; // gauge per real second while active (8 s per quarter)
const WRONG_HARMONY = -0.04;

export type NoteState = {
  judgement?: Judgement;
  delta?: number; // real seconds, negative = early
  holding?: boolean;
  held?: number; // fraction of the tail held
  released?: boolean;
};

export type JudgeEvent =
  | { type: "hit"; note: ChartNote; judgement: Exclude<Judgement, "miss">; delta: number; points: number }
  | { type: "miss"; note: ChartNote; early: boolean }
  | { type: "stray"; lane: number } // nowhere near a note: harmless
  | { type: "wrong"; lane: number } // wrong key while a note was due elsewhere: breaks combo
  | { type: "hold-end"; note: ChartNote; complete: boolean; points: number }
  | { type: "golden"; complete: boolean; start: number }
  | { type: "combo"; combo: number }
  | { type: "encore"; active: boolean };

export type Result = {
  score: number;
  accuracy: number; // 0..1
  stars: number; // 0..3
  rank: "S+" | "S" | "A" | "B" | "C" | "D";
  fullCombo: boolean;
  maxCombo: number;
  counts: Record<Judgement, number>;
  total: number;
  strays: number;
  wrong: number; // wrong-key presses (count against accuracy)
  holdsDropped: number; // holds let go before half their length
  meanOffsetMs: number; // negative = early on average
  holdPercent: number;
};

export type JudgeOptions = {
  speed?: number;
  lenient?: boolean; // Easy: windows ×1.25
  windowScale?: number; // overrides `lenient` (touch play is looser still)
  practice?: boolean; // wait-for-me: no timing, no score
  skip?: Iterable<number>; // note ids played automatically (not scored)
  wrongKeys?: boolean; // count wrong keys (default on; off for a real MIDI keyboard)
};

export class Judge {
  readonly notes: ChartNote[];
  readonly state: NoteState[];
  readonly speed: number;
  readonly practice: boolean;
  readonly skip: Set<number>;
  private windows: typeof WINDOWS;
  score = 0;
  combo = 0;
  maxCombo = 0;
  harmony = 0.5;
  encore = 0; // 0..1 gauge
  encoreActive = false;
  strays = 0;
  wrong = 0;
  holdsDropped = 0;
  counts: Record<Judgement, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  private encoreGain: number;
  private countWrong: boolean;
  private cursor = 0; // first note that may still be unjudged
  private lastTime = -Infinity;
  private goldenDone = new Set<number>();
  private holdTotal = 0;
  private holdGot = 0;
  private offsets: number[] = [];
  private holding = new Set<number>();

  constructor(
    readonly chart: Chart,
    options: JudgeOptions = {},
  ) {
    this.notes = chart.notes;
    this.state = chart.notes.map(() => ({}));
    this.speed = options.speed && options.speed > 0 ? options.speed : 1;
    this.practice = !!options.practice;
    this.skip = new Set(options.skip ?? []);
    this.holdTotal = this.notes.reduce((total, n) =>
      total + (n.hold && !this.skip.has(n.id) ? n.end - n.time : 0), 0);
    this.countWrong = options.wrongKeys ?? true;
    // Short songs have few golden phrases: each fills more of the gauge so Encore is reachable.
    this.encoreGain = Math.max(0.25, Math.min(0.5, 1 / Math.max(1, chart.golden.length)));
    const k = options.windowScale ?? (options.lenient ? 1.25 : 1);
    this.windows = {
      perfect: WINDOWS.perfect * k,
      great: WINDOWS.great * k,
      good: WINDOWS.good * k,
      miss: WINDOWS.miss * k,
    };
  }

  get multiplier() {
    return Math.min(4, 1 + Math.floor(this.combo / 10));
  }

  get scored() {
    return this.notes.length - this.skip.size;
  }

  /** Earliest onset still waiting for the player (practice gate), or undefined. */
  gate(): ChartNote | undefined {
    for (let i = this.cursor; i < this.notes.length; i++)
      if (!this.skip.has(i) && !this.state[i].judgement) return this.notes[i];
    return undefined;
  }

  /** Notes of the gate's onset group that are still unplayed. */
  gateGroup(): ChartNote[] {
    const first = this.gate();
    if (!first) return [];
    return this.notes.filter(
      (n) => n.group === first.group && !this.skip.has(n.id) && !this.state[n.id].judgement,
    );
  }

  press(lane: number, t: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    if (this.practice) {
      const pending = this.gateGroup();
      const hit = pending.find((n) => n.lane === lane && n.time <= t + 0.6);
      if (!hit) {
        this.strays++;
        events.push({ type: "stray", lane });
        return events;
      }
      this.state[hit.id].judgement = "perfect";
      this.counts.perfect++;
      events.push({ type: "hit", note: hit, judgement: "perfect", delta: 0, points: 0 });
      this.advanceCursor();
      return events;
    }
    // The earliest waiting note in this lane inside the Good window wins; failing
    // that, an early press inside the miss zone consumes the next note (no mashing).
    let best: ChartNote | undefined,
      bestDelta = 0,
      early: ChartNote | undefined;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      const delta = (t - n.time) / this.speed;
      if (delta < -this.windows.miss) break;
      if (n.lane !== lane || this.state[i].judgement || this.skip.has(i)) continue;
      if (Math.abs(delta) <= this.windows.good) {
        best = n;
        bestDelta = delta;
        break;
      }
      if (delta < 0 && !early) early = n;
    }
    if (!best) {
      // A late press at a note that just timed out is that note's (already counted)
      // miss, not an early grab at the next one: one mistake, one penalty.
      if (early && !this.recentlyMissed(lane, t)) this.miss(early, events, true);
      else if (!early && this.countWrong && this.dueElsewhere(lane, t)) {
        // A wrong key while a note is due in another lane: mashing every lane
        // earns no stars. Shown on screen; silent when the song keeps playing.
        this.wrong++;
        this.combo = 0;
        this.harmony = clamp01(this.harmony + WRONG_HARMONY);
        events.push({ type: "wrong", lane });
      } else {
        this.strays++;
        events.push({ type: "stray", lane });
      }
      return events;
    }
    const abs = Math.abs(bestDelta);
    const judgement: Exclude<Judgement, "miss"> =
      abs <= this.windows.perfect ? "perfect" : abs <= this.windows.great ? "great" : "good";
    const st = this.state[best.id];
    st.judgement = judgement;
    st.delta = bestDelta;
    this.offsets.push(bestDelta);
    this.counts[judgement]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (this.combo % 50 === 0) events.push({ type: "combo", combo: this.combo });
    const points = POINTS[judgement] * this.multiplier * (this.encoreActive ? 2 : 1);
    this.score += points;
    this.harmony = clamp01(this.harmony + HARMONY[judgement]);
    if (best.hold) {
      st.holding = true;
      this.holding.add(best.id);
    }
    events.push({ type: "hit", note: best, judgement, delta: bestDelta, points });
    this.checkGolden(best, events);
    this.advanceCursor();
    return events;
  }

  release(lane: number, t: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    if (this.practice) return events;
    for (const id of [...this.holding]) {
      const n = this.notes[id];
      if (n.lane === lane) this.endHold(n, Math.min(t, n.end), events);
    }
    return events;
  }

  /** Advance time: late misses, hold completion and Encore drain. */
  update(t: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    const dt = Number.isFinite(this.lastTime) ? Math.max(0, t - this.lastTime) / this.speed : 0;
    this.lastTime = t;
    if (this.practice) {
      this.advanceCursor(); // skip assisted notes so a practice run can finish
      return events;
    }
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if ((t - n.time) / this.speed <= this.windows.good) break;
      if (!this.state[i].judgement && !this.skip.has(i)) this.miss(n, events, false);
    }
    for (const id of [...this.holding]) {
      const n = this.notes[id];
      if (t >= n.end) this.endHold(n, n.end, events);
    }
    if (this.encoreActive) {
      this.encore = Math.max(0, this.encore - ENCORE_DRAIN * dt);
      if (this.encore <= 0) {
        this.encoreActive = false;
        events.push({ type: "encore", active: false });
      }
    }
    this.advanceCursor();
    return events;
  }

  activateEncore(): JudgeEvent[] {
    if (this.practice || this.encoreActive || this.encore < ENCORE_READY) return [];
    this.encoreActive = true;
    return [{ type: "encore", active: true }];
  }

  /** Note ids whose hold is in progress (live view; don't mutate). */
  get holdingIds(): ReadonlySet<number> {
    return this.holding;
  }

  get finished() {
    return this.cursor >= this.notes.length && this.holding.size === 0;
  }

  result(): Result {
    const total = this.scored;
    const weighted =
      this.counts.perfect * WEIGHT.perfect +
      this.counts.great * WEIGHT.great +
      this.counts.good * WEIGHT.good;
    // Wrong keys count as extra notes in the denominator.
    const played = total + this.wrong;
    const accuracy = played ? weighted / played : 0;
    const hits = this.counts.perfect + this.counts.great + this.counts.good;
    const hitRate = played ? hits / played : 0;
    // The first star rewards hitting the notes (a steadily late player still earns
    // it); the second and third reward timing.
    const stars = this.practice
      ? 0
      : (hitRate >= STAR_ACCURACY[0] - 1e-9 || accuracy >= STAR_ACCURACY[0] - 1e-9 ? 1 : 0) +
        STAR_ACCURACY.slice(1).filter((a) => accuracy >= a - 1e-9).length;
    const fullCombo = total > 0 && hits === total && this.wrong === 0 && this.holdsDropped === 0;
    const rank: Result["rank"] =
      total && this.counts.perfect === total && this.wrong === 0
        ? "S+"
        : accuracy >= 0.95
          ? "S"
          : accuracy >= 0.88
            ? "A"
            : accuracy >= 0.75
              ? "B"
              : accuracy >= 0.6 || fullCombo
                ? "C"
                : "D";
    const mean = this.offsets.length
      ? this.offsets.reduce((s, d) => s + d, 0) / this.offsets.length
      : 0;
    return {
      score: this.score,
      accuracy,
      stars,
      rank,
      fullCombo,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      total,
      strays: this.strays,
      wrong: this.wrong,
      holdsDropped: this.holdsDropped,
      meanOffsetMs: Math.round(mean * 1000),
      holdPercent: this.holdTotal ? Math.round((this.holdGot / this.holdTotal) * 100) : 100,
    };
  }

  private miss(n: ChartNote, events: JudgeEvent[], early: boolean) {
    this.state[n.id].judgement = "miss";
    this.counts.miss++;
    this.combo = 0;
    this.harmony = clamp01(this.harmony + HARMONY.miss);
    events.push({ type: "miss", note: n, early });
    this.checkGolden(n, events);
  }

  private endHold(n: ChartNote, at: number, events: JudgeEvent[]) {
    const st = this.state[n.id];
    st.holding = false;
    st.released = true;
    this.holding.delete(n.id);
    const length = n.end - n.time;
    const held = Math.max(0, Math.min(length, at - n.time));
    st.held = length > 0 ? held / length : 1;
    this.holdGot += held;
    const complete = st.held >= 0.9;
    if (st.held < 0.5) {
      // Letting go early breaks the combo: holds matter, not just their first press.
      this.holdsDropped++;
      this.combo = 0;
    }
    const points = Math.round(((held / this.speed) * 100 * this.multiplier * (this.encoreActive ? 2 : 1)) / 5) * 5;
    this.score += points;
    events.push({ type: "hold-end", note: n, complete, points });
  }

  private checkGolden(n: ChartNote, events: JudgeEvent[]) {
    if (!n.golden) return;
    this.chart.golden.forEach((phrase, i) => {
      if (this.goldenDone.has(i) || !phrase.ids.includes(n.id)) return;
      const states = phrase.ids.filter((id) => !this.skip.has(id)).map((id) => this.state[id].judgement);
      if (states.includes("miss")) {
        this.goldenDone.add(i);
        events.push({ type: "golden", complete: false, start: phrase.start });
      } else if (states.every((s) => s)) {
        this.goldenDone.add(i);
        this.encore = Math.min(1, this.encore + this.encoreGain);
        events.push({ type: "golden", complete: true, start: phrase.start });
      }
    });
  }

  /** Is a scored note (judged or not) due in another lane right now? */
  private dueElsewhere(lane: number, t: number) {
    for (let i = this.firstNear(t); i < this.notes.length; i++) {
      const n = this.notes[i];
      const delta = (t - n.time) / this.speed;
      if (delta < -this.windows.good) break;
      if (n.lane !== lane && !this.skip.has(i) && Math.abs(delta) <= this.windows.good) return true;
    }
    return false;
  }

  /** Did a note in this lane time out as a miss moments ago? */
  private recentlyMissed(lane: number, t: number) {
    for (let i = this.firstNear(t); i < this.notes.length; i++) {
      const n = this.notes[i];
      const delta = (t - n.time) / this.speed;
      if (delta < 0) break;
      if (n.lane === lane && this.state[i].judgement === "miss" && delta <= this.windows.miss) return true;
    }
    return false;
  }

  /** First note that could be within the miss window of `t` (binary search). */
  private firstNear(t: number) {
    const from = t - this.windows.miss * this.speed;
    let lo = 0,
      hi = this.notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.notes[mid].time < from) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private advanceCursor() {
    while (
      this.cursor < this.notes.length &&
      (this.state[this.cursor].judgement || this.skip.has(this.cursor))
    )
      this.cursor++;
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
