// One run of a stage: chart + judge + conductor + input + 3D stage + HUD.
import type { Piece } from "../music";
import { noteName } from "../music";
import { buildChart, laptopBase, pianoWindow, type Chart, type Difficulty, type KeyMode } from "./chart";
import { Conductor } from "./conductor";
import { LANE_LABELS, laneForKey, type Input, type LaneEvent } from "./input";
import { Judge, type JudgeEvent, type Result } from "./judge";
import type { Stage } from "./render/stage";
import type { World } from "./render/world";
import type { Theme } from "./render/themes";
import type { SoundBank } from "./sound";
import type { Hud } from "./ui/hud";
import { computerLayout, keyCode } from "../computer-keyboard";

export type PlaySetup = {
  piece: Piece;
  stageId: string;
  title: string;
  difficulty: Difficulty;
  mode: KeyMode;
  practice: boolean;
  speed: number; // practice speed or 1
  noteSpeed: number; // 1..10 setting
  offsetMs: number;
  labels: boolean;
  laptop: "chromatic" | "home";
  skin: string;
  touch: boolean;
  midi: boolean;
  reducedMotion: boolean;
  quality: number;
  theme: Theme;
};

export const approachFor = (noteSpeed: number) => Math.max(0.9, 3.3 - 0.26 * (noteSpeed - 1));

export class PlaySession {
  readonly chart: Chart;
  readonly judge: Judge;
  readonly conductor: Conductor;
  readonly assist = new Set<number>();
  private held = new Map<number, number>(); // lane -> hold note id
  private laneStops = new Map<number, () => void>();
  private progress = 0;
  private lastCount = -1;
  private started = false;
  paused = false;
  done = false;
  autoplay = false; // test/demo hook: hits every note perfectly
  beat = 0;
  private autoRelease = new Map<number, number>(); // lane -> song time to release
  onFinish?: (result: Result) => void;
  onEncoreReady?: () => void;
  onCheer?: () => void;
  private readyAnnounced = false;

  constructor(
    readonly setup: PlaySetup,
    readonly bank: SoundBank,
    readonly input: Input,
    readonly stage: Stage,
    readonly world: World,
    readonly hud: Hud,
  ) {
    const { piece, difficulty, mode, practice, speed } = setup;
    this.chart = buildChart(piece, { difficulty, mode, speed });
    // Real-piano mode on a laptop: notes outside the 17-key window are assisted.
    let laptopKeys: Map<number, string> | undefined;
    let base = 60;
    let keyRange: [number, number] | undefined;
    if (mode === "piano") {
      // Show at most three octaves; notes beyond them are played for the player.
      keyRange = pianoWindow(this.chart, 3);
      this.chart.notes.forEach((n) => {
        if (n.midi < keyRange![0] || n.midi > keyRange![1]) this.assist.add(n.id);
      });
      base = laptopBase(this.chart, setup.laptop === "home" ? 13 : 17);
      if (!setup.midi && !setup.touch) {
        laptopKeys = new Map();
        const layout = computerLayout(2, setup.laptop === "home" ? "home" : "classic");
        for (const row of layout.rows)
          for (const label of row) {
            const midi = laneForKey(keyCode(label), { kind: "piano", base, layout: setup.laptop });
            if (midi !== undefined) laptopKeys.set(midi, label);
          }
        this.chart.notes.forEach((n) => {
          if (!laptopKeys!.has(n.midi)) this.assist.add(n.id);
        });
      }
    }
    this.judge = new Judge(this.chart, { speed, lenient: difficulty === "easy", practice, skip: this.assist });
    const approach = approachFor(setup.noteSpeed);
    this.conductor = new Conductor(bank, this.chart, {
      speed,
      practice,
      offsetMs: setup.offsetMs,
      approach,
      auto: this.chart.notes.filter((n) => this.assist.has(n.id)),
    });
    this.conductor.gate = () => this.judge.gate()?.time;
    stage.setup(this.chart, setup.theme, {
      approach,
      speed,
      labels: setup.labels,
      laneLabels: mode === "lanes" ? LANE_LABELS[this.chart.lanes] : undefined,
      laptopKeys,
      touch: setup.touch,
      reducedMotion: setup.reducedMotion,
      quality: setup.quality,
      skin: setup.skin,
      assist: this.assist,
      keyRange,
    });
    world.build(setup.theme, hash(setup.stageId), stage.roadHalf, setup.quality);
    input.setMode(mode === "lanes" ? { kind: "lanes", lanes: this.chart.lanes } : { kind: "piano", base, layout: setup.laptop });
    input.onLane = (e) => this.lane(e);
    input.pointerLane = (x, y) => stage.laneAt(x, y, input.surface.getBoundingClientRect());
    hud.begin({
      title: setup.title,
      difficulty,
      mode,
      practice,
      lanes: this.chart.lanes,
      notes: this.judge.scored,
      excerpt: this.chart.excerpt,
      assisted: this.assist.size,
    });
  }

  start(place = "") {
    this.hud.intro(this.setup.title, place);
    this.conductor.start();
    this.input.enabled = true;
    this.started = true;
  }

  pause() {
    if (!this.started || this.done || this.paused) return;
    // Release first, while lane events still count: holds end with fair credit
    // and keys don't stay visually pressed through the pause.
    this.input.releaseAll();
    this.releaseAuto();
    this.paused = true;
    this.conductor.pause();
    this.input.enabled = false;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.conductor.resume(2);
    this.input.enabled = true;
  }

  quit() {
    this.done = true;
    this.input.enabled = false;
    this.input.onLane = undefined;
    this.conductor.stop();
    for (const stop of this.laneStops.values()) stop();
  }

  activateEncore() {
    const events = this.judge.activateEncore();
    this.apply(events);
  }

  private lane(e: LaneEvent) {
    if (this.done || this.paused) return;
    this.pressLane(e.lane, e.down, this.conductor.inputTime(e.at));
  }

  private pressLane(lane: number, down: boolean, t: number) {
    const e = { lane, down };
    this.stage.press(e.lane, e.down);
    if (e.down) {
      const events = this.judge.press(e.lane, t);
      this.apply(events);
      // Real keys always sound their own pitch, even when they weren't the target
      // (a stray, or a press so early it only consumed the note as a miss).
      if (this.chart.mode === "piano" && events.some((ev) => ev.type === "stray" || (ev.type === "miss" && ev.early))) {
        this.laneStops.get(e.lane)?.();
        this.laneStops.set(e.lane, this.bank.note(e.lane, this.bank.now, 0.9, 0.6));
      }
    } else {
      this.laneStops.get(e.lane)?.();
      this.laneStops.delete(e.lane);
      this.apply(this.judge.release(e.lane, t));
    }
  }

  private apply(events: JudgeEvent[]) {
    for (const ev of events) {
      switch (ev.type) {
        case "hit":
          this.conductor.hit(ev.note);
          this.stage.hit(ev.note, ev.judgement);
          if (!this.judge.practice) {
            const pos = this.stage.screenOf(ev.note.lane, innerWidth, innerHeight);
            this.hud.judgement(ev.judgement, pos.x, pos.y, ev.delta);
          }
          break;
        case "miss":
          this.stage.miss(ev.note);
          {
            const pos = this.stage.screenOf(ev.note.lane, innerWidth, innerHeight);
            this.hud.judgement("miss", pos.x, pos.y, 0);
          }
          this.bank.blip("miss");
          break;
        case "stray":
          this.stage.stray(ev.lane);
          if (this.chart.mode === "lanes") this.bank.blip("stray");
          if (this.judge.practice) this.hud.hint(this.practiceHint());
          break;
        case "hold-end":
          this.stage.holdEnd(ev.note, ev.complete);
          if (!ev.complete) this.conductor.release(ev.note);
          break;
        case "golden":
          this.hud.golden(ev.complete);
          if (ev.complete) this.bank.blip("star", 7);
          break;
        case "combo":
          this.stage.celebrate(ev.combo);
          this.onCheer?.();
          this.hud.milestone(ev.combo);
          this.bank.blip("combo");
          break;
        case "encore":
          this.hud.encore(ev.active);
          if (ev.active) {
            this.onCheer?.();
            this.stage.encoreBurst();
            this.bank.blip("encore");
          }
          break;
      }
    }
  }

  practiceHint() {
    const group = this.judge.gateGroup();
    if (!group.length) return "";
    const names = group.map((n) =>
      this.chart.mode === "piano" ? noteName(n.midi) : LANE_LABELS[this.chart.lanes]?.[n.lane] ?? String(n.lane + 1),
    );
    return `Next: ${names.join(" + ")}`;
  }

  update(dt: number) {
    if (!this.started) return;
    const t = this.conductor.time();
    if (!this.paused && !this.done) {
      if (this.autoplay) this.autoPlay(t);
      this.apply(this.judge.update(t));
      this.conductor.update(this.judge.finished);
    }
    const span = Math.max(1, this.chart.end - this.chart.start);
    this.progress = Math.max(0, Math.min(1, (t - this.chart.start) / span));
    // Countdown before the first note.
    const toFirst = this.conductor.firstNote - t;
    const count = toFirst > 0 && toFirst <= 3.2 * this.setup.speed ? Math.ceil(toFirst / this.setup.speed) : toFirst > 0 ? 9 : 0;
    if (count !== this.lastCount && !this.paused) {
      this.lastCount = count;
      if (count >= 1 && count <= 3) {
        this.hud.countdown(String(count));
        this.bank.blip("count");
      } else if (count === 0 && toFirst > -0.5) {
        this.hud.countdown(this.judge.practice ? "Play!" : "Go!");
        this.bank.blip("go");
      }
    }
    const holding = new Set<number>();
    this.judge.state.forEach((s, i) => {
      if (s.holding) holding.add(i);
    });
    const beat = this.beatPhase(t);
    this.beat = beat;
    this.stage.update(dt, t, {
      encore: this.judge.encore,
      encoreActive: this.judge.encoreActive,
      harmony: this.judge.harmony,
      holding,
    });
    this.world.update(dt, performance.now() / 1000, this.progress, this.judge.practice ? 0.8 : this.judge.harmony, beat, this.stage.unitsPerSong * this.setup.speed * 0.35, this.judge.encoreActive ? 1 : 0);
    this.world.env.follow(this.stage.camera);
    if (this.judge.encore >= 0.5 && !this.judge.encoreActive && !this.readyAnnounced) {
      this.readyAnnounced = true;
      this.onEncoreReady?.();
    }
    if (this.judge.encoreActive) this.readyAnnounced = false;
    this.hud.update({
      score: this.judge.score,
      combo: this.judge.combo,
      multiplier: this.judge.multiplier,
      harmony: this.judge.harmony,
      encore: this.judge.encore,
      encoreActive: this.judge.encoreActive,
      progress: this.progress,
      accuracy: this.liveAccuracy(),
      waiting: this.conductor.waiting !== undefined,
      hint: this.judge.practice ? this.practiceHint() : "",
    });
    if (this.conductor.state === "ended" && !this.done) {
      this.input.releaseAll();
      this.releaseAuto();
      this.done = true;
      this.input.enabled = false;
      this.onFinish?.(this.judge.result());
    }
  }

  private releaseAuto() {
    for (const lane of this.autoRelease.keys()) this.pressLane(lane, false, this.conductor.time());
    this.autoRelease.clear();
  }

  private autoPlay(t: number) {
    for (const [lane, at] of this.autoRelease)
      if (t >= at) {
        this.autoRelease.delete(lane);
        this.pressLane(lane, false, at);
      }
    // Every due, unjudged note — however long the last frame took (slow devices, tests).
    const next = this.judge.practice
      ? this.judge.gateGroup()
      : this.chart.notes.filter((n) => n.time <= t && !this.judge.state[n.id].judgement && !this.assist.has(n.id));
    for (const n of next) {
      if (n.time > t) continue;
      if (this.autoRelease.has(n.lane)) this.pressLane(n.lane, false, n.time - 0.001);
      this.pressLane(n.lane, true, this.judge.practice ? t : n.time);
      this.autoRelease.set(n.lane, n.hold ? n.end + 0.01 : n.time + 0.08);
    }
  }

  private liveAccuracy() {
    const c = this.judge.counts;
    const judged = c.perfect + c.great + c.good + c.miss;
    return judged ? (c.perfect + c.great * 0.8 + c.good * 0.5) / judged : 1;
  }

  private beatPhase(t: number) {
    const beats = this.chart.beats;
    let i = 0;
    while (i < beats.length - 1 && beats[i + 1] <= t) i++;
    const len = beats[i + 1] !== undefined ? beats[i + 1] - beats[i] : 0.5;
    const phase = (t - (beats[i] ?? 0)) / Math.max(0.1, len);
    return Math.max(0, 1 - phase * 3);
  }
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
