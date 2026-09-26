// The song clock. Song time follows the audio clock (what the player *hears*,
// including output latency), accompaniment is scheduled 150 ms ahead, and in
// practice mode the clock waits at every note until the player plays it.
import type { Note } from "../music";
import { soundDuration } from "../music";
import type { Chart, ChartNote } from "./chart";
import type { SoundBank, Stop } from "./sound";

const LOOKAHEAD = 0.15;
const TAIL = 1.6; // seconds of ring-out after the stage end

export type ConductorOptions = {
  speed: number;
  practice: boolean;
  offsetMs: number;
  approach: number; // seconds a note takes to travel the road (for the lead-in)
  auto?: ChartNote[]; // notes played for the player (assisted, or the whole melody)
  keepMelody?: boolean; // the melody plays itself, so hits add no second copy
};

type Scheduled = { time: number; midi: number; duration: number; velocity: number; program?: number; gain: number };

export class Conductor {
  readonly startTime: number; // song time at which the clock starts (lead-in included)
  readonly firstNote: number;
  state: "ready" | "playing" | "paused" | "ended" = "ready";
  waiting?: number; // practice gate time while waiting
  private anchorSong = 0;
  private anchorCtx = 0;
  private events: Scheduled[];
  private next = 0; // index of the next event to schedule
  private live = new Map<number, Stop>(); // chart note id -> sounding hit
  // Smooth the audio clock between its coarse updates using performance.now().
  private smoothCtx = 0;
  private smoothPerf = 0;
  gate?: (t: number) => number | undefined; // practice: time of the next waiting note

  constructor(
    readonly bank: SoundBank,
    readonly chart: Chart,
    readonly options: ConductorOptions,
  ) {
    this.firstNote = chart.notes[0]?.time ?? chart.start;
    const lead = Math.max(2.4, options.approach * options.speed + 0.8);
    this.startTime = Math.min(chart.start, this.firstNote - lead);
    const acc: Scheduled[] = chart.accompaniment.map((n: Note) => ({
      time: n.time,
      midi: n.midi,
      duration: soundDuration(n),
      velocity: n.velocity,
      program: n.program,
      gain: 0.82,
    }));
    for (const n of options.auto ?? [])
      acc.push({ time: n.time, midi: n.midi, duration: n.sound, velocity: Math.max(0.42, n.velocity), program: undefined, gain: 0.95 });
    this.events = acc.sort((a, b) => a.time - b.time);
    this.anchorSong = this.startTime;
  }

  get speed() {
    return this.options.speed;
  }

  /** Current song time as heard by the player, adjusted by the user offset. */
  time(perf = performance.now()): number {
    const offset = this.options.offsetMs / 1000 * this.speed;
    if (this.state !== "playing") return this.anchorSong - offset;
    const heard = this.heardCtx(perf);
    let t = this.anchorSong + (heard - this.anchorCtx) * this.speed;
    if (this.waiting !== undefined) t = Math.min(t, this.waiting);
    return t - offset;
  }

  /** Song time at which an input event (performance.now timestamp) happened. */
  inputTime(eventPerf: number) {
    return this.time(Math.min(eventPerf, performance.now()));
  }

  start() {
    const ctx = this.bank.ctx;
    if (!ctx) throw Error("Audio is not initialised");
    this.anchorCtx = ctx.currentTime + 0.1;
    this.state = "playing";
    this.smoothPerf = 0;
  }

  pause() {
    if (this.state !== "playing") return;
    this.anchorSong = this.rawTime();
    this.state = "paused";
    this.bank.stopAll();
    this.live.clear();
  }

  /** Resume a little before the pause point so the music leads back in. */
  resume(rewind = 2) {
    if (this.state !== "paused") return;
    this.anchorSong = Math.max(this.startTime, this.anchorSong - rewind * this.speed);
    this.next = this.events.findIndex((e) => e.time >= this.anchorSong);
    if (this.next < 0) this.next = this.events.length;
    this.anchorCtx = (this.bank.ctx?.currentTime ?? 0) + 0.1;
    this.state = "playing";
    this.smoothPerf = 0;
  }

  stop() {
    if (this.state === "playing") this.anchorSong = this.rawTime();
    this.state = "ended";
    this.bank.stopAll();
    this.live.clear();
  }

  /** Per-frame: schedule accompaniment, apply the practice gate, detect the end. */
  update(finished: boolean) {
    if (this.state !== "playing" || !this.bank.ctx) return;
    const ctx = this.bank.ctx;
    const now = this.rawTime();
    const pendingGate = this.options.practice ? this.gate?.(now) : undefined;
    if (this.options.practice) {
      const gate = pendingGate;
      if (gate !== undefined && now >= gate && this.waiting === undefined) {
        // Freeze the clock at the gate; ringing notes keep sounding.
        this.waiting = gate;
      } else if (this.waiting !== undefined && (gate === undefined || gate > this.waiting)) {
        // The player cleared the gate: restart the clock from it.
        this.anchorSong = this.waiting;
        this.anchorCtx = ctx.currentTime + 0.02;
        this.waiting = undefined;
        this.smoothPerf = 0;
      }
    }
    const horizon = this.waiting ?? this.rawTime() + LOOKAHEAD * this.speed;
    while (this.next < this.events.length) {
      const e = this.events[this.next];
      // Never schedule at/beyond an uncleared gate, even before the clock reaches it.
      if (pendingGate !== undefined && e.time >= pendingGate) break;
      if (this.waiting !== undefined ? e.time >= this.waiting - 0.001 : e.time > horizon) break;
      this.next++;
      if (e.time < this.anchorSong - 0.02) continue; // already past (after a resume)
      const due = this.anchorCtx + (e.time - this.anchorSong) / this.speed;
      // After a stall (a hitch, a backgrounded tab) never fire a backlog of notes at once.
      if (due < ctx.currentTime - 0.05) continue;
      const at = Math.max(ctx.currentTime, due);
      const end = Math.min(e.time + e.duration, this.chart.end + TAIL);
      if (end > e.time) this.bank.note(e.midi, at, (end - e.time) / this.speed, e.velocity, e.program, e.gain);
    }
    if (now >= this.chart.end + 0.6 && finished) {
      this.anchorSong = now; // the clock stays at the end (results scene, retry backdrop)
      this.state = "ended";
    }
  }

  /** Sound a note the player just hit, right now. */
  hit(note: ChartNote) {
    if (this.options.keepMelody) return; // already scheduled with the song
    this.live.get(note.id)?.();
    const at = this.bank.now;
    const duration = Math.min(note.sound, this.chart.end + TAIL - note.time) / this.speed;
    this.live.set(note.id, this.bank.note(note.midi, at, Math.max(0.12, duration), Math.max(0.45, note.velocity)));
    // Only holds need their handle later; keep the map from growing through a song.
    if (this.live.size > 48) this.live.delete(this.live.keys().next().value!);
  }

  /** The player let go of a hold early: damp that note. */
  release(note: ChartNote) {
    const stop = this.live.get(note.id);
    if (stop && note.hold) {
      stop();
      this.live.delete(note.id);
    }
  }

  private rawTime() {
    if (this.state !== "playing") return this.anchorSong;
    const t = this.anchorSong + (this.heardCtx(performance.now()) - this.anchorCtx) * this.speed;
    return this.waiting !== undefined ? Math.min(t, this.waiting) : t;
  }

  private heardCtx(perf: number) {
    const heard = this.bank.heardAt(perf);
    if (!this.smoothPerf) {
      this.smoothCtx = heard;
      this.smoothPerf = perf;
      return heard;
    }
    // The audio clock advances in coarse steps; predict from performance.now()
    // and blend gently toward the reported value. Past timestamps (input
    // events) read the estimate without moving it.
    const predicted = this.smoothCtx + (perf - this.smoothPerf) / 1000;
    const value = Math.abs(heard - predicted) > 0.03 ? heard : predicted + (heard - predicted) * 0.08;
    if (perf >= this.smoothPerf) {
      this.smoothCtx = value;
      this.smoothPerf = perf;
    }
    return value;
  }
}
