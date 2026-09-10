// Melody-only transcriptions. Sources, attribution and licenses: public/music/SOURCES.md.
// Durations are quarter-note beats; R is a rest. Each bar is checked before writing.
import midiPackage from "@tonejs/midi";
const { Midi } = midiPackage;
import { writeFileSync } from "node:fs";

function write(name, title, bpm, meter, bars) {
  const midi = new Midi();
  midi.header.name = title;
  midi.header.setTempo(bpm);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: meter }];
  const track = midi.addTrack();
  track.name = "Right Hand";
  let beats = 0;
  for (const bar of bars) {
    let count = 0;
    for (const token of bar.split(" ")) {
      const [note, length] = token.split(":");
      const duration = Number(length);
      if (!Number.isFinite(duration) || duration <= 0) throw Error(token);
      if (note !== "R")
        track.addNote({
          name: note,
          ticks: Math.round(beats * midi.header.ppq),
          durationTicks: Math.round(duration * midi.header.ppq),
          velocity: 0.75,
        });
      beats += duration;
      count += duration;
    }
    if (Math.abs(count - (meter[0] * 4) / meter[1]) > 0.0001)
      throw Error(`${name}: invalid bar ${bar} (${count})`);
  }
  writeFileSync(`public/music/${name}.mid`, Buffer.from(midi.toArray()));
  console.log(name, track.notes.length, midi.duration.toFixed(3));
}

// Nationalanthems.info score: melody only, one verse and chorus; omit piano introduction/fills.
write(
  "aegukga",
  "Aegukga — melody, one verse and chorus",
  88,
  [4, 4],
  [
    "D4:1 G4:1.5 F#4:0.5 E4:1",
    "G4:1 D4:1 B3:1 D4:1",
    "G4:1 A4:0.5 B4:0.5 C5:1.5 B4:0.5",
    "A4:3 R:1",
    "D5:1.5 C5:0.5 B4:1 A4:1",
    "G4:1 F#4:0.5 E4:0.5 D4:1 B3:1",
    "D4:1 G4:1 A4:0.5 A4:0.5 B4:1",
    "G4:3 R:1",
    "F#4:1.5 G4:0.5 A4:1 F#4:1",
    "B4:1.5 C5:0.5 D5:1 B4:1",
    "A4:1 G4:1 F#4:1 G4:1",
    "A4:3 R:1",
    "D5:1.5 C5:0.5 B4:1 A4:1",
    "G4:1 F#4:0.5 E4:0.5 D4:1 B3:1",
    "D4:1 G4:1 A4:0.5 A4:0.5 B4:1",
    "G4:3 R:1",
  ],
);

// Nationalanthems.info score: highest melody voice, written repeat and alternative ending.
// Consecutive durations across a barline are merged below for the two melody ties.
const vietnam = [
  "Bb4:1 Bb4:2 C5:0.5 Bb4:0.5",
  "D5:1 D5:2 C5:0.5 Bb4:0.5",
  "G4:1 Bb4:1 Bb4:0.5 G4:0.5 F4:0.5 D4:0.5",
  "F4:3 Bb4:0.5 C5:0.5",
  "D5:1 D5:1 D5:1 C5:0.5 Bb4:0.5",
  "F5:3 D5:0.5 Bb4:0.5",
  "C5:1 C5:1 D5:1 A4:0.5 F4:0.5",
  "Bb4:3 D5:0.5 Eb5:0.5",
  "F5:1 F5:1 G5:1.5 F5:0.5",
  "D5:2 D5:1.5 C5:0.5",
  "Bb4:1 F4:1 A4:1 A4:0.5 C5:0.5",
  "Bb4:3 D5:0.5 Eb5:0.5",
  "F5:1 F5:1 F5:1.5 F5:0.5",
  "C5:2 D5:1.5 C5:0.5",
  "Bb4:1 Bb4:1 F4:2",
  "Eb5:2 D5:2",
  "D5:1 Bb4:1 G5:2",
  "D5:2 D5:0.5 C5:0.5 Bb4:0.5 F4:0.5",
  "C5:1 C5:2 Bb4:1",
];
write(
  "tien-quan-ca",
  "Tiến quân ca — melody, two verses",
  104,
  [4, 4],
  [
    "R:2.5 F4:0.5 G4:0.75 F4:0.25",
    ...vietnam,
    "A4:2 R:0.5 F4:0.5 G4:0.75 F4:0.25",
    ...vietnam,
    "Bb4:4",
  ],
);
// Preserve tied melody notes as one key press rather than rearticulating them.
import { readFileSync } from "node:fs";
const vn = new Midi(readFileSync("public/music/tien-quan-ca.mid"));
const melody = vn.tracks[0];
for (const startBeat of [
  4 + 15 * 4 + 2,
  4 + 17 * 4,
  84 + 15 * 4 + 2,
  84 + 17 * 4,
]) {
  const index = melody.notes.findIndex(
    (n) => n.ticks === startBeat * vn.header.ppq,
  );
  const first = melody.notes[index],
    next = melody.notes[index + 1];
  if (
    !first ||
    !next ||
    first.midi !== next.midi ||
    first.ticks + first.durationTicks !== next.ticks
  )
    throw Error("Melody tie mismatch");
  first.durationTicks += next.durationTicks;
  melody.notes.splice(index + 1, 1);
}
writeFileSync("public/music/tien-quan-ca.mid", Buffer.from(vn.toArray()));

// Traditional Arirang tune from the Wikipedia score (CC BY-SA 4.0 contributors).
// One complete 16-bar verse in 9/8; durations include written ties.
write(
  "arirang",
  "Arirang — traditional melody",
  140,
  [9, 8],
  [
    "C4:2.5 D4:0.5 C4:1 D4:0.5",
    "F4:2.5 G4:0.5 F4:1 G4:0.5",
    "A4:1.5 G4:0.5 A4:0.5 G4:0.5 F4:1 D4:0.5",
    "C4:2.5 D4:0.5 C4:0.5 D4:0.5 R:0.5",
    "F4:2.5 G4:0.5 F4:1 G4:0.5",
    "A4:1 G4:0.5 F4:1 D4:0.5 C4:1 D4:0.5",
    "F4:2.5 G4:0.5 F4:1.5",
    "F4:3 R:1.5",
    "C5:4.5",
    "C5:1.5 A4:1.5 G4:1.5",
    "A4:1.5 G4:1 A4:0.5 F4:1 D4:0.5",
    "C4:2.5 D4:0.5 C4:0.5 D4:0.5 R:0.5",
    "F4:2.5 G4:0.5 F4:1 G4:0.5",
    "A4:1 G4:0.5 F4:1 D4:0.5 C4:1 D4:0.5",
    "F4:2.5 G4:0.5 F4:1.5",
    "F4:3 R:1.5",
  ],
);
