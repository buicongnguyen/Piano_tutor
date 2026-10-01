// Stillnote Encore: the application state machine.
import * as THREE from "three";
import { parseMidi, parseXml, type Piece } from "../music";
import {
  allStages,
  findStage,
  islandOpen,
  islandPlayed,
  islandRestored,
  islands,
  nextGate,
  totalStars,
  type Island,
  type Stage as StageInfo,
} from "./campaign";
import { Input } from "./input";
import { loadKeyboardLayout } from "./keyboard-layout";
import type { Result } from "./judge";
import { MenuMusic } from "./menu-music";
import { approachFor, PlaySession } from "./play";
import { loadKit, type Kit } from "./render/assets";
import { MapScene } from "./render/mapscene";
import { autoQuality, QUALITY, Renderer, type QualityKey } from "./render/renderer";
import { Stage } from "./render/stage";
import { THEMES } from "./render/themes";
import { World } from "./render/world";
import { Coda } from "./render/characters";
import { bestStars, loadSave, recordRun, storeSave, type SaveData, type Settings } from "./save";
import { importedStage, loadSong } from "./songs";
import { SoundBank } from "./sound";
import { storyFor } from "./story";
import { Dialogue } from "./ui/dialogue";
import { Hud } from "./ui/hud";
import { Screens, SKINS, type StageChoice } from "./ui/screens";

type State = "boot" | "title" | "map" | "loading" | "play" | "results";

export class App {
  state: State = "boot";
  readonly renderer: Renderer;
  readonly bank = new SoundBank();
  readonly input: Input;
  readonly screens: Screens;
  readonly hud: Hud;
  readonly dialogue: Dialogue;
  readonly music: MenuMusic;
  save: SaveData;
  kits: { stage?: Kit; world?: Kit; chars?: Kit; fish?: Kit } = {};
  map?: MapScene;
  stage?: Stage;
  world?: World;
  coda?: Coda;
  session?: PlaySession;
  lastChoice?: StageChoice;
  mine: { stage: StageInfo; piece: Piece }[] = [];
  quality: QualityKey = "medium";
  private last = performance.now();
  private opened = new Set<string>();
  private busy = false;
  private pendingCelebration?: string;

  constructor(readonly canvas: HTMLCanvasElement, readonly ui: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.onViewport = (h, pr) => this.viewport(h, pr);
    this.input = new Input(canvas);
    this.save = loadSave(safeStorage(), matchMedia("(pointer: coarse)").matches);
    this.screens = new Screens(ui);
    this.hud = new Hud(ui);
    this.dialogue = new Dialogue(ui);
    this.music = new MenuMusic(this.bank);
    this.bank.setVolumes(this.save.settings.music, this.save.settings.effects);
    this.applyQuality();
    this.wire();
    addEventListener("resize", () => this.resize());
    this.resize();
  }

  get settings() {
    return this.save.settings;
  }

  get touch() {
    return matchMedia("(pointer: coarse)").matches;
  }

  get reducedMotion() {
    const m = this.settings.motion;
    return m === "reduced" || (m === "auto" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  private applyQuality() {
    const q = this.settings.quality;
    this.quality = q === "auto" ? autoQuality(this.renderer.gl) : q;
    this.renderer.setQuality(this.quality);
    document.documentElement.dataset.quality = this.quality;
  }

  // ------------------------------------------------------------ boot

  async boot(progress: (p: number, text: string) => void) {
    void loadKeyboardLayout(); // labels keys as printed on the player's keyboard (AZERTY…)
    progress(0.1, "Unpacking the Encore…");
    const [stage, world, chars, fish] = await Promise.allSettled([
      loadKit("stage-kit.glb"),
      loadKit("world-kit.glb"),
      loadKit("characters.glb"),
      loadKit("fish-kit.glb"),
    ]);
    this.kits = {
      stage: stage.status === "fulfilled" ? stage.value : undefined,
      world: world.status === "fulfilled" ? world.value : undefined,
      chars: chars.status === "fulfilled" ? chars.value : undefined,
      fish: fish.status === "fulfilled" ? fish.value : undefined,
    };
    progress(0.7, "Painting the Sky Isles…");
    this.map = new MapScene(this.kits.world, this.kits.chars);
    this.map.ship?.setLacquer(SKINS.find((k) => k.id === this.settings.skin)?.color ?? "#e8282f");
    this.stage = new Stage(this.kits.stage ?? new Map());
    this.world = new World(this.stage.scene, this.kits.world, this.kits.chars, this.kits.fish);
    // Fish break the water with the stage's own splash rings and droplets.
    const stageFx = this.stage;
    this.world.shoals.onSplash = (x, y, z, color, landing) => {
      stageFx.rings.spawn(x, y, z, color, landing ? 1.5 : 1.1, landing ? 0.55 : 0.45);
      stageFx.particles.burst(x, y + 0.1, z, color, landing ? 12 : 8, landing ? 0.7 : 0.5);
    };
    if (this.kits.chars) {
      this.coda = new Coda(this.kits.chars);
      this.stage.scene.add(this.coda.root);
    }
    // Warm-up environment reflections for glossy toys.
    const pmrem = new THREE.PMREMGenerator(this.renderer.renderer);
    const env = pmrem.fromScene(roomEnvironment(), 0.04).texture;
    this.map.scene.environment = env;
    this.stage.scene.environment = env;
    (this.map.scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.55;
    (this.stage.scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.38;
    this.refreshMap();
    this.renderer.attach(this.map.scene, this.map.camera);
    this.resize();
    progress(1, "Ready");
    this.state = "title";
    this.screens.title.hidden = false;
    this.screens.renderSettings(this.settings, this.stars(), this.input.midiName);
    requestAnimationFrame(() => this.frame());
  }

  private stars() {
    return totalStars(bestStars(this.save));
  }

  private persist() {
    if (!storeSave(safeStorage(), this.save)) this.screens.toast("Progress can't be saved in this browser (private mode?).", "warn");
  }

  // ------------------------------------------------------------ wiring

  private wire() {
    const s = this.screens;
    s.onClick = () => this.bank.blip("tap", Math.floor(Math.random() * 8));
    s.onStart = () => void this.start();
    s.onIsland = (id) => void this.openIsland(id);
    s.onClosePanel = () => {
      s.hidePanel();
      this.bank.blip("back");
    };
    s.onPlay = (choice) => void this.play(choice);
    s.onResume = () => this.resume();
    s.onRestart = () => void this.restart();
    s.onQuit = () => this.quitToMap();
    s.onNext = () => void this.next();
    s.onSongbook = () => this.showSongbook();
    s.onImport = (file) => void this.importFile(file);
    s.onMidi = () => void this.connectMidi();
    s.onCalibrate = () => void this.calibrate();
    s.onReset = () => {
      const settings = this.save.settings;
      this.save = loadSave(undefined, this.touch);
      this.save.settings = settings;
      this.pendingCelebration = undefined;
      this.opened.clear(); // unlock toasts can play again as islands reopen
      this.persist();
      this.refreshMap(true);
      s.toast("Progress reset. The Hush settles over the isles again…");
    };
    s.onSettings = (patch) => this.applySettings({ ...this.settings, ...patch });
    s.onOpenSettings = () => this.screens.renderSettings(this.settings, this.stars(), this.input.midiName);
    this.hud.onPause = () => this.pause();
    // A phone call or Siri suspends audio mid-song: pause rather than freeze the clock.
    this.bank.onInterrupted = () => this.pause();
    this.hud.onEncore = () => this.session?.activateEncore();
    this.input.onAction = (action) => {
      if (action === "pause") this.pause();
      else if (action === "encore") this.session?.activateEncore();
      else if (action === "back") this.back();
    };
    addEventListener("keydown", (e) => {
      if (this.dialogue.open) return;
      if (this.state === "title" && !this.screens.settings.hidden) return;
      if (this.state === "title" && !e.repeat && !["Tab", "Shift", "Alt", "Control", "Meta", "Escape"].includes(e.key) && !/^F\d+$/.test(e.key)) {
        if ((e.target as HTMLElement)?.closest?.("a, button, input, select")) return;
        e.preventDefault();
        void this.start();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    // Map interaction: drag to pan, wheel to zoom, click an island.
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      if (this.state !== "map" || !this.map) return;
      this.map.pointerDown(e.clientX, e.clientY);
    });
    c.addEventListener("pointermove", (e) => {
      if (this.state === "map") this.map?.pointerMove(e.clientX, e.clientY);
    });
    c.addEventListener("pointerup", (e) => {
      if (this.state !== "map" || !this.map) return;
      if (!this.map.pointerUp()) return;
      const rect = c.getBoundingClientRect();
      const id = this.map.islandAt(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1));
      if (id) void this.openIsland(id);
    });
    c.addEventListener(
      "wheel",
      (e) => {
        if (this.state !== "map") return;
        e.preventDefault();
        this.map?.zoom(e.deltaY);
      },
      { passive: false },
    );
  }

  private back() {
    const s = this.screens;
    if (this.dialogue.open) return; // the dialogue handles its own Escape (skip)
    // While paused the game input is off, so Escape arrives here: close settings, else resume.
    if (this.state === "play" && this.session?.paused) {
      if (!s.settings.hidden) s.settings.hidden = true;
      else this.resume();
      return;
    }
    if (!s.settings.hidden) s.settings.hidden = true;
    else if (!s.songbook.hidden) s.songbook.hidden = true;
    else if (!s.panel.hidden) s.hidePanel();
  }

  // ------------------------------------------------------------ flow

  async start() {
    if (this.state !== "title" || this.busy) return;
    this.busy = true;
    try {
      await this.bank.init();
      this.bank.blip("select");
      void this.bank.loadPiano().then((ok) => {
        if (!ok) this.screens.toast("Piano samples couldn't load — using the synth piano.", "warn");
      });
      this.music.play();
      this.screens.title.hidden = true;
      if (!this.save.seen.includes("intro")) {
        await this.dialogue.play(storyFor("intro"));
        this.markSeen("intro");
      }
      this.enterMap();
    } finally {
      this.busy = false;
    }
  }

  enterMap() {
    this.state = "map";
    this.input.enabled = false;
    this.hud.hide();
    this.screens.results.hidden = true;
    this.screens.pause.hidden = true;
    this.screens.loading.hidden = true;
    this.screens.mapBar.hidden = false;
    this.screens.labels.hidden = false;
    this.renderer.attach(this.map!.scene, this.map!.camera);
    this.renderer.renderer.toneMappingExposure = 1; // stage themes set their own
    this.map!.enterMap(this.pendingCelebration ?? this.save.lastIsland);
    this.refreshMap();
    if (this.pendingCelebration) {
      this.map!.celebrate(this.pendingCelebration);
      this.bank.blip("unlock");
      this.pendingCelebration = undefined;
    }
    void this.tellDueStory("map");
    this.resize();
    if (!this.music.playing) this.music.play();
    this.renderer.setBloom(0.35, 0.5, 0.85);
    this.renderer.setGrade(1.1, 1.05, 0.14);
  }

  private islandStates() {
    const best = bestStars(this.save);
    const total = totalStars(best);
    const states: Record<string, "locked" | "open" | "restored"> = {};
    for (const i of islands)
      states[i.id] = !this.isOpen(i, total) ? "locked" : islandRestored(i, best) ? "restored" : "open";
    return { states, best, total };
  }

  private isOpen(island: Island, total: number) {
    return islandOpen(island, total, this.settings.openAll, islandPlayed(island, this.save.records));
  }

  refreshMap(silent = false) {
    const { states, best, total } = this.islandStates();
    if (silent) for (const i of islands) if (states[i.id] !== "locked") this.opened.add(i.id);
    this.map?.refresh(states, this.save.lastIsland);
    const isOpen = (i: Island) => states[i.id] !== "locked";
    this.screens.setProgress(this.save, best, total, this.settings.openAll ? undefined : nextGate(total, isOpen), isOpen);
    // Announce islands opened since the last visit.
    for (const i of islands)
      if (states[i.id] !== "locked") {
        if (this.opened.size && !this.opened.has(i.id)) {
          this.screens.toast(`🔓 <b>${i.name}</b> is open! The Hush's fog lifts…`, "unlock", 4200);
          this.bank.blip("unlock");
        }
        this.opened.add(i.id);
      }
    if (!this.opened.size) this.opened.add("meadow");
  }

  async openIsland(id: string) {
    const island = islands.find((i) => i.id === id);
    if (!island || this.state !== "map") return;
    this.map?.select(id, innerWidth > 700);
    const { total } = this.islandStates();
    const open = this.isOpen(island, total);
    if (open) {
      this.save.lastIsland = id;
      this.persist();
    }
    this.screens.showIsland(island, open);
    this.bank.blip(open ? "select" : "back");
    if (open && !this.save.seen.includes(`arrive:${id}`)) {
      await this.dialogue.play(storyFor(`arrive:${id}`));
      this.markSeen(`arrive:${id}`);
    }
  }

  /**
   * Story scenes the save says are due, in island order: each restore (after
   * its arrival, if that was missed), and the ending last. Derived from the save
   * every time, so a scene interrupted by a retry or a reload is never lost.
   * Only real progress tells the story: an island reached through "open every
   * island" waits until its stars gate is met.
   */
  private dueStory(): string[] {
    const { states, total } = this.islandStates();
    const seen = (key: string) => this.save.seen.includes(key);
    const due: string[] = [];
    for (const i of islands) {
      if (states[i.id] !== "restored" || total < i.gate || seen(`restore:${i.id}`)) continue;
      if (!seen(`arrive:${i.id}`)) due.push(`arrive:${i.id}`);
      due.push(`restore:${i.id}`);
    }
    const crown = islands[islands.length - 1];
    if (states[crown.id] === "restored" && total >= crown.gate && !seen("ending")) due.push("ending");
    return due;
  }

  private telling = false;

  private async tellDueStory(state: State) {
    if (this.telling) return;
    this.telling = true;
    try {
      for (let key = this.dueStory()[0]; key && this.state === state; key = this.dueStory()[0]) {
        await this.dialogue.play(storyFor(key));
        this.markSeen(key);
      }
    } finally {
      this.telling = false;
    }
  }

  private markSeen(key: string) {
    if (!this.save.seen.includes(key)) this.save.seen.push(key);
    this.persist();
  }

  showSongbook() {
    const { total } = this.islandStates();
    this.screens.showSongbook((i) => this.isOpen(i, total), this.mine.map((m) => m.stage));
  }

  async importFile(file: File) {
    try {
      if (file.size > 5 * 1024 * 1024) throw Error("That file is over 5 MB.");
      const piece = /\.(mid|midi)$/i.test(file.name)
        ? parseMidi(await file.arrayBuffer(), file.name.replace(/\.[^.]+$/, ""))
        : parseXml(await file.text(), file.name.replace(/\.[^.]+$/, ""));
      const { stage } = importedStage({ ...piece, id: file.name + file.size });
      this.mine = [...this.mine.filter((m) => m.stage.id !== stage.id), { stage, piece }];
      this.screens.songbook.hidden = true;
      this.screens.openSetup(undefined, stage);
      this.screens.toast(`♪ <b translate="no">${escapeHtml(stage.title)}</b> is ready to play.`);
    } catch (error) {
      this.screens.toast(`Couldn't read that score: ${escapeHtml((error as Error).message)}`, "warn", 5000);
    }
  }

  async play(choice: StageChoice) {
    if (this.busy) return;
    this.busy = true;
    this.lastChoice = choice;
    this.settings.difficulty = choice.difficulty;
    this.settings.mode = choice.mode;
    this.settings.practiceSpeed = choice.speed;
    this.settings.keepMelody[choice.mode] = choice.keepMelody;
    this.settings.laneKeys = choice.laneKeys;
    this.persist();
    try {
      this.dialogue.dismiss();
      this.state = "loading";
      this.screens.hidePanel();
      this.screens.results.hidden = true;
      this.screens.pause.hidden = true;
      this.screens.mapBar.hidden = true;
      this.screens.labels.hidden = true;
      this.screens.loading.hidden = false;
      this.hud.hide(); // the last run's buttons must not be tappable while loading
      this.screens.setLoading("Freeing the stillnotes…");
      await this.bank.init();
      this.music.stop();
      const mine = this.mine.find((m) => m.stage.id === choice.stage.id);
      const piece = mine ? mine.piece : await loadSong(choice.stage);
      if (this.bank.pianoState !== "ready") {
        // After a failed download, retry quietly in the background instead of making
        // every stage wait for another 20-second timeout.
        if (this.bank.pianoState === "fallback") void this.bank.loadPiano();
        else {
          this.screens.setLoading("Tuning the grand piano…");
          await this.bank.loadPiano();
        }
      }
      const programs = [...new Set(piece.notes.map((n) => n.program ?? 0).filter((p) => p > 0))];
      if (programs.some((p) => !this.bank.hasProgram(p) && !this.bank.failedProgram(p))) {
        this.screens.setLoading("The orchestra is taking its seats…");
        await this.bank.loadPrograms(programs);
      }
      // The finale is for the real last stage: not when the crown is only open
      // through "open every island" (it then plays once the gate is met).
      if (choice.island?.id === "crown" && !this.save.seen.includes("finale") && this.islandStates().total >= choice.island.gate) {
        this.screens.loading.hidden = true;
        await this.dialogue.play(storyFor("finale"));
        this.markSeen("finale");
      }
      const themeId = choice.stage.theme ?? choice.island?.theme ?? "meadow";
      this.session?.quit();
      const session = new PlaySession(
        {
          piece,
          stageId: choice.stage.id,
          title: choice.stage.title,
          difficulty: choice.difficulty,
          mode: choice.mode,
          practice: choice.practice,
          speed: choice.practice ? choice.speed : 1,
          noteSpeed: this.settings.noteSpeed,
          offsetMs: this.settings.offsetMs,
          labels: this.settings.labels,
          laptop: this.settings.laptop,
          skin: this.settings.skin,
          touch: this.touch,
          midi: !!this.input.midiName,
          reducedMotion: this.reducedMotion,
          quality: QUALITY[this.quality].particles,
          theme: THEMES[themeId],
          laneKeys: choice.laneKeys,
          keepMelody: choice.keepMelody,
        },
        this.bank,
        this.input,
        this.stage!,
        this.world!,
        this.hud,
      );
      session.onFinish = (result) => void this.finish(result);
      session.onEncoreReady = () => {
        this.screens.toast(
          this.touch
            ? "✨ ENCORE ready — tap the gold button!"
            : choice.mode === "words"
              ? "✨ ENCORE ready — press <b>Enter</b>!"
              : "✨ ENCORE ready — press <b>Space</b>!",
          "gold",
          2600,
        );
        this.bank.blip("star", 12);
      };
      session.onCheer = () => this.coda?.celebrate();
      this.session = session;
      if (this.coda) {
        this.coda.root.position.set(this.stage!.roadHalf + 1.05, 0.52, 1.3);
        this.coda.root.rotation.y = -0.45;
        this.coda.root.scale.setScalar(1.55);
      }
      this.renderer.attach(this.stage!.scene, this.stage!.camera);
      this.resize();
      const theme = THEMES[themeId];
      this.renderer.setBloom(...theme.bloom);
      this.renderer.setGrade(1.08, 1.05, theme.night ? 0.3 : 0.2);
      this.renderer.renderer.toneMappingExposure = theme.exposure;
      this.screens.loading.hidden = true;
      this.state = "play";
      // A slider left focused in a hidden panel would swallow lane keys (typing guard).
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      this.canvas.focus({ preventScroll: true });
      const place = choice.island?.name ?? "My songs";
      session.start(choice.mode === "tap" ? `${place} · tap ◀ left or right ▶` : place);
      // Tabbed away while it loaded: wait on the pause screen instead of playing to nobody.
      if (document.hidden) this.pause();
    } catch (error) {
      console.error(error);
      this.screens.toast(`That stage couldn't start: ${escapeHtml((error as Error).message)}`, "warn", 5000);
      this.enterMap();
    } finally {
      this.busy = false;
    }
  }

  pause() {
    if (this.state !== "play" || !this.session || this.session.done) return;
    if (this.session.paused) return;
    this.session.pause();
    this.screens.pause.hidden = false;
    this.screens.pause.querySelector<HTMLElement>('[data-act="resume"]')?.focus();
  }

  async resume() {
    const session = this.session;
    if (!session?.paused) return;
    this.screens.pause.hidden = true;
    this.screens.settings.hidden = true;
    await this.bank.init(); // mobile browsers may have suspended audio in the background
    if (this.session !== session || !session.paused) return;
    if (document.hidden) {
      this.screens.pause.hidden = false; // hidden again while audio woke up: stay paused
      return;
    }
    session.resume();
    this.canvas.focus();
  }

  quitToMap() {
    this.session?.quit();
    this.session = undefined;
    this.enterMap();
    const island = this.lastChoice?.island;
    if (island) this.screens.showIsland(island, true);
  }

  async restart() {
    if (!this.lastChoice) return;
    this.session?.quit();
    await this.play(this.lastChoice);
  }

  private nextStage(): StageChoice | undefined {
    const c = this.lastChoice;
    if (!c?.island) return undefined;
    const list = c.island.stages;
    const i = list.findIndex((s) => s.id === c.stage.id);
    if (i >= 0 && i + 1 < list.length) return { ...c, stage: list[i + 1] };
    const { total } = this.islandStates();
    const nextIsland = islands[islands.indexOf(c.island) + 1];
    if (nextIsland && this.isOpen(nextIsland, total))
      return { ...c, island: nextIsland, stage: nextIsland.stages[0] };
    return undefined;
  }

  async next() {
    const n = this.nextStage();
    if (!n) return this.quitToMap();
    if (n.island && n.island !== this.lastChoice?.island && !this.save.seen.includes(`arrive:${n.island.id}`)) {
      this.save.lastIsland = n.island.id;
      await this.dialogue.play(storyFor(`arrive:${n.island.id}`));
      this.markSeen(`arrive:${n.island.id}`);
    }
    await this.play(n);
  }

  private async finish(result: Result) {
    const session = this.session;
    const choice = this.lastChoice;
    if (!session || !choice) return;
    this.state = "results";
    const before = this.islandStates();
    const outcome = recordRun(this.save, choice.stage.id, choice.difficulty, choice.mode, result, choice.practice);
    this.persist();
    const after = this.islandStates();
    const tendency =
      result.total === 0
        ? ""
        : Math.abs(result.meanOffsetMs) < 12
          ? "Right on the beat — great timing!"
          : result.meanOffsetMs < 0
            ? `You tend to play ${-result.meanOffsetMs} ms early. Relax into the beat.`
            : `You tend to play ${result.meanOffsetMs} ms late. Try watching the gems a little further up the road.`;
    this.screens.showResults(result, {
      title: choice.stage.title,
      practice: choice.practice,
      newBest: outcome.newBest && !choice.practice && result.score > 0,
      firstClear: outcome.firstClear,
      hasNext: !!this.nextStage(),
      freed: result.counts.perfect + result.counts.great + result.counts.good,
      tendency,
      calibrate: !choice.practice && result.total >= 10 && Math.abs(result.meanOffsetMs) > 60,
      extra: session.summary(),
    });
    this.coda?.celebrate();
    if (result.stars > 0 && !choice.practice) {
      for (let i = 0; i < result.stars; i++) setTimeout(() => this.bank.blip("star", i * 4), 350 + i * 280);
      const colors = [new THREE.Color("#ff4f4f"), new THREE.Color("#ffd02a"), new THREE.Color("#2fb2ff"), new THREE.Color("#5fd84a")];
      for (let i = 0; i < 4; i++)
        setTimeout(() => this.stage?.particles.firework((i - 1.5) * 12, 18 + i * 2, -50 - i * 8, colors, 120), i * 350);
    }
    // Story beats for islands restored by this clear.
    const island = choice.island;
    if (island && before.states[island.id] !== "restored" && after.states[island.id] === "restored") {
      this.pendingCelebration = island.id;
      await wait(1800);
      // Still on this result: tell it here. If the player moved on (retry, next,
      // map), the save still has it due and the next map visit tells it.
      if (this.state === "results" && this.session === session) await this.tellDueStory("results");
      else if ((this.state as State) === "map") void this.tellDueStory("map");
    }
  }

  // ------------------------------------------------------------ settings

  applySettings(next: Settings) {
    const qualityChanged = next.quality !== this.settings.quality;
    const openChanged = next.openAll !== this.settings.openAll;
    this.save.settings = next;
    this.bank.setVolumes(next.music, next.effects);
    if (qualityChanged) this.applyQuality();
    this.stage?.applySkin(next.skin);
    this.map?.ship?.setLacquer(SKINS.find((s) => s.id === next.skin)?.color ?? "#e8282f");
    if (openChanged) this.refreshMap(true);
    // Sliders fire on every pixel of a drag: write storage once it settles.
    clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => this.persist(), 250);
  }

  private persistTimer = 0;

  async connectMidi() {
    try {
      const names = await this.input.connectMidi();
      this.screens.setMidiStatus(names.length ? `Connected: ${names.join(", ")}` : "No MIDI keyboard found. Plug one in and try again.");
      if (names.length) this.screens.toast("🎹 MIDI keyboard connected — try <b>Real piano</b> keys!");
    } catch (error) {
      this.screens.setMidiStatus((error as Error).message);
    }
  }

  /** Eight clicks at 100 BPM; the player taps along; the median error becomes the offset. */
  private calibrating = false;

  async calibrate() {
    // One run at a time: taps on the button itself must not start another run.
    if (this.calibrating) return;
    this.calibrating = true;
    const button = this.screens.settings.querySelector<HTMLButtonElement>('[data-act="calibrate"]');
    if (button) button.disabled = true;
    try {
      await this.runCalibration();
    } finally {
      this.calibrating = false;
      const again = this.screens.settings.querySelector<HTMLButtonElement>('[data-act="calibrate"]');
      if (again) again.disabled = false;
    }
  }

  private async runCalibration() {
    await this.bank.init();
    const interval = 0.6;
    const start = this.bank.now + 0.8;
    const clicks = Array.from({ length: 8 }, (_, i) => start + i * interval);
    for (const at of clicks) this.bank.note(84, at, 0.12, 0.9);
    this.screens.toast("🎯 Tap <b>Space</b> or the screen on each click…", "", 5200);
    const deltas: number[] = [];
    const tap = (at: number) => {
      const heard = this.bank.heardAt(at);
      const nearest = clicks.reduce((a, b) => (Math.abs(b - heard) < Math.abs(a - heard) ? b : a));
      if (Math.abs(nearest - heard) < interval / 2) deltas.push(heard - nearest);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        tap(e.timeStamp);
      }
    };
    const onPointer = (e: PointerEvent) => tap(e.timeStamp);
    addEventListener("keydown", onKey, true);
    addEventListener("pointerdown", onPointer, true);
    await wait((0.8 + clicks.length * interval + 0.6) * 1000);
    removeEventListener("keydown", onKey, true);
    removeEventListener("pointerdown", onPointer, true);
    if (deltas.length < 4) {
      this.screens.toast("Not enough taps — try calibrating again.", "warn");
      return;
    }
    deltas.sort((a, b) => a - b);
    const median = deltas[Math.floor(deltas.length / 2)];
    const offset = Math.max(-200, Math.min(200, Math.round((median * 1000) / 5) * 5));
    this.applySettings({ ...this.settings, offsetMs: offset });
    this.screens.renderSettings(this.settings, this.stars(), this.input.midiName);
    this.screens.toast(`Timing offset set to <b>${offset} ms</b>.`);
  }

  // ------------------------------------------------------------ frame

  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.resize(w, h);
    if (this.state === "play" || this.state === "results" || this.state === "loading") this.stage?.fitCamera(w / h);
    if (this.map) {
      this.map.camera.aspect = w / h;
      this.map.camera.updateProjectionMatrix();
    }
    this.viewport(h, this.renderer.pixelRatio);
  }

  private viewport(h: number, pr: number) {
    this.map?.particles.setViewport(h, pr);
    this.stage?.particles.setViewport(h, pr);
    this.stage?.weather.setViewport(h, pr);
  }

  private frame() {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const time = now / 1000;
    if (this.state === "title" || this.state === "map" || (this.state === "loading" && !this.session)) {
      this.map?.update(dt, time);
      if (this.state === "map" && this.map)
        for (const i of islands) this.screens.placeLabel(i.id, this.map.screenOf(i.id, innerWidth, innerHeight));
    } else if (this.session) {
      this.session.update(dt);
      this.coda?.update(dt, time, this.session.beat, this.session.judge.harmony);
      if (this.state === "results" && this.stage && !this.reducedMotion) this.stage.outro = Math.min(1, this.stage.outro + dt / 3);
    }
    this.renderer.render();
    this.renderer.adapt(dt);
  }

  // ------------------------------------------------------------ test hooks

  debugHooks() {
    return {
      app: this,
      state: () => this.state,
      stages: () => allStages.map((s) => s.stage.id),
      findStage,
      approachFor,
      autoplay: (on = true) => {
        if (this.session) this.session.autoplay = on;
      },
      play: (
        stageId: string,
        difficulty: StageChoice["difficulty"] = "easy",
        mode: StageChoice["mode"] = "lanes",
        practice = false,
        extra: Partial<StageChoice> = {},
      ) => {
        const found = findStage(stageId);
        if (!found) throw Error(`Unknown stage ${stageId}`);
        return this.play({
          island: found.island,
          stage: found.stage,
          difficulty,
          mode,
          practice,
          speed: 0.75,
          keepMelody: this.settings.keepMelody[mode],
          laneKeys: this.settings.laneKeys,
          ...extra,
        });
      },
    };
  }
}

function safeStorage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A tiny studio-light room for PMREM reflections (no external HDR needed). */
function roomEnvironment() {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  geometry.deleteAttribute("uv");
  const room = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: "#8fa3c8", side: THREE.BackSide }));
  room.scale.set(20, 12, 20);
  room.position.y = 5;
  scene.add(room);
  const light = (color: string, intensity: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    scene.add(m);
  };
  light("#fff2dc", 9, 0, 10.5, 0, 8, 0.2, 8);
  light("#ffd6a0", 4, -9.5, 5, 0, 0.2, 5, 8);
  light("#bcd8ff", 3.5, 9.5, 5, 0, 0.2, 5, 8);
  light("#ffffff", 2, 0, 4, -9.5, 8, 4, 0.2);
  return scene;
}
