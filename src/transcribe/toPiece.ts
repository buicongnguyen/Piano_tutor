// A transcription as a Piece, the shape every importer produces: the melody is
// the right hand (so the chart builder plays it), everything else the left, the
// beat grid comes from the detected tempo, and the recording rides along so the
// game can play the real song under the player.
import { finish, type Note, type Piece } from "../music";
import type { Transcription } from "./transcribe";

export function transcriptionToPiece(t: Transcription, title: string, id: string): Piece {
  const notes: Note[] = t.notes.map((n, i) => ({
    time: n.start,
    duration: n.duration,
    midi: n.midi,
    velocity: Math.max(0.3, n.velocity),
    hand: t.melody.has(i) ? "right" : "left",
  }));
  const beat = 60 / t.tempo.bpm;
  return finish(
    {
      id,
      title,
      composer: `From your audio · ${t.key.name} · ${Math.round(t.tempo.bpm)} BPM`,
      notes,
      beatToSeconds: (b) => t.tempo.offset + b * beat,
      meter: 4,
      chords: t.chords.map((c) => ({ start: c.start, end: c.end, name: c.name })),
      keyName: t.key.name,
      recording: t.audio,
      warning: "Notes were detected from your recording automatically; busy mixes give rougher charts than solo instruments.",
    },
    t.duration,
  );
}
