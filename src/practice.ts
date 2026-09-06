import type { Note, Piece } from "./music";
export type PracticeHand = Note["hand"];
export function hasBothHands(notes: Note[]) {
  return (
    notes.some((n) => n.hand === "left") &&
    notes.some((n) => n.hand === "right") &&
    notes.every((n) => n.hand !== undefined)
  );
}
export function scoreBeats(piece: Piece): number[] {
  if (!piece.beatToSeconds) return [];
  const beats: number[] = [];
  for (let i = 0; i < 50000; i++) {
    const time = piece.beatToSeconds(i);
    if (!Number.isFinite(time) || time < 0 || (i > 0 && time <= beats[i - 1]))
      return [];
    if (time >= piece.duration) return beats;
    beats.push(time);
  }
  return []; // Reject an unreasonable grid rather than silently truncating it.
}
