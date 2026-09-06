import { noteName, type Note } from "./music";

export function upcomingKeys(
  notes: Note[],
  time: number,
  labels: Map<number, string>,
) {
  const groups: {
    time: number;
    end: number;
    labels: string[];
    outside: boolean;
  }[] = [];
  for (const note of notes) {
    if (note.time + note.duration <= time || note.time > time + 8) continue;
    let group = groups.at(-1);
    if (!group || Math.abs(group.time - note.time) > 0.0001) {
      if (groups.length >= 10) break;
      group = {
        time: note.time,
        end: note.time + note.duration,
        labels: [],
        outside: false,
      };
      groups.push(group);
    }
    const label = labels.get(note.midi);
    group.outside ||= !label;
    const text = label ?? `${noteName(note.midi)}↕`;
    if (!group.labels.includes(text)) group.labels.push(text);
    group.end = Math.max(group.end, note.time + note.duration);
  }
  return groups;
}
export function keyBar(note: Note, time: number, height = 72) {
  const scale = height / 4;
  return {
    bottom: height - (note.time - time) * scale,
    length: note.duration * scale,
  };
}
