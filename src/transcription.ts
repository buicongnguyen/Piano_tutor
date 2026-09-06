import type { Piece } from "./music";

const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const values = [16, 12, 8, 6, 4, 3, 2, 1];
const types: Record<number, string> = {
  16: "whole",
  12: "half",
  8: "half",
  6: "quarter",
  4: "quarter",
  3: "eighth",
  2: "eighth",
  1: "16th",
};
type Event = {
  start: number;
  end: number;
  pitches: number[];
  staff: number;
  voice: number;
};

/** Display-only transcription: never replaces the original performance notes. */
export function transcribe(piece: Piece) {
  const seconds = piece.beatToSeconds ?? ((beat: number) => beat / 2);
  let upper = 4;
  while (seconds(upper) < piece.duration && upper < 65536) upper *= 2;
  if (!Number.isFinite(seconds(upper)) || seconds(upper) < piece.duration)
    throw Error("This performance is too long to transcribe.");
  const toTick = (time: number) => {
    let lo = 0,
      hi = upper;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (seconds(mid) < time) lo = mid;
      else hi = mid;
    }
    return Math.round((lo + hi) * 2);
  };
  const groups = new Map<string, Event>();
  for (const n of piece.notes) {
    const start = toTick(n.time),
      end = Math.max(start + 1, toTick(n.time + n.duration));
    // A visual staff split only; this does not assign playback/practice hands.
    const staff =
      n.hand === "left" ? 2 : n.hand === "right" ? 1 : n.midi < 60 ? 2 : 1;
    const key = `${staff}:${start}:${end}`;
    const event = groups.get(key) ?? {
      start,
      end,
      pitches: [],
      staff,
      voice: 0,
    };
    if (!event.pitches.includes(n.midi)) event.pitches.push(n.midi);
    groups.set(key, event);
  }
  const events = [...groups.values()].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  const ends: number[][] = [[], []];
  for (const event of events) {
    const lanes = ends[event.staff - 1];
    let lane = lanes.findIndex((end) => end <= event.start);
    if (lane === -1) lane = lanes.length;
    lanes[lane] = event.end;
    event.voice = lane + 1 + (event.staff - 1) * 100;
  }
  const measures = Math.max(
    1,
    Math.ceil(Math.max(...events.map((e) => e.end)) / 16),
  );
  const pages = Math.ceil(measures / 16);
  const chunks = (length: number) => {
    const result: number[] = [];
    for (const size of values)
      while (length >= size) {
        result.push(size);
        length -= size;
      }
    return result;
  };
  const duration = (size: number, staff: number, voice: number) =>
    `<duration>${size}</duration><voice>${voice}</voice><type>${types[size]}</type>${[12, 6, 3].includes(size) ? "<dot/>" : ""}<staff>${staff}</staff>`;
  const measureXml = (index: number, first: boolean) => {
    const start = index * 16,
      end = start + 16;
    let body = first
      ? '<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>'
      : "";
    let firstLane = true;
    for (const staff of [1, 2])
      for (let lane = 0; lane < Math.max(1, ends[staff - 1].length); lane++) {
        const voice = lane + 1 + (staff - 1) * 100;
        if (!firstLane) body += "<backup><duration>16</duration></backup>";
        firstLane = false;
        let cursor = start;
        const rest = (length: number) =>
          chunks(length)
            .map(
              (size) => `<note><rest/>${duration(size, staff, voice)}</note>`,
            )
            .join("");
        for (const event of events.filter(
          (e) =>
            e.staff === staff &&
            e.voice === voice &&
            e.start < end &&
            e.end > start,
        )) {
          const onset = Math.max(start, event.start);
          body += rest(onset - cursor);
          let position = onset;
          for (const size of chunks(Math.min(end, event.end) - onset)) {
            const stop = position > event.start,
              begin = position + size < event.end;
            event.pitches
              .sort((a, b) => a - b)
              .forEach((midi, i) => {
                const step = [
                  "C",
                  "C",
                  "D",
                  "D",
                  "E",
                  "F",
                  "F",
                  "G",
                  "G",
                  "A",
                  "A",
                  "B",
                ][midi % 12];
                const alter = [1, 3, 6, 8, 10].includes(midi % 12)
                  ? "<alter>1</alter>"
                  : "";
                body += `<note>${i ? "<chord/>" : ""}<pitch><step>${step}</step>${alter}<octave>${Math.floor(midi / 12) - 1}</octave></pitch><duration>${size}</duration>${stop ? '<tie type="stop"/>' : ""}${begin ? '<tie type="start"/>' : ""}${duration(size, staff, voice).replace(`<duration>${size}</duration>`, "")}${stop || begin ? `<notations>${stop ? '<tied type="stop"/>' : ""}${begin ? '<tied type="start"/>' : ""}</notations>` : ""}</note>`;
              });
            position += size;
          }
          cursor = Math.min(end, event.end);
        }
        body += rest(end - cursor);
      }
    return `<measure number="${index + 1}">${body}</measure>`;
  };
  return {
    pages,
    xml(page: number) {
      const first = Math.max(0, Math.min(pages - 1, Math.floor(page))) * 16;
      return `<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>${escapeXml(piece.title)} · generated transcription</work-title></work><identification><creator type="composer">${escapeXml(piece.composer)}</creator></identification><part-list><score-part id="P1"><part-name>Piano reduction</part-name></score-part></part-list><part id="P1">${Array.from({ length: Math.min(16, measures - first) }, (_, i) => measureXml(first + i, i === 0)).join("")}</part></score-partwise>`;
    },
  };
}
