// One run of a stage: chart + judge + conductor + input + 3D stage + HUD.
import type { Piece } from "../music";
import { noteName } from "../music";
import { buildChart, LANES, laptopBase, pianoWindow, type Chart, type Difficulty, type KeyMode } from "./chart";
import { Conductor } from "./conductor";
import { laneCodes, laneForKey, laneLabels, lanesFor, type Input, type LaneEvent, type LanePreset } from "./input";
import { keyLabel } from "./keyboard-layout";
import { letterOf } from "./words";
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
  laneKeys: LanePreset;
  keepMelody: boolean; // the song always plays itself; misses only show on screen
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
    // Practice teaches the very chart that is played for stars: build it at full
    // speed; only the clock (and the judge's windows) slow down.
    this.chart = buildChart(piece, {
      difficulty,
      mode,
      speed: 1,
      seed: setup.stageId,
      theme: setup.theme.id,
      lanes: lanesFor(LANES[difficulty], setup.laneKeys),
    });
    // Real-piano mode on a laptop: notes outside the three-row key window are assisted.
    let laptopKeys: Map<number, string> | undefined;
    let base = 60;
    let keyRange: [number, number] | undefined;
    if (mode === "piano") {
      // Show at most three octaves; notes beyond them are played for the player.
      keyRange = pianoWindow(this.chart, 3);
      this.chart.notes.forEach((n) => {
        if (n.midi < keyRange![0] || n.midi > keyRange![1]) this.assist.add(n.id);
      });
      base = laptopBase(this.chart, setup.laptop === "home" ? 13 : 17, 10);
      if (!setup.midi && !setup.touch) {
        laptopKeys = new Map();
        const layout = computerLayout(3, setup.laptop === "home" ? "home" : "classic");
        for (const row of layout.rows)
          for (const label of row) {
            const midi = laneForKey(keyCode(label), { kind: "piano", base, layout: setup.laptop });
            if (midi !== undefined) laptopKeys.set(midi, keyLabel(keyCode(label), label));
          }
        this.chart.notes.forEach((n) => {
          if (!laptopKeys!.has(n.midi)) this.assist.add(n.id);
        });
      }
    }
    this.judge = new Judge(this.chart, {
      speed,
      lenient: difficulty === "easy",
      // Touch screens add latency: Tap mode forgives a little more.
      windowScale: mode === "tap" ? (difficulty === "easy" ? 1.5 : 1.35) : undefined,
      practice,
      skip: this.assist,
      // A pianist on a real keyboard may add harmony or a left hand: extra keys
      // there are not mistakes. Everywhere else a wrong key while a note is due counts.
      wrongKeys: !(mode === "piano" && setup.midi),
    });
    const approach = approachFor(setup.noteSpeed);
    this.conductor = new Conductor(bank, this.chart, {
      speed,
      practice,
      offsetMs: setup.offsetMs,
      approach,
      // Keep-the-song mode schedules every melody note; otherwise only assisted ones.
      auto: this.chart.notes.filter((n) => setup.keepMelody || this.assist.has(n.id)),
      keepMelody: setup.keepMelody,
    });
    this.conductor.gate = () => this.judge.gate()?.time;
    stage.setup(this.chart, setup.theme, {
      approach,
      speed,
      labels: setup.labels,
      laneLabels:
        mode === "lanes"
          ? laneLabels(this.chart.lanes, setup.laneKeys).map((label, i) => keyLabel(laneCodes(this.chart.lanes, setup.laneKeys)[i], label))
          : mode === "tap"
            ? setup.touch
              ? ["◀", "▶"]
              : [keyLabel("KeyF", "F"), keyLabel("KeyJ", "J")]
            : undefined,
      laptopKeys,
      touch: setup.touch,
      reducedMotion: setup.reducedMotion,
      quality: setup.quality,
      skin: setup.skin,
      assist: this.assist,
      keyRange,
    });
    world.build(setup.theme, hash(setup.stageId), stage.roadHalf, setup.quality);
    input.setMode(
      mode === "lanes"
        ? { kind: "lanes", lanes: this.chart.lanes, preset: setup.laneKeys }
        : mode === "words"
          ? { kind: "words" }
          : mode === "tap"
            ? { kind: "tap" }
            : { kind: "piano", base, layout: setup.laptop },
    );
    input.onLane = (e) => this.lane(e);
    // Tap mode: the whole screen is two big buttons, left half and right half.
    input.pointerLane =
      mode === "tap"
        ? (x) => {
            const r = input.surface.getBoundingClientRect();
            return x < r.left + r.width / 2 ? 0 : 1;
          }
        : (x, y) => stage.laneAt(x, y, input.surface.getBoundingClientRect());
    hud.begin({
      title: setup.title,
      difficulty,
      mode,
      practice,
      lanes: this.chart.lanes,
      notes: this.judge.scored,
      excerpt: this.chart.excerpt,
      assisted: this.assist.size,
      keepMelody: setup.keepMelody,
      touch: setup.touch,
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
    if (this.chart.mode === "tap") this.hud.tapZone(lane, down);
    if (e.down) {
      const events = this.judge.press(e.lane, t);
      this.apply(events);
      // Real keys always sound their own pitch, even when they weren't the target
      // (a stray, or a press so early it only consumed the note as a miss).
      if (
        !this.setup.keepMelody &&
        this.chart.mode === "piano" &&
        events.some((ev) => ev.type === "stray" || ev.type === "wrong" || (ev.type === "miss" && ev.early))
      ) {
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
          // Keep-the-song mode never punishes with sound: the miss is only shown.
          if (!this.setup.keepMelody) this.bank.blip("miss");
          break;
        case "stray":
          this.stage.stray(ev.lane);
          if (this.chart.mode !== "piano" && !this.setup.keepMelody) this.bank.blip("stray");
          if (this.judge.practice) this.hud.hint(this.practiceHint());
          break;
        case "wrong": {
          // Wrong key while a note was due elsewhere: shown (and it breaks the combo),
          // but silent when the song keeps playing.
          this.stage.stray(ev.lane);
          const pos = this.stage.screenOf(ev.lane, innerWidth, innerHeight);
          this.hud.judgement("wrong", pos.x, pos.y, 0);
          if (this.chart.mode !== "piano" && !this.setup.keepMelody) this.bank.blip("stray");
          break;
        }
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
      this.chart.mode === "piano"
        ? noteName(n.midi)
        : this.chart.mode === "words"
          ? `“${letterOf(n.lane).toUpperCase()}”`
          : this.chart.mode === "tap"
            ? n.lane === 0
              ? "◀ Left"
              : "Right ▶"
          : laneLabels(this.chart.lanes, this.setup.laneKeys)[n.lane] ?? String(n.lane + 1),
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
    const holding = this.judge.holdingIds; // no per-frame scan of every note
    const beat = this.beatPhase(t);
    this.beat = beat;
    if (this.chart.mode === "words") this.updateWords();
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

  private wordCursor = 0;
  private wordSig = "";

  /** Words mode: the word being typed (letter by letter) and the next two. */
  private updateWords() {
    const words = this.chart.words;
    if (!words?.length) return;
    const st = this.judge.state;
    while (this.wordCursor < words.length - 1) {
      const w = words[this.wordCursor];
      let done = true;
      for (let i = w.first; i <= w.last; i++) if (!st[i]?.judgement && !this.assist.has(i)) done = false;
      if (!done) break;
      this.wordCursor++;
    }
    const w = words[this.wordCursor];
    const letters = [...w.text].map((ch, k) => {
      const j = st[w.first + k]?.judgement;
      return { ch, state: j === "miss" ? "miss" : j ? "hit" : "todo" } as const;
    });
    const next = words.slice(this.wordCursor + 1, this.wordCursor + 3).map((x) => x.text);
    const sig = letters.map((l) => l.state[0]).join("") + w.text + next.join();
    if (sig === this.wordSig) return;
    this.wordSig = sig;
    this.hud.words(letters, next);
  }

  /** A line for the results card: typing speed in words mode, a note on keep-the-song mode. */
  summary() {
    const bits: string[] = [];
    const words = this.chart.words;
    if (words?.length) {
      const c = this.judge.counts;
      const minutes = Math.max(0.1, (this.chart.end - this.chart.start) / this.setup.speed / 60);
      const wpm = Math.round((c.perfect + c.great + c.good) / 5 / minutes);
      // The song sets the pace: a flawless run types exactly this fast.
      const pace = Math.round(this.chart.notes.length / 5 / minutes);
      const clean = words.filter((w) => {
        for (let i = w.first; i <= w.last; i++) if (this.judge.state[i]?.judgement === "miss" || !this.judge.state[i]?.judgement) return false;
        return true;
      }).length;
      bits.push(`⌨️ ${wpm} WPM · song pace ${pace} WPM · ${clean} of ${words.length} words typed perfectly`);
    }
    if (this.setup.keepMelody) bits.push("🎵 The song kept playing for you");
    return bits.join(" · ");
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
