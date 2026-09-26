// Portrait dialogue box: typewriter text, advance with any key, click or tap.
import type { Line } from "../story";
import { esc } from "./dom";

const PORTRAIT: Record<string, string> = {
  "coda-happy": "coda-happy",
  "coda-wow": "coda-wow",
  "coda-determined": "coda-determined",
  "hush-sleepy": "hush-sleepy",
  "hush-sad": "hush-sad",
  "hush-smile": "hush-smile",
};

export class Dialogue {
  readonly root: HTMLElement;
  private resolve?: () => void;
  private lines: Line[] = [];
  private index = 0;
  private shown = 0;
  private timer = 0;
  private full = "";

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "dialogue";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-live", "polite");
    this.root.innerHTML = `<div class="dialogue-card">
        <div class="dialogue-portrait"><img alt="" data-el="img"></div>
        <div class="dialogue-body">
          <span class="dialogue-name" data-el="name"></span>
          <p data-el="text"></p>
          <div class="dialogue-foot"><button class="dialogue-skip" data-el="skip">Skip</button><span class="dialogue-next">▼</span></div>
        </div>
      </div>`;
    parent.append(this.root);
    this.root.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).dataset.el === "skip") this.finish();
      else this.advance();
    });
    addEventListener("keydown", (e) => {
      if (this.root.hidden) return;
      if (e.code === "Escape") {
        e.preventDefault();
        this.finish();
      } else if (["Space", "Enter", "KeyZ", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) this.advance();
      }
    });
  }

  get open() {
    return !this.root.hidden;
  }

  private queue: Promise<void> = Promise.resolve();

  /** Show lines; if a dialogue is already open, these wait their turn (never replace it). */
  play(lines: Line[]): Promise<void> {
    if (!lines.length) return this.queue;
    const gen = this.gen;
    this.queue = this.queue.then(
      () =>
        new Promise<void>((resolve) => {
          if (gen !== this.gen) return resolve(); // dismissed while waiting
          this.lines = lines;
          this.index = 0;
          this.root.hidden = false;
          this.resolve = resolve;
          this.render();
        }),
    );
    return this.queue;
  }

  /** Close whatever is showing and drop anything queued behind it. */
  dismiss() {
    this.gen++;
    if (!this.root.hidden) this.finish();
  }

  private gen = 0;

  private render() {
    const line = this.lines[this.index];
    const q = (s: string) => this.root.querySelector<HTMLElement>(`[data-el="${s}"]`)!;
    const img = q("img") as HTMLImageElement;
    const key = line.who === "keeper" ? "" : `${line.who}-${line.mood ?? (line.who === "coda" ? "happy" : "sleepy")}`;
    this.root.dataset.who = line.who;
    if (key && PORTRAIT[key]) {
      img.src = `${import.meta.env.BASE_URL}art/portraits/${PORTRAIT[key]}.png`;
      img.hidden = false;
    } else img.hidden = true;
    q("name").textContent = line.who === "coda" ? "Coda" : line.who === "hush" ? "The Hush" : line.name ?? "";
    this.full = line.text;
    this.shown = 0;
    q("text").innerHTML = "";
    clearInterval(this.timer);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      this.shown = this.full.length;
      q("text").innerHTML = esc(this.full);
      return;
    }
    this.timer = window.setInterval(() => {
      this.shown = Math.min(this.full.length, this.shown + 2);
      q("text").innerHTML = esc(this.full.slice(0, this.shown));
      if (this.shown >= this.full.length) clearInterval(this.timer);
    }, 18);
  }

  private advance() {
    if (this.shown < this.full.length) {
      clearInterval(this.timer);
      this.shown = this.full.length;
      this.root.querySelector<HTMLElement>('[data-el="text"]')!.innerHTML = esc(this.full);
      return;
    }
    this.index++;
    if (this.index >= this.lines.length) this.finish();
    else this.render();
  }

  private finish() {
    clearInterval(this.timer);
    this.root.hidden = true;
    const r = this.resolve;
    this.resolve = undefined;
    r?.();
  }
}
