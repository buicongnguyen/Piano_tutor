// Audio file -> notes, melody, chords, key and tempo, entirely in the browser.
// The polyphonic note model is Spotify's Basic Pitch (Apache-2.0, 0.9 MB, TF.js);
// it and TensorFlow are imported only when someone actually uploads audio.
// Shared by Stillnote Encore and the guitar trainer: no game code in here.
import { detectChords, estimateKey, estimateTempo, melodyLine, type ChordSpan, type RawNote, type Tempo } from "./analysis";

export type Transcription = {
  notes: RawNote[]; // every detected note, sorted by start
  melody: Set<number>; // indices of the melody (top voice) in `notes`
  chords: ChordSpan[];
  key: { tonic: number; mode: "major" | "minor"; flats: boolean; name: string };
  tempo: Tempo;
  duration: number; // seconds of audio analysed
  audio: AudioBuffer; // the original, for playing along
};

export const MODEL_SAMPLE_RATE = 22050;
export const MAX_SECONDS = 6 * 60;
export const AUDIO_TYPES = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus)$/i;

/** Decode any format the browser can play. */
export async function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  try {
    return await ctx.decodeAudioData(data);
  } catch {
    throw Error("This audio format can't be decoded here. Try MP3, WAV, OGG or M4A.");
  }
}

/** Mono at the model's 22.05 kHz, via the browser's own resampler. */
export async function resampleForModel(audio: AudioBuffer, seconds = Math.min(audio.duration, MAX_SECONDS)) {
  const length = Math.max(1, Math.ceil(seconds * MODEL_SAMPLE_RATE));
  const ctx = new OfflineAudioContext(1, length, MODEL_SAMPLE_RATE);
  const src = ctx.createBufferSource();
  src.buffer = audio;
  src.connect(ctx.destination); // multi-channel sources are down-mixed to mono
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

export type Progress = (stage: "decode" | "model" | "notes" | "analyse", fraction: number) => void;

export async function transcribeAudio(data: ArrayBuffer, o: { modelUrl: string; onProgress?: Progress; signal?: AbortSignal }): Promise<Transcription> {
  const p = o.onProgress ?? (() => undefined);
  p("decode", 0);
  const audio = await decodeAudio(data);
  if (audio.duration < 1) throw Error("That clip is shorter than a second.");
  const samples = await resampleForModel(audio);
  p("model", 0);
  const { BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import("@spotify/basic-pitch");
  const model = new BasicPitch(o.modelUrl);
  const frames: number[][] = [],
    onsets: number[][] = [],
    contours: number[][] = [];
  await model.evaluateModel(
    samples,
    (f, on, c) => {
      if (o.signal?.aborted) throw Error("Cancelled.");
      frames.push(...f);
      onsets.push(...on);
      contours.push(...c);
    },
    (fraction) => p("model", fraction),
  );
  p("notes", 0);
  const events = noteFramesToTime(addPitchBendsToNoteEvents(contours, outputToNotesPoly(frames, onsets, 0.5, 0.3, 11, true)));
  const notes: RawNote[] = events
    .map((e) => ({ start: e.startTimeSeconds, duration: Math.max(0.05, e.durationSeconds), midi: e.pitchMidi, velocity: Math.min(1, e.amplitude) }))
    .filter((n) => n.midi >= 28 && n.midi <= 100)
    .sort((a, b) => a.start - b.start || b.midi - a.midi);
  if (notes.length < 4) throw Error("No clear notes were found in that audio.");
  p("analyse", 0);
  const duration = Math.min(audio.duration, MAX_SECONDS);
  const tempo = estimateTempo(notes);
  const key = estimateKey(notes);
  const chords = detectChords(notes, tempo, duration, key.flats);
  const melody = melodyLine(notes);
  p("analyse", 1);
  return { notes, melody, chords, key, tempo, duration, audio };
}
