import type { Note, Piece } from "./music";

export type Phrase = { start: number; end: number; targets: Note[] };
export function challengeNotes(piece: Piece): Note[] {
  const right = piece.notes.filter((n) => n.hand === "right");
  if (right.length && piece.notes.every((n) => n.hand)) return right;
  const notes = [...piece.notes].sort((a, b) => a.time - b.time);
  if (
    notes.every(
      (n, i) =>
        !i || n.time >= notes[i - 1].time + notes[i - 1].duration - 0.025,
    )
  )
    return notes;
  return [];
}
export function phrasesFor(piece: Piece): Phrase[] {
  const notes = challengeNotes(piece),
    phrases: Phrase[] = [];
  let targets: Note[] = [];
  for (const n of notes) {
    if (
      targets.length &&
      n.time - targets[0].time >= 20 &&
      n.time > targets.at(-1)!.time + 0.025 &&
      targets.every((t) => t.time + t.duration <= n.time + 0.025)
    ) {
      phrases.push({
        start: targets[0].time,
        end: Math.max(...targets.map((t) => t.time + t.duration)),
        targets,
      });
      targets = [];
    }
    targets.push(n);
  }
  if (targets.length)
    phrases.push({
      start: targets[0].time,
      end: Math.max(...targets.map((n) => n.time + n.duration)),
      targets,
    });
  return phrases;
}
export function progressKey(piece: Piece, phrase: Phrase) {
  let hash = 2166136261;
  const data =
    `${piece.title}|${piece.composer}|` +
    piece.notes
      .map((n) => `${n.midi},${n.time.toFixed(3)},${n.duration.toFixed(3)}`)
      .join(";");
  for (let i = 0; i < data.length; i++)
    hash = Math.imul(hash ^ data.charCodeAt(i), 16777619);
  return `${(hash >>> 0).toString(16)}:${phrase.start.toFixed(3)}:${phrase.end.toFixed(3)}`;
}
export class Performance {
  matched = new Map<number, { onset: number; hold?: number }>();
  held = new Map<number, { index: number; time: number }>();
  extras = 0;
  constructor(
    readonly phrase: Phrase,
    readonly speed: number,
  ) {}
  down(midi: number, time: number) {
    if (this.held.has(midi)) return false;
    let best = -1,
      distance = 0.35;
    this.phrase.targets.forEach((n, i) => {
      const delta = Math.abs(time - n.time) / this.speed;
      if (n.midi === midi && !this.matched.has(i) && delta <= distance) {
        best = i;
        distance = delta;
      }
    });
    if (best < 0) {
      this.extras++;
      return false;
    }
    this.matched.set(best, { onset: Math.max(0, 1 - distance / 0.35) });
    this.held.set(midi, { index: best, time });
    return true;
  }
  up(midi: number, time: number) {
    const held = this.held.get(midi);
    if (!held) return;
    const wanted = this.phrase.targets[held.index].duration / this.speed;
    const actual = Math.max(0, time - held.time) / this.speed;
    this.matched.get(held.index)!.hold = Math.max(
      0,
      1 - Math.abs(actual - wanted) / Math.max(0.15, wanted),
    );
    this.held.delete(midi);
  }
  result() {
    const total = this.phrase.targets.length;
    const sum = [...this.matched.values()];
    const timing = sum.reduce((s, n) => s + n.onset, 0) / total;
    const hold = sum.reduce((s, n) => s + (n.hold ?? 0), 0) / total;
    const accuracy = this.matched.size / (total + this.extras);
    return {
      matched: this.matched.size,
      total,
      extras: this.extras,
      timing: Math.round(timing * 100),
      hold: Math.round(hold * 100),
      score: Math.round((accuracy * 0.5 + timing * 0.3 + hold * 0.2) * 100),
    };
  }
}
export type Progress = Record<string, { learned: boolean; best: number }>;
export function readProgress(storage: Pick<Storage, "getItem">): Progress {
  try {
    const data = JSON.parse(storage.getItem("stillnote-journey-v1") || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data)
        .slice(-500)
        .filter(
          ([key, v]) =>
            /^[a-f0-9]+:\d+\.\d{3}:\d+\.\d{3}$/.test(key) &&
            v &&
            typeof v === "object" &&
            typeof (v as { learned?: unknown }).learned === "boolean" &&
            Number.isFinite((v as { best?: unknown }).best),
        )
        .map(([k, v]) => [
          k,
          {
            learned: (v as { learned: boolean }).learned,
            best: Math.max(0, Math.min(100, (v as { best: number }).best)),
          },
        ]),
    );
  } catch {
    return {};
  }
}
export function saveProgress(
  storage: Pick<Storage, "setItem">,
  data: Progress,
) {
  try {
    storage.setItem(
      "stillnote-journey-v1",
      JSON.stringify(Object.fromEntries(Object.entries(data).slice(-500))),
    );
    return true;
  } catch {
    return false;
  }
}
