import { Midi } from "@tonejs/midi";
export type Note = {
  time: number;
  duration: number;
  // Key-down duration stays separate from the pedal-held sound.
  soundingDuration?: number;
  midi: number;
  velocity: number;
  hand?: "left" | "right";
  program?: number; // General MIDI program for this pitched track (zero-based).
};
export type Piece = {
  id: string;
  title: string;
  composer: string;
  tags?: string;
  notes: Note[];
  duration: number;
  xml?: string;
  warning?: string;
  beatToSeconds?: (beat: number) => number;
  source?: { url: string; sheetUrl?: string; fileUrl: string; edition: string };
};
const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const noteName = (m: number) => names[m % 12] + (Math.floor(m / 12) - 1);
export const soundDuration = (note: Note) =>
  note.soundingDuration ?? note.duration;
export function finish(piece: Omit<Piece, "duration">, timelineEnd = 0): Piece {
  if (!Number.isFinite(timelineEnd) || timelineEnd < 0)
    throw Error("Score contains an invalid ending time.");
  if (!piece.notes.length)
    throw Error(
      "No playable notes found. Choose a pitched MusicXML or MIDI score.",
    );
  if (piece.notes.length > 30000)
    throw Error("This score exceeds the 30,000-note limit.");
  if (
    piece.notes.some(
      (n) =>
        !Number.isFinite(n.time + n.duration + n.midi + n.velocity) ||
        n.time < 0 ||
        n.duration <= 0 ||
        !Number.isFinite(soundDuration(n)) ||
        soundDuration(n) < n.duration ||
        n.midi < 21 ||
        n.midi > 108,
    )
  )
    throw Error(
      "Score contains invalid timing or notes outside the 88-key piano range.",
    );
  piece.notes.sort((a, b) => a.time - b.time);
  return {
    ...piece,
    duration: Math.max(
      timelineEnd,
      ...piece.notes.map((n) => n.time + soundDuration(n)),
    ),
  };
}
export function parseMidi(data: ArrayBuffer, title: string): Piece {
  const midi = new Midi(data);
  // The library scans every track when calculating duration. Compute it once,
  // rather than rescanning the whole score for every imported note.
  const midiDuration = midi.duration;
  const pedals = new Map<number, { time: number; value: number }[]>();
  for (const track of midi.tracks) {
    const events = pedals.get(track.channel) ?? [];
    events.push(...(track.controlChanges[64] || []));
    pedals.set(track.channel, events);
  }
  for (const events of pedals.values()) events.sort((a, b) => a.time - b.time);
  return finish({
    id: crypto.randomUUID(),
    title: midi.name || title,
    composer: "Imported MIDI",
    beatToSeconds: (beat) => midi.header.ticksToSeconds(beat * midi.header.ppq),
    notes: midi.tracks
      .filter((t) => !t.instrument.percussion)
      .flatMap((t) =>
        t.notes.map((n) => ({
          time: n.time,
          duration: n.duration,
          soundingDuration: Math.max(
            n.duration,
            sustainEnd(
              pedals.get(t.channel) || [],
              n.time + n.duration,
              midiDuration,
            ) - n.time,
          ),
          midi: n.midi,
          velocity: n.velocity,
          hand: handFromTrackName(t.name),
          program: t.instrument.number,
        })),
      ),
    warning:
      "MIDI playback preserves pitched track voices; drums are not imported. Sheet music offers an approximate generated transcription.",
  });
}
// Use explicit staff/track labels, never a middle-C split: hands can cross.
export function handFromTrackName(name: string): Note["hand"] {
  if (/^(right(?: hand)?|rh|treble|up(?:per)?)(?:\b|:)/i.test(name.trim()))
    return "right";
  if (/^(left(?: hand)?|lh|bass|down|lower)(?:\b|:)/i.test(name.trim()))
    return "left";
  return undefined;
}
export function sustainEnd(
  events: { time: number; value: number }[],
  end: number,
  limit: number,
) {
  const before = events.filter((e) => e.time <= end).at(-1);
  if (!before || before.value < 0.5) return end;
  return (
    events.find((e) => e.time > end && e.value < 0.5)?.time ??
    Math.max(end, limit)
  );
}
export function parseXml(xml: string, title = "Imported score"): Piece {
  if (/<!ENTITY|<!DOCTYPE[\s\S]*?\[/i.test(xml))
    throw Error("XML entity declarations are not supported.");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.tagName !== "score-partwise"
  )
    throw Error("Choose a valid score-partwise MusicXML file.");
  // Disallow executable/foreign content before handing the document to the engraver.
  for (const el of doc.querySelectorAll("*")) {
    if (["script", "iframe", "image", "foreignObject"].includes(el.localName))
      el.remove();
    for (const a of [...el.attributes])
      if (/^on/i.test(a.name) || /href/i.test(a.name))
        el.removeAttribute(a.name);
  }
  const txt = (e: Element, s: string, d = "") =>
    e.querySelector(s)?.textContent?.trim() || d;
  const num = (e: Element, s: string, d = 0) => Number(txt(e, s, String(d)));
  const parts = [...doc.querySelectorAll("score-partwise > part")];
  if (doc.querySelector("transpose"))
    throw Error("Export this score in concert pitch before importing.");
  const lengths: number[] = [];
  const raw: Note[] = [];
  const tempos = [{ beat: 0, bpm: 120 }];
  // First pass gets a shared measure length across all parts.
  for (const part of parts) {
    let div = 1;
    [...part.children].forEach((measure, i) => {
      let p = 0,
        max = 0;
      for (const e of measure.children) {
        if (e.tagName === "attributes") div = num(e, "divisions", div);
        if (!Number.isFinite(div) || div <= 0)
          throw Error("Invalid MusicXML divisions.");
        const d = num(e, "duration") / div;
        if (e.tagName === "backup") p -= d;
        if (e.tagName === "forward") p += d;
        if (e.tagName === "note" && !e.querySelector("chord, grace")) p += d;
        max = Math.max(max, p);
      }
      lengths[i] = Math.max(lengths[i] || 0, max);
    });
  }
  for (const part of parts) {
    let div = 1,
      start = 0;
    const twoStaves = [...part.querySelectorAll("staves")].some(
      (e) => Number(e.textContent) >= 2,
    );
    let velocity = 0.7;
    const ties = new Map<string, Note>();
    [...part.children].forEach((measure, i) => {
      let p = 0,
        last = 0;
      for (const e of measure.children) {
        if (e.tagName === "attributes") div = num(e, "divisions", div);
        const d = num(e, "duration") / div;
        if (e.tagName === "direction") {
          let bpm = Number(e.querySelector("sound")?.getAttribute("tempo"));
          if (!bpm) {
            const unit = txt(e, "beat-unit", "quarter");
            const units: Record<string, number> = {
              whole: 4,
              half: 2,
              quarter: 1,
              eighth: 0.5,
              "16th": 0.25,
            };
            bpm =
              num(e, "per-minute") *
              (units[unit] || 1) *
              (e.querySelector("beat-unit-dot") ? 1.5 : 1);
          }
          if (bpm > 0 && Number.isFinite(bpm))
            tempos.push({ beat: start + p + num(e, "offset") / div, bpm });
          const explicit = e.querySelector("sound")?.getAttribute("dynamics");
          const marking =
            e.querySelector("dynamics")?.firstElementChild?.tagName;
          const strengths: Record<string, number> = {
            ppp: 0.23,
            pp: 0.32,
            p: 0.43,
            mp: 0.55,
            mf: 0.68,
            f: 0.82,
            ff: 0.93,
            fff: 1,
          };
          if (explicit !== null && explicit !== undefined)
            velocity = Math.max(0, Math.min(1, Number(explicit) / 100));
          else if (marking && marking in strengths)
            velocity = strengths[marking];
        }
        if (e.tagName === "backup") p -= d;
        if (e.tagName === "forward") p += d;
        if (e.tagName !== "note" || e.querySelector("grace")) continue;
        const chord = !!e.querySelector("chord");
        const at = chord ? last : p;
        if (!chord) {
          last = p;
          p += d;
        }
        if (e.querySelector("rest") || !e.querySelector("pitch")) continue;
        const step = txt(e, "pitch > step");
        const pitch =
          (
            { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<
              string,
              number
            >
          )[step] +
          num(e, "pitch > alter") +
          12 * (num(e, "pitch > octave") + 1);
        const key =
          txt(e, "staff", "1") + ":" + txt(e, "voice", "1") + ":" + pitch;
        const stop = !!e.querySelector('tie[type="stop"]');
        const begin = !!e.querySelector('tie[type="start"]');
        const previous = ties.get(key);
        const staff = num(e, "staff", 1);
        const hand: Note["hand"] = twoStaves
          ? staff === 1
            ? "right"
            : staff === 2
              ? "left"
              : undefined
          : undefined;
        const n: Note = {
          time: start + at,
          duration: d,
          midi: pitch,
          velocity,
          hand,
        };
        if (
          stop &&
          previous &&
          Math.abs(previous.time + previous.duration - n.time) < 0.001
        ) {
          previous.duration += d;
          if (!begin) ties.delete(key);
        } else {
          raw.push(n);
          if (begin) ties.set(key, n);
        }
      }
      start += lengths[i] || 0;
    });
  }
  tempos.sort((a, b) => a.beat - b.beat);
  const seconds = (beat: number) => {
    let time = 0,
      prev = 0,
      bpm = 120;
    for (const t of tempos) {
      if (t.beat > beat) break;
      time += ((t.beat - prev) * 60) / bpm;
      prev = t.beat;
      bpm = t.bpm;
    }
    return time + ((beat - prev) * 60) / bpm;
  };
  return finish(
    {
      id: crypto.randomUUID(),
      title: txt(
        doc.documentElement,
        "work-title",
        txt(doc.documentElement, "movement-title", title),
      ),
      composer: txt(
        doc.documentElement,
        'creator[type="composer"]',
        "Imported MusicXML",
      ),
      xml: new XMLSerializer().serializeToString(doc),
      beatToSeconds: seconds,
      notes: raw.map((n) => ({
        ...n,
        time: seconds(n.time),
        duration: seconds(n.time + n.duration) - seconds(n.time),
      })),
      warning:
        "Written-order playback. Tempo, ties and basic dynamics supported; repeats, ornaments, pedal and hairpins require an expressive MIDI export.",
    },
    seconds(lengths.reduce((sum, length) => sum + length, 0)),
  );
}
export function exercise(title: string, pitches: number[], bpm: number): Piece {
  const note = (m: number) =>
    `<note><pitch><step>${["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"][m % 12]}</step>${[1, 3, 6, 8, 10].includes(m % 12) ? "<alter>1</alter>" : ""}<octave>${Math.floor(m / 12) - 1}</octave></pitch><duration>1</duration><type>quarter</type></note>`;
  const xml = `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${title}</work-title></work><identification><creator type="composer">Stillnote · Original exercise</creator></identification><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${Array.from(
    { length: Math.ceil(pitches.length / 4) },
    (_, i) =>
      `<measure number="${i + 1}">${i === 0 ? `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><sound tempo="${bpm}"/></direction>` : ""}${pitches
        .slice(i * 4, i * 4 + 4)
        .map(note)
        .join("")}</measure>`,
  ).join("")}</part></score-partwise>`;
  return parseXml(xml, title);
}
