import type { Note } from "./music";

export class NoteIndex {
  readonly notes: readonly Note[];
  readonly range: readonly [number, number];
  private ends: number[] = [];

  constructor(notes: readonly Note[]) {
    this.notes = [...notes].sort((a, b) => a.time - b.time);
    let low = Infinity, high = -Infinity, end = -Infinity;
    for (const n of this.notes) {
      low = Math.min(low, n.midi);
      high = Math.max(high, n.midi);
      end = Math.max(end, n.time + n.duration);
      this.ends.push(end);
    }
    this.range = notes.length ? [low - 2, high + 2] : [58, 62];
  }

  /** Inclusive visible window. Prefix end times retain long notes starting earlier. */
  between(start: number, end: number): Note[] {
    let lo = 0, hi = this.ends.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ends[mid] < start) lo = mid + 1;
      else hi = mid;
    }
    const visible: Note[] = [];
    for (let i = lo; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.time > end) break;
      if (n.time + n.duration >= start) visible.push(n);
    }
    return visible;
  }

  activeAt(time: number): Note[] {
    return this.between(time, time).filter(n => n.time + n.duration > time);
  }
}
