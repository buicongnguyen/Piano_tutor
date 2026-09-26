// Menu screens: title, map overlay (top bar, island labels, island panel with
// stage setup), songbook, loading, pause, results and settings.
import type { Difficulty, KeyMode } from "../chart";
import { islands, islandStars, type Island, type Stage } from "../campaign";
import type { Result } from "../judge";
import type { SaveData, Settings } from "../save";
import { recordKey } from "../save";
import { el, esc, stars } from "./dom";
import { LANE_PRESETS, laneLabels, type LanePreset } from "../input";

export type StageChoice = {
  island?: Island;
  stage: Stage;
  difficulty: Difficulty;
  mode: KeyMode;
  practice: boolean;
  speed: number;
  keepMelody: boolean;
  laneKeys: LanePreset;
};

const WORD_HINT: Record<Difficulty, string> = { easy: "home-row words", normal: "everyday words", hard: "long words" };
const DIFF: { id: Difficulty; name: string; hint: string }[] = [
  { id: "easy", name: "Easy", hint: "4 lanes · relaxed" },
  { id: "normal", name: "Normal", hint: "6 lanes · the melody" },
  { id: "hard", name: "Hard", hint: "6 lanes · chords" },
];
export const SKINS: { id: string; name: string; color: string; stars: number }[] = [
  { id: "cherry", name: "Cherry", color: "#e8282f", stars: 0 },
  { id: "ocean", name: "Ocean", color: "#1f6fe8", stars: 10 },
  { id: "sunflower", name: "Sunflower", color: "#ffb81f", stars: 25 },
  { id: "mint", name: "Mint", color: "#12b39a", stars: 40 },
  { id: "grape", name: "Grape", color: "#7a3cff", stars: 60 },
  { id: "midnight", name: "Midnight", color: "#1b1f4b", stars: 90 },
];

export class Screens {
  readonly root: HTMLElement;
  readonly title: HTMLElement;
  readonly mapBar: HTMLElement;
  readonly labels: HTMLElement;
  readonly panel: HTMLElement;
  readonly loading: HTMLElement;
  readonly pause: HTMLElement;
  readonly results: HTMLElement;
  readonly settings: HTMLElement;
  readonly songbook: HTMLElement;
  readonly toastBox: HTMLElement;
  private labelEls = new Map<string, HTMLElement>();
  choice?: StageChoice;

  // Callbacks wired by the app.
  onStart?: () => void;
  onIsland?: (id: string) => void;
  onPlay?: (choice: StageChoice) => void;
  onClosePanel?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onQuit?: () => void;
  onNext?: () => void;
  onSettings?: (patch: Partial<Settings>) => void;
  onOpenSettings?: () => void;
  onSongbook?: () => void;
  onImport?: (file: File) => void;
  onMidi?: () => void;
  onCalibrate?: () => void;
  onReset?: () => void;
  onClick?: () => void;

  constructor(parent: HTMLElement) {
    this.root = el("div", "screens");
    parent.append(this.root);

    this.title = el(
      "section",
      "title-screen",
      `<div class="title-logo">
         <span class="title-kicker">STILLNOTE</span>
         <h1><span>E</span><span>n</span><span>c</span><span>o</span><span>r</span><span>e</span></h1>
         <p>Play the Silent Isles back to life</p>
       </div>
       <button class="btn btn-big btn-sun title-play" data-act="start">▶&nbsp; Play</button>
       <p class="title-hint">Press any key · Headphones recommended</p>
       <nav class="title-links">
         <button class="btn btn-ghost" data-act="settings">⚙ Settings</button>
         <a class="btn btn-ghost" href="./studio.html">🎹 Classic Studio</a>
       </nav>`,
    );
    this.title.hidden = true;
    // Tap anywhere on the title to begin (links and buttons keep their own actions).
    this.title.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest("a, button")) this.onStart?.();
    });

    this.mapBar = el(
      "header",
      "map-bar",
      `<div class="map-brand">Stillnote <b>Encore</b></div>
       <div class="map-stats">
         <span class="chip chip-star" data-el="stars">★ 0</span>
         <span class="chip chip-note" data-el="freed">♪ 0</span>
       </div>
       <div class="map-actions">
         <button class="btn btn-small" data-act="songbook">📖 Songbook</button>
         <button class="btn btn-small btn-icon" data-act="settings" aria-label="Settings">⚙</button>
       </div>
       <div class="map-goal" data-el="goal"></div>`,
    );
    this.mapBar.hidden = true;
    this.labels = el("div", "map-labels");
    this.labels.hidden = true;
    for (const island of islands) {
      const label = el("button", "island-label");
      label.dataset.island = island.id;
      this.labels.append(label);
      this.labelEls.set(island.id, label);
    }

    this.panel = el("aside", "island-panel");
    this.panel.hidden = true;
    this.loading = el("div", "loading-screen", `<div class="loading-card"><div class="loading-spinner">♪</div><p data-el="text">Tuning the Encore…</p><div class="loading-bar"><i></i></div></div>`);
    this.loading.hidden = true;
    this.pause = el(
      "div",
      "modal pause-screen",
      `<div class="modal-card"><h2>Paused</h2>
        <button class="btn btn-big btn-sun" data-act="resume">▶ Resume</button>
        <button class="btn" data-act="restart">↺ Restart</button>
        <button class="btn" data-act="settings">⚙ Settings</button>
        <button class="btn btn-ghost" data-act="quit">⌂ Back to map</button></div>`,
    );
    this.pause.hidden = true;
    this.results = el("div", "modal results-screen");
    this.results.hidden = true;
    this.settings = el("div", "modal settings-screen");
    this.settings.hidden = true;
    this.songbook = el("div", "modal songbook-screen");
    this.songbook.hidden = true;
    this.toastBox = el("div", "toasts");
    this.root.append(this.title, this.mapBar, this.labels, this.panel, this.loading, this.pause, this.results, this.songbook, this.settings, this.toastBox);

    this.root.addEventListener("click", (e) => this.click(e));
  }

  private click(e: Event) {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act], .island-label");
    if (!target) return;
    if (target.classList.contains("island-label")) {
      this.onClick?.();
      this.onIsland?.(target.dataset.island!);
      return;
    }
    const act = target.dataset.act!;
    this.onClick?.();
    switch (act) {
      case "start":
        this.onStart?.();
        break;
      case "settings":
        this.onOpenSettings?.(); // re-render with live values and newly unlocked skins
        this.settings.hidden = false;
        this.settings.querySelector<HTMLElement>("input,select,button")?.focus();
        break;
      case "close-settings":
        this.settings.hidden = true;
        break;
      case "songbook":
        this.onSongbook?.();
        break;
      case "close-songbook":
        this.songbook.hidden = true;
        break;
      case "close-panel":
        this.onClosePanel?.();
        break;
      case "stage": {
        const island = islands.find((i) => i.id === target.dataset.island);
        const stage = island?.stages.find((s) => s.id === target.dataset.stage) ?? this.extraStages.find((s) => s.id === target.dataset.stage);
        if (stage) {
          this.songbook.hidden = true;
          this.openSetup(island, stage);
        }
        break;
      }
      case "back-stages":
        if (this.choice?.island) this.onIsland?.(this.choice.island.id);
        else this.onClosePanel?.();
        break;
      case "difficulty":
        if (this.choice) this.choice.difficulty = target.dataset.value as Difficulty;
        this.refreshSetup();
        break;
      case "mode":
        if (this.choice) {
          this.choice.mode = target.dataset.value as KeyMode;
          this.choice.keepMelody = this.save!.settings.keepMelody[this.choice.mode];
        }
        this.refreshSetup();
        break;
      case "lanekeys":
        if (this.choice) this.choice.laneKeys = target.dataset.value as LanePreset;
        this.refreshSetup();
        break;
      case "keepmelody":
        if (this.choice) this.choice.keepMelody = !this.choice.keepMelody;
        this.refreshSetup();
        break;
      case "practice":
        if (this.choice) this.choice.practice = !this.choice.practice;
        this.refreshSetup();
        break;
      case "go":
        if (this.choice) this.onPlay?.(this.choice);
        break;
      case "resume":
        this.onResume?.();
        break;
      case "restart":
        this.onRestart?.();
        break;
      case "quit":
        this.onQuit?.();
        break;
      case "next":
        this.onNext?.();
        break;
      case "midi":
        this.onMidi?.();
        break;
      case "calibrate":
        this.onCalibrate?.();
        break;
      case "reset":
        if (confirm("Reset all stars, scores and story progress? Settings are kept.")) this.onReset?.();
        break;
      case "import":
        this.pickFile();
        break;
    }
  }

  // ------------------------------------------------------------ map

  private save?: SaveData;
  private best: Record<string, number> = {};
  private total = 0;
  extraStages: Stage[] = [];

  setProgress(save: SaveData, best: Record<string, number>, total: number, nextGate?: Island) {
    this.save = save;
    this.best = best;
    this.total = total;
    this.mapBar.querySelector('[data-el="stars"]')!.textContent = `★ ${total}`;
    this.mapBar.querySelector('[data-el="freed"]')!.textContent = `♪ ${save.freed.toLocaleString("en-US")}`;
    const goal = this.mapBar.querySelector<HTMLElement>('[data-el="goal"]')!;
    goal.textContent = nextGate ? `${nextGate.gate - total} more ★ to open ${nextGate.name}` : "Every island is open!";
    for (const island of islands) {
      const label = this.labelEls.get(island.id)!;
      const open = save.settings.openAll || total >= island.gate;
      const got = islandStars(island, best);
      label.classList.toggle("locked", !open);
      label.innerHTML = open
        ? `<b>${esc(island.name)}</b><span>★ ${got}/${island.stages.length * 3}</span>`
        : `<b>${esc(island.name)}</b><span>🔒 ${island.gate} ★</span>`;
      label.setAttribute("aria-label", open ? `${island.name}, ${got} of ${island.stages.length * 3} stars` : `${island.name}, locked: needs ${island.gate} stars`);
    }
  }

  placeLabel(id: string, pos?: { x: number; y: number }) {
    const label = this.labelEls.get(id);
    if (!label) return;
    if (!pos) {
      label.style.visibility = "hidden";
      return;
    }
    label.style.visibility = "visible";
    label.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  showIsland(island: Island, open: boolean) {
    this.choice = undefined;
    const settings = this.save!.settings;
    const rows = island.stages
      .map((s, i) => {
        const got = this.best[s.id] ?? 0;
        const rec = this.save!.records[recordKey(s.id, settings.difficulty, settings.mode)];
        return `<button class="stage-row" data-act="stage" data-island="${island.id}" data-stage="${s.id}" ${open ? "" : "disabled"}>
          <span class="stage-num">${i + 1}</span>
          <span class="stage-info"><b>${esc(s.title)}</b><small>${esc(s.composer)}</small></span>
          <span class="stage-stars">${stars(got)}${rec?.fullCombo ? '<em class="fc" title="Full combo">👑</em>' : ""}</span>
        </button>`;
      })
      .join("");
    this.panel.innerHTML = `
      <div class="panel-head theme-${island.theme}">
        <button class="btn btn-icon panel-close" data-act="close-panel" aria-label="Close">✕</button>
        <span class="panel-kicker">Island ${islands.indexOf(island) + 1} · ${esc(island.keeper)}</span>
        <h2>${esc(island.name)}</h2>
        <p>${esc(island.tagline)}</p>
        <div class="panel-progress">${stars(Math.round((islandStars(island, this.best) / (island.stages.length * 3)) * 3))}
          <span>${islandStars(island, this.best)} / ${island.stages.length * 3} stars</span></div>
      </div>
      ${open ? "" : `<p class="panel-locked">🔒 The Hush's fog covers this island. Earn <b>${island.gate} ★</b> to open it (you have ${this.total}).</p>`}
      <div class="stage-list">${rows}</div>`;
    this.panel.hidden = false;
    this.panel.querySelector<HTMLElement>(".stage-row:not([disabled])")?.focus();
  }

  openSetup(island: Island | undefined, stage: Stage) {
    const s = this.save!.settings;
    this.choice = {
      island,
      stage,
      difficulty: s.difficulty,
      mode: s.mode,
      practice: false,
      speed: s.practiceSpeed,
      keepMelody: s.keepMelody[s.mode],
      laneKeys: s.laneKeys,
    };
    this.refreshSetup();
  }

  refreshSetup() {
    const c = this.choice!;
    const rec = (d: Difficulty, m: KeyMode) => this.save!.records[recordKey(c.stage.id, d, m)];
    const current = rec(c.difficulty, c.mode);
    this.panel.innerHTML = `
      <div class="panel-head theme-${c.island?.theme ?? "meadow"}">
        <button class="btn btn-icon panel-close" data-act="back-stages" aria-label="Back">←</button>
        <span class="panel-kicker">${esc(c.island?.name ?? "My songs")}</span>
        <h2>${esc(c.stage.title)}</h2>
        <p>${esc(c.stage.composer)} — ${esc(c.stage.blurb)}</p>
      </div>
      <div class="setup">
        <h3>Difficulty</h3>
        <div class="seg">${DIFF.map(
          (d) => `<button data-act="difficulty" data-value="${d.id}" aria-pressed="${c.difficulty === d.id}">
            <b>${d.name}</b><small>${c.mode === "piano" ? d.hint.replace(/\d lanes · /, "") : c.mode === "words" ? WORD_HINT[d.id] : c.mode === "lanes" ? `${laneLabels(d.id === "easy" ? 4 : 6, c.laneKeys).join(" ")}` : d.hint}</small>
            <span class="seg-stars">${stars(rec(d.id, c.mode)?.stars ?? 0)}</span></button>`,
        ).join("")}</div>
        <h3>Keys</h3>
        <div class="seg seg-3">
          <button data-act="mode" data-value="lanes" aria-pressed="${c.mode === "lanes"}"><b>🎮 Lanes</b><small>Lanes follow the melody</small></button>
          <button data-act="mode" data-value="piano" aria-pressed="${c.mode === "piano"}"><b>🎹 Real piano</b><small>Every key is the real note</small></button>
          <button data-act="mode" data-value="words" aria-pressed="${c.mode === "words"}"><b>⌨️ Words</b><small>Type the words to the beat</small></button>
        </div>
        ${
          c.mode === "lanes"
            ? `<div class="seg seg-3 seg-mini" role="group" aria-label="Lane keys">${(Object.keys(LANE_PRESETS) as LanePreset[])
                .map((id) => `<button data-act="lanekeys" data-value="${id}" aria-pressed="${c.laneKeys === id}"><b>${LANE_PRESETS[id][4].join(" ")}</b><small>${LANE_PRESETS[id].name.split("· ")[1]}</small></button>`)
                .join("")}</div>`
            : ""
        }
        <label class="toggle"><input type="checkbox" data-act="keepmelody" ${c.keepMelody ? "checked" : ""}>
          <span><b>🎵 Keep the song playing</b> — the music never stops; misses only show on screen.</span></label>
        <label class="toggle"><input type="checkbox" data-act="practice" ${c.practice ? "checked" : ""}>
          <span><b>Practice</b> — the road waits for each note. No score, no stars.</span></label>
        <label class="speed" ${c.practice ? "" : "hidden"}>Practice speed <input type="range" min="0.5" max="1" step="0.05" value="${c.speed}" data-el="speed"> <output>${Math.round(c.speed * 100)}%</output></label>
        <div class="setup-best">${current ? `Best <b>${current.score.toLocaleString("en-US")}</b> · ${current.rank} · ${Math.round(current.accuracy * 100)}%${current.fullCombo ? " · 👑 Full combo" : ""}` : "Not cleared yet at this setting."}</div>
        <button class="btn btn-big btn-sun" data-act="go">▶ ${c.practice ? "Practice" : "Play"}</button>
      </div>`;
    const speed = this.panel.querySelector<HTMLInputElement>('[data-el="speed"]');
    if (speed)
      speed.oninput = () => {
        c.speed = Number(speed.value);
        speed.nextElementSibling!.textContent = `${Math.round(c.speed * 100)}%`;
      };
    this.panel.hidden = false;
    this.panel.querySelector<HTMLElement>('[data-act="go"]')?.focus();
  }

  hidePanel() {
    this.panel.hidden = true;
  }

  // ------------------------------------------------------------ songbook

  showSongbook(open: (island: Island) => boolean, mine: Stage[]) {
    const section = (island: Island) => `
      <section class="book-island theme-${island.theme}"><h3>${esc(island.name)} ${open(island) ? "" : "🔒"}</h3>
        ${island.stages
          .map(
            (s) => `<button class="book-row" data-act="stage" data-island="${island.id}" data-stage="${s.id}" ${open(island) ? "" : "disabled"}>
            <span><b>${esc(s.title)}</b><small>${esc(s.composer)}</small></span><span class="stage-stars">${stars(this.best[s.id] ?? 0)}</span></button>`,
          )
          .join("")}</section>`;
    this.extraStages = mine;
    this.songbook.innerHTML = `<div class="modal-card wide">
      <header class="modal-head"><h2>📖 Songbook</h2><button class="btn btn-icon" data-act="close-songbook" aria-label="Close">✕</button></header>
      <div class="book">
        <section class="book-island mine"><h3>My songs</h3>
          <p class="small">Import a MIDI or MusicXML file — Encore charts it for every difficulty. Files stay on this device.</p>
          ${mine.map((s) => `<button class="book-row" data-act="stage" data-stage="${s.id}"><span><b>${esc(s.title)}</b><small>${esc(s.composer)}</small></span></button>`).join("")}
          <button class="btn btn-small" data-act="import">＋ Import a song</button>
        </section>
        ${islands.map(section).join("")}
      </div></div>`;
    this.songbook.hidden = false;
  }

  private pickFile() {
    const input = el("input");
    input.type = "file";
    input.accept = ".mid,.midi,.xml,.musicxml";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) this.onImport?.(file);
    };
    input.click();
  }

  // ------------------------------------------------------------ results

  showResults(r: Result, info: { title: string; practice: boolean; newBest: boolean; firstClear: boolean; hasNext: boolean; freed: number; tendency: string; extra?: string }) {
    const accuracy = Math.round(r.accuracy * 1000) / 10;
    this.results.innerHTML = `<div class="modal-card results-card ${info.practice ? "practice" : ""}">
      <span class="results-kicker">${info.practice ? "Practice complete" : info.firstClear ? "Stage cleared!" : "Results"}</span>
      <h2>${esc(info.title)}</h2>
      ${
        info.practice
          ? `<p class="results-practice">You played all <b>${r.counts.perfect}</b> notes. When you're ready, play it for stars!</p>`
          : `<div class="results-top">
          <div class="results-stars">${[0, 1, 2].map((i) => `<i class="big-star ${i < r.stars ? "on" : ""}" style="--d:${0.25 + i * 0.28}s">★</i>`).join("")}</div>
          <div class="results-rank rank-${r.rank.replace("+", "plus")}">${r.rank}</div>
        </div>
        <div class="results-score"><span>Score</span><b data-count="${r.score}">0</b>${info.newBest ? '<em class="new-best">NEW BEST!</em>' : ""}</div>
        <div class="results-grid">
          <div><span>Accuracy</span><b>${accuracy}%</b></div>
          <div><span>Max combo</span><b>${r.maxCombo}${r.fullCombo ? " 👑" : ""}</b></div>
          <div class="j-perfect"><span>Perfect</span><b>${r.counts.perfect}</b></div>
          <div class="j-great"><span>Great</span><b>${r.counts.great}</b></div>
          <div class="j-good"><span>Good</span><b>${r.counts.good}</b></div>
          <div class="j-miss"><span>Miss</span><b>${r.counts.miss}</b></div>
        </div>
        <p class="results-tip">${esc(info.tendency)}</p>${info.extra ? `<p class="results-extra">${esc(info.extra)}</p>` : ""}`
      }
      <p class="results-freed">♪ ${info.freed} stillnotes freed</p>
      <div class="results-actions">
        <button class="btn" data-act="restart">↺ Retry</button>
        ${info.hasNext ? '<button class="btn btn-sun" data-act="next">Next stage ▶</button>' : ""}
        <button class="btn btn-ghost" data-act="quit">⌂ Map</button>
      </div></div>`;
    this.results.hidden = false;
    // Count the score up.
    const b = this.results.querySelector<HTMLElement>("[data-count]");
    if (b) {
      const target = Number(b.dataset.count);
      const start = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / 1400);
        b.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))).toLocaleString("en-US");
        if (t < 1 && !this.results.hidden) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    this.results.querySelector<HTMLElement>('[data-act="next"]')?.focus() ??
      this.results.querySelector<HTMLElement>('[data-act="restart"]')?.focus();
  }

  // ------------------------------------------------------------ settings

  renderSettings(s: Settings, totalStars: number, midiName: string) {
    this.settings.innerHTML = `<div class="modal-card wide">
      <header class="modal-head"><h2>⚙ Settings</h2><button class="btn btn-icon" data-act="close-settings" aria-label="Close">✕</button></header>
      <div class="settings-grid">
        <label>Note speed <input type="range" min="1" max="10" step="1" name="noteSpeed" value="${s.noteSpeed}"><output>${s.noteSpeed}</output></label>
        <label>Music volume <input type="range" min="0" max="1" step="0.05" name="music" value="${s.music}"><output>${Math.round(s.music * 100)}%</output></label>
        <label>Effects volume <input type="range" min="0" max="1" step="0.05" name="effects" value="${s.effects}"><output>${Math.round(s.effects * 100)}%</output></label>
        <label>Timing offset <input type="range" min="-200" max="200" step="5" name="offsetMs" value="${s.offsetMs}"><output>${s.offsetMs} ms</output></label>
        <div class="settings-row"><button class="btn btn-small" data-act="calibrate">🎯 Calibrate timing</button>
          <small>Tap along with 8 clicks; Encore sets the offset for your speakers and keyboard.</small></div>
        <label>Graphics <select name="quality">
          ${["auto", "low", "medium", "high"].map((q) => `<option value="${q}" ${s.quality === q ? "selected" : ""}>${q[0].toUpperCase() + q.slice(1)}</option>`).join("")}
        </select></label>
        <label>Motion <select name="motion">
          <option value="auto" ${s.motion === "auto" ? "selected" : ""}>Follow system</option>
          <option value="full" ${s.motion === "full" ? "selected" : ""}>Full</option>
          <option value="reduced" ${s.motion === "reduced" ? "selected" : ""}>Reduced</option>
        </select></label>
        <label>Lane keys <select name="laneKeys">
          ${(Object.keys(LANE_PRESETS) as LanePreset[]).map((id) => `<option value="${id}" ${s.laneKeys === id ? "selected" : ""}>${LANE_PRESETS[id].name}</option>`).join("")}
        </select></label>
        <label>Laptop keys (real piano) <select name="laptop">
          <option value="chromatic" ${s.laptop === "chromatic" ? "selected" : ""}>Chromatic · A W S E D F T G…</option>
          <option value="home" ${s.laptop === "home" ? "selected" : ""}>Home row · A S D F / J K L ;</option>
        </select></label>
        <label class="toggle"><input type="checkbox" name="labels" ${s.labels ? "checked" : ""}><span>Note names on piano keys</span></label>
        <label class="toggle"><input type="checkbox" name="openAll" ${s.openAll ? "checked" : ""}><span>Open all islands (free play)</span></label>
        <div class="settings-row"><button class="btn btn-small" data-act="midi">🎹 Connect MIDI keyboard</button>
          <small data-el="midi">${midiName ? `Connected: ${esc(midiName)}` : "Plug in a USB/Bluetooth MIDI keyboard (Chrome, Edge)."}</small></div>
        <div class="settings-row skins"><span>Piano lacquer</span>
          ${SKINS.map((k) => `<label class="skin ${totalStars >= k.stars ? "" : "locked"}" title="${k.name}${totalStars >= k.stars ? "" : ` · ${k.stars} ★`}">
            <input type="radio" name="skin" value="${k.id}" ${s.skin === k.id ? "checked" : ""} ${totalStars >= k.stars ? "" : "disabled"}>
            <i style="background:${k.color}"></i><small>${totalStars >= k.stars ? k.name : `🔒${k.stars}★`}</small></label>`).join("")}
        </div>
        <div class="settings-row links"><a class="btn btn-small btn-ghost" href="./studio.html">🎹 Classic Studio</a>
          <button class="btn btn-small btn-ghost danger" data-act="reset">Reset progress</button></div>
      </div>
      <p class="credits small">Music: public-domain and Creative Commons editions (Mutopia, Wikimedia, nationalanthems.info, OpenGameArt) — see <a href="./music/SOURCES.md" target="_blank" rel="noopener">sources</a>. Piano samples: Splendid Grand via smplr; instruments: MusyngKite (CC BY-SA 3.0). All 3D art made in Blender for Encore.</p>
    </div>`;
    // Only the fields this panel owns: the app merges them into the live settings,
    // so difficulty, key mode and practice speed chosen elsewhere are never reverted.
    const read = (): Partial<Settings> => {
      const f = (n: string) => this.settings.querySelector<HTMLInputElement>(`[name="${n}"]`)!;
      const skin = this.settings.querySelector<HTMLInputElement>('[name="skin"]:checked');
      return {
        noteSpeed: Number(f("noteSpeed").value),
        music: Number(f("music").value),
        effects: Number(f("effects").value),
        offsetMs: Number(f("offsetMs").value),
        quality: f("quality").value as Settings["quality"],
        motion: f("motion").value as Settings["motion"],
        laptop: f("laptop").value as Settings["laptop"],
        laneKeys: f("laneKeys").value as LanePreset,
        labels: f("labels").checked,
        openAll: f("openAll").checked,
        skin: skin?.value ?? s.skin,
      };
    };
    this.settings.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((input) => {
      input.addEventListener("input", () => {
        const out = input.nextElementSibling;
        if (out?.tagName === "OUTPUT") {
          const v = Number(input.value);
          out.textContent = input.name === "offsetMs" ? `${v} ms` : input.name === "noteSpeed" ? String(v) : `${Math.round(v * 100)}%`;
        }
        this.onSettings?.(read());
      });
    });
  }

  setMidiStatus(text: string) {
    const e = this.settings.querySelector('[data-el="midi"]');
    if (e) e.textContent = text;
  }

  // ------------------------------------------------------------ misc

  setLoading(text: string, progress = -1) {
    this.loading.querySelector('[data-el="text"]')!.textContent = text;
    const bar = this.loading.querySelector<HTMLElement>(".loading-bar i")!;
    bar.style.transform = `scaleX(${progress < 0 ? 0.3 : progress})`;
    bar.parentElement!.classList.toggle("indeterminate", progress < 0);
  }

  toast(html: string, kind = "", ms = 3200) {
    const t = el("div", `toast ${kind}`, html);
    this.toastBox.append(t);
    setTimeout(() => t.classList.add("out"), ms);
    setTimeout(() => t.remove(), ms + 500);
  }
}
