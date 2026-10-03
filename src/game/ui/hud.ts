// In-play heads-up display (DOM over the canvas): score, multiplier, combo,
// Harmony and Encore meters, song progress with star ticks, judgement pops,
// countdown, practice hints and milestone banners.
import { STAR_ACCURACY } from "../judge";

export type HudState = {
  score: number;
  combo: number;
  multiplier: number;
  harmony: number;
  encore: number;
  encoreActive: boolean;
  progress: number;
  stars: number;
  waiting: boolean;
  hint: string;
};

/** Highest celebration reached, including several simultaneous hits in one frame. */
export function streakMilestone(combo: number) {
  if (combo >= 100) return Math.floor(combo / 50) * 50;
  return combo >= 50 ? 50 : combo >= 25 ? 25 : combo >= 10 ? 10 : 0;
}

const LABEL: Record<string, string> = { perfect: "PERFECT!", great: "GREAT", good: "GOOD", miss: "MISS", wrong: "✗ WRONG KEY" };

export class Hud {
  readonly root: HTMLElement;
  private shownScore = 0;
  private lastScoreShown = -1;
  private pops: HTMLElement[] = [];
  private popIndex = 0;
  private last: Partial<HudState> = {};
  onPause?: () => void;
  onEncore?: () => void;
  private el: Record<string, HTMLElement> = {};
  private stars?: HTMLElement[];
  private animationVersions = new WeakMap<HTMLElement, boolean>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-score panel-glass">
          <span class="hud-label">SCORE</span>
          <b data-el="score">0</b>
          <span class="hud-mult" data-el="mult">×1</span>
        </div>
        <div class="hud-song panel-glass">
          <span class="hud-song-title" data-el="title"></span>
          <div class="hud-progress-row">
            <div class="hud-progress" data-el="progress"><i data-el="progressFill"></i></div>
            <span class="hud-stars">${STAR_ACCURACY.map((_, i) => `<s data-star="${i}">★</s>`).join("")}</span>
          </div>
          <span class="hud-badges" data-el="badges"></span>
        </div>
        <button class="hud-pause" data-el="pause" aria-label="Pause">❚❚</button>
      </div>
      <div class="hud-meters">
        <div class="hud-meter harmony"><span>HARMONY</span><div class="bar"><i data-el="harmony"></i></div></div>
        <div class="hud-meter encore" data-el="encoreBox"><span>ENCORE</span><div class="bar"><i data-el="encore"></i></div>
          <em data-el="encoreReady">SPACE</em></div>
      </div>
      <div class="hud-combo" data-el="combo" data-tier="0">
        <i class="streak-ring" data-el="streakRing" aria-hidden="true"></i>
        <b data-el="comboNum">0</b><span>HIT STREAK</span>
        <em data-el="streakTag">KEEP GOING!</em>
      </div>
      <div class="hud-pops" data-el="pops"></div>
      <div class="hud-count" data-el="count"></div>
      <div class="hud-banner" data-el="banner"></div>
      <div class="hud-hint" data-el="hint"></div>
      <div class="hud-tap" data-el="tap" hidden><i data-lane="0"><b>◀</b><span>TAP</span></i><i data-lane="1"><span>TAP</span><b>▶</b></i></div>
      <div class="hud-words" data-el="words" hidden><div class="hud-word" data-el="word"></div><div class="hud-next" data-el="nextWords"></div></div>
      <button class="hud-encore-btn" data-el="encoreBtn">ENCORE!</button>`;
    parent.append(this.root);
    this.root.querySelectorAll<HTMLElement>("[data-el]").forEach((e) => (this.el[e.dataset.el!] = e));
    this.el.pause.onclick = () => this.onPause?.();
    this.el.encoreBtn.onclick = () => this.onEncore?.();
    this.el.encoreBox.onclick = () => this.onEncore?.();
    for (let i = 0; i < 14; i++) {
      const pop = document.createElement("div");
      pop.className = "hud-pop";
      this.el.pops.append(pop);
      this.pops.push(pop);
    }
  }

  begin(info: { title: string; difficulty: string; mode: string; practice: boolean; lanes: number; notes: number; excerpt: boolean; assisted: number; keepMelody?: boolean; touch?: boolean; reducedMotion?: boolean }) {
    this.root.hidden = false;
    this.shownScore = 0;
    this.lastScoreShown = -1;
    this.written.clear(); // a new stage rewrites every HUD value once
    this.last = {};
    this.el.title.textContent = info.title;
    const bits = [
      info.practice ? "Practice" : info.difficulty[0].toUpperCase() + info.difficulty.slice(1),
      info.mode === "lanes" ? `${info.lanes} lanes` : info.mode === "words" ? "Words" : info.mode === "tap" ? "Tap left & right" : "Real piano",
      `${info.notes} notes`,
    ];
    if (info.excerpt) bits.push("Excerpt");
    if (info.assisted) bits.push(`${info.assisted} assisted`);
    if (info.keepMelody) bits.push("Song keeps playing");
    this.el.words.hidden = info.mode !== "words";
    // Big left/right touch zones in Tap mode (phones and tablets).
    this.el.tap.hidden = info.mode !== "tap" || !info.touch;
    // The key that fires Encore: Enter while typing words (Space is a word gap).
    this.el.encoreReady.textContent = info.touch ? "TAP" : info.mode === "words" ? "ENTER" : "SPACE";
    this.el.word.innerHTML = "";
    this.el.nextWords.textContent = "";
    this.el.badges.textContent = bits.join(" · ");
    this.root.classList.toggle("practice", info.practice);
    this.root.classList.toggle("reduced-motion", !!info.reducedMotion);
    this.root.classList.toggle("words-mode", info.mode === "words");
    this.el.combo.classList.remove("show");
    this.el.combo.dataset.tier = "0";
    this.el.comboNum.textContent = "0";
    this.el.streakTag.textContent = "KEEP GOING!";
    this.el.streakRing.className = "streak-ring";
    this.el.score.textContent = "0";
    this.el.hint.textContent = "";
    this.el.banner.className = "hud-banner";
  }

  hide() {
    this.root.hidden = true;
  }

  // Last values written to the DOM: a frame touches only what changed (style writes,
  // class toggles and number formatting all cost on a phone's main thread).
  private written = new Map<string, string | boolean>();
  private put(key: string, value: string | boolean, write: () => void) {
    if (this.written.get(key) === value) return;
    this.written.set(key, value);
    write();
  }

  update(s: HudState) {
    // Roll the score toward its target.
    this.shownScore += (s.score - this.shownScore) * 0.25;
    if (Math.abs(s.score - this.shownScore) < 1) this.shownScore = s.score;
    const rounded = Math.round(this.shownScore);
    if (rounded !== this.lastScoreShown) {
      this.lastScoreShown = rounded;
      this.el.score.textContent = rounded.toLocaleString("en-US");
    }
    if (s.multiplier !== this.last.multiplier) {
      this.el.mult.textContent = `×${s.multiplier}`;
      this.el.mult.className = `hud-mult x${s.multiplier}`;
      if ((this.last.multiplier ?? 1) < s.multiplier) this.bump(this.el.mult);
    }
    if (s.combo !== this.last.combo) {
      this.el.comboNum.textContent = String(s.combo);
      this.el.combo.classList.toggle("show", s.combo > 0);
      const tier = s.combo >= 100 ? 4 : s.combo >= 50 ? 3 : s.combo >= 25 ? 2 : s.combo >= 10 ? 1 : 0;
      this.put("streakTier", String(tier), () => {
        this.el.combo.dataset.tier = String(tier);
        this.el.streakTag.textContent = ["KEEP GOING!", "NICE RHYTHM!", "ON FIRE!", "UNSTOPPABLE!", "LEGENDARY!"][tier];
      });
      const previous = this.last.combo ?? 0;
      if (s.combo > previous) {
        this.bump(this.el.comboNum);
        const milestone = streakMilestone(s.combo);
        if (milestone > streakMilestone(previous)) this.milestone(milestone);
      } else this.el.streakRing.classList.remove("go");
    }
    const harmony = s.harmony.toFixed(3),
      encore = s.encore.toFixed(3),
      progress = s.progress.toFixed(4);
    this.put("harmony", harmony, () => (this.el.harmony.style.transform = `scaleX(${harmony})`));
    this.put("encore", encore, () => (this.el.encore.style.transform = `scaleX(${encore})`));
    this.put("progress", progress, () => (this.el.progressFill.style.transform = `scaleX(${progress})`));
    const ready = s.encore >= 0.5 && !s.encoreActive;
    this.put("ready", ready, () => {
      this.el.encoreBox.classList.toggle("ready", ready);
      this.el.encoreBtn.classList.toggle("show", ready);
    });
    this.put("active", s.encoreActive, () => {
      this.el.encoreBox.classList.toggle("active", s.encoreActive);
      this.root.classList.toggle("encore-on", s.encoreActive);
    });
    this.stars ??= [...this.root.querySelectorAll<HTMLElement>("[data-star]")];
    this.stars.forEach((star, i) => {
      const lit = i < s.stars && s.progress > 0.05;
      this.put(`star${i}`, lit, () => star.classList.toggle("lit", lit));
    });
    if (s.hint !== this.last.hint) this.el.hint.textContent = s.hint;
    this.put("waiting", s.waiting, () => this.el.hint.classList.toggle("waiting", s.waiting));
    this.last = s;
  }


  judgement(kind: "perfect" | "great" | "good" | "miss" | "wrong", x: number, y: number, delta: number) {
    const pop = this.pops[this.popIndex++ % this.pops.length];
    const timing = kind === "great" || kind === "good" ? (delta < 0 ? "EARLY" : "LATE") : "";
    pop.innerHTML = `${LABEL[kind]}${timing ? `<small>${timing}</small>` : ""}`;
    pop.className = `hud-pop ${kind}`;
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    this.restartAnimation(pop, "popup");
  }

  /** Words mode: the current word, letter by letter, and what comes next. */
  words(letters: readonly { ch: string; state: "hit" | "miss" | "todo" }[], next: string[]) {
    let cursor = false;
    this.el.word.innerHTML = letters
      .map((l) => {
        const now = l.state === "todo" && !cursor;
        if (now) cursor = true;
        return `<span class="${l.state}${now ? " now" : ""}">${l.ch.toUpperCase()}</span>`;
      })
      .join("");
    this.el.nextWords.textContent = next.map((w) => w.toUpperCase()).join("  ·  ");
    this.bump(this.el.word);
  }

  /** Light up the touched half of the screen in Tap mode. */
  tapZone(lane: number, down: boolean) {
    this.el.tap.querySelector(`[data-lane="${lane}"]`)?.classList.toggle("on", down);
  }

  countdown(text: string) {
    const el = this.el.count;
    el.textContent = text;
    el.className = "hud-count";
    this.restartAnimation(el, "count");
  }

  /** Stage title card during the fly-in. */
  intro(title: string, place: string) {
    const el = this.el.banner;
    // Song titles are data, not UI copy: the translator must leave them alone.
    el.innerHTML = `<small>${place.replace(/[<>&]/g, "")}</small><span translate="no">${title.replace(/[<>&]/g, "")}</span>`;
    el.className = "hud-banner intro";
    this.restartAnimation(el, "banner");
  }

  milestone(combo: number) {
    this.banner(`${combo} IN A ROW!`, "combo");
    this.restartAnimation(this.el.streakRing, "streakBurst");
  }

  golden(complete: boolean) {
    this.banner(complete ? "GOLDEN PHRASE! +ENCORE" : "Golden phrase lost", complete ? "gold" : "lost");
  }

  encore(active: boolean) {
    if (active) this.banner("ENCORE! ×2", "encore");
  }

  hint(text: string) {
    this.el.hint.textContent = text;
    this.bump(this.el.hint);
  }

  private banner(text: string, kind: string) {
    const el = this.el.banner;
    el.textContent = text;
    el.className = `hud-banner ${kind}`;
    this.restartAnimation(el, "banner");
  }

  // Identical alternate keyframes restart the animation at style resolution time.
  // No geometry read is needed in the input handler, and CSS reduced motion still applies.
  private restartAnimation(el: HTMLElement, name: string, className = "go") {
    const alternate = !this.animationVersions.get(el);
    this.animationVersions.set(el, alternate);
    el.style.animationName = alternate ? `${name}-again` : name;
    el.classList.add(className);
  }

  private bump(el: HTMLElement) {
    this.restartAnimation(el, "bump", "bump");
  }
}
