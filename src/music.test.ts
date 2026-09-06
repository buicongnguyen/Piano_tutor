// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseXml, parseMidi, exercise, finish, sustainEnd } from "./music";
import { activeAt, Player } from "./audio";
import { Midi } from "@tonejs/midi";
const wrap = (body: string) =>
  `<score-partwise><part-list><score-part id="p"><part-name>Piano</part-name></score-part></part-list><part id="p">${body}</part></score-partwise>`;
const note = (step: string, duration = 1, extra = "") =>
  `<note>${extra}<pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration></note>`;
describe("score import", () => {
  it("keeps MIDI key release separate from same-channel pedal sustain", () => {
    const midi = new Midi();
    const notes = midi.addTrack();
    notes.channel = 0;
    notes.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.7 });
    const pedal = midi.addTrack();
    pedal.channel = 0;
    pedal.addCC({ number: 64, time: 0, value: 1 });
    pedal.addCC({ number: 64, time: 2, value: 0 });
    const other = midi.addTrack();
    other.channel = 1;
    other.addNote({ midi: 64, time: 0, duration: 0.5, velocity: 0.7 });
    const p = parseMidi(midi.toArray().buffer as ArrayBuffer, "pedal");
    expect(p.notes.map((n) => n.duration)).toEqual([0.5, 0.5]);
    expect(p.notes.map((n) => n.soundingDuration)).toEqual([2, 0.5]);
    expect(activeAt(p.notes, 0.5)).toHaveLength(0);
    expect(p.duration).toBe(2);
  });
  it("uses exact divisions for dotted notes and tuplets, including final rests", () => {
    const p = parseXml(
      wrap(
        `<measure><attributes><divisions>6</divisions></attributes><direction><sound tempo="60"/></direction>${note("C", 9, "<type>quarter</type><dot/>")}${note("D", 2, "<type>eighth</type><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>")}<note><rest/><duration>6</duration></note></measure>`,
      ),
    );
    expect(p.notes[0].duration).toBe(1.5);
    expect(p.notes[1].time).toBe(1.5);
    expect(p.notes[1].duration).toBeCloseTo(1 / 3, 10);
    expect(p.duration).toBeCloseTo(17 / 6, 10);
    expect(activeAt(p.notes, 2)).toHaveLength(0);
  });
  it("integrates a tied note across a tempo change", () => {
    const p = parseXml(
      wrap(
        `<measure><direction><sound tempo="60"/></direction>${note("C", 1, '<tie type="start"/>')}</measure><measure><direction><sound tempo="120"/></direction>${note("C", 1, '<tie type="stop"/>')}</measure>`,
      ),
    );
    expect(p.notes).toHaveLength(1);
    expect(p.notes[0].duration).toBe(1.5);
  });
  it("does not merge independent staff ties that share voice and pitch", () => {
    const p = parseXml(
      wrap(
        `<measure>${note("C", 1, '<staff>1</staff><tie type="start"/>')}<backup><duration>1</duration></backup>${note("C", 1, '<staff>2</staff><tie type="start"/>')}</measure><measure>${note("C", 1, '<staff>1</staff><tie type="stop"/>')}<backup><duration>1</duration></backup>${note("C", 1, '<staff>2</staff><tie type="stop"/>')}</measure>`,
      ),
    );
    expect(p.notes.map((n) => n.duration)).toEqual([1, 1]);
  });
  it("uses two-staff MusicXML hand labels rather than pitch", () => {
    const p = parseXml(
      wrap(
        `<measure><attributes><staves>2</staves></attributes>${note("C", 1, "<staff>2</staff>")}${note("D", 1, "<staff>1</staff>")}</measure>`,
      ),
    );
    expect(p.notes.map((n) => n.hand)).toEqual(["left", "right"]);
  });
  it("honors dynamics and metronome tempo", () => {
    const p = parseXml(
      wrap(
        `<measure><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>60</per-minute></metronome><dynamics><p/></dynamics></direction-type></direction>${note("C")}<direction><sound dynamics="90"/></direction>${note("D")}</measure>`,
      ),
    );
    expect(p.duration).toBe(2);
    expect(p.notes.map((n) => n.velocity)).toEqual([0.43, 0.9]);
  });
  it("extends sustained MIDI notes to pedal release", () => {
    expect(
      sustainEnd(
        [
          { time: 0, value: 1 },
          { time: 2, value: 0 },
        ],
        0.5,
        3,
      ),
    ).toBe(2);
    expect(sustainEnd([{ time: 0, value: 0 }], 0.5, 3)).toBe(0.5);
  });
  it("preserves simultaneous chords and independent voices", () => {
    const p = parseXml(
      wrap(
        `<measure><attributes><divisions>1</divisions></attributes>${note("C")}${note("E", 1, "<chord/>")}${note("G")}<backup><duration>2</duration></backup>${note("C", 2, "<voice>2</voice>")}</measure>`,
      ),
    );
    expect(p.notes.map((n) => n.time)).toEqual([0, 0, 0, 0.5]);
    expect(activeAt(p.notes, 0.25)).toHaveLength(3);
    expect(p.duration).toBe(1);
  });
  it("preserves rests and tempo changes", () => {
    const p = parseXml(
      wrap(
        `<measure><attributes><divisions>2</divisions></attributes><note><rest/><duration>2</duration></note>${note("C", 2)}<direction><sound tempo="60"/></direction>${note("D", 2)}</measure>`,
      ),
    );
    expect(p.notes.map((n) => [n.time, n.duration])).toEqual([
      [0.5, 0.5],
      [1, 1],
    ]);
  });
  it("merges tied notes across measures without reattack", () => {
    const p = parseXml(
      wrap(
        `<measure>${note("C", 1, '<tie type="start"/>')}</measure><measure>${note("C", 1, '<tie type="stop"/>')}</measure>`,
      ),
    );
    expect(p.notes).toHaveLength(1);
    expect(p.duration).toBe(1);
  });
  it("rejects invalid XML, entity declarations and empty scores", () => {
    expect(() => parseXml("<bad>")).toThrow();
    expect(() =>
      parseXml('<!DOCTYPE x [<!ENTITY a "x">]><score-partwise/>'),
    ).toThrow();
    expect(() => parseXml(wrap("<measure/>"))).toThrow();
  });
  it("rejects corrupt timing and out-of-range notes", () => {
    expect(() =>
      finish({
        id: "x",
        title: "x",
        composer: "x",
        notes: [{ time: 0, duration: NaN, midi: 60, velocity: 0.5 }],
      }),
    ).toThrow();
    expect(() =>
      parseXml(
        wrap(
          `<measure><attributes><divisions>0</divisions></attributes>${note("C")}</measure>`,
        ),
      ),
    ).toThrow();
  });
  it("creates a playable downloadable exercise", () => {
    const p = exercise("Test", [60, 64, 67, 72], 60);
    expect(p.duration).toBe(4);
    expect(parseXml(p.xml!).notes).toEqual(p.notes);
  });
  it("retains MIDI microtiming, overlapping notes and velocity", () => {
    const midi = new Midi();
    const t = midi.addTrack();
    t.addNote({ midi: 60, time: 0, duration: 1, velocity: 0.25 });
    t.addNote({ midi: 64, time: 0.123, duration: 0.8, velocity: 0.9 });
    const data = midi.toArray();
    const p = parseMidi(data.buffer as ArrayBuffer, "test");
    expect(p.notes[1].time).toBeCloseTo(0.123, 2);
    expect(p.notes[0].velocity).toBeCloseTo(0.25, 1);
    expect(activeAt(p.notes, 0.2)).toHaveLength(2);
  });
});
describe("transport", () => {
  it("schedules a chord together and cancels future voices on pause", async () => {
    const p = new Player();
    const calls: unknown[] = [];
    p.init = async () => {
      p.context = { currentTime: 10 } as AudioContext;
    };
    p.tone = (...args) => calls.push(args);
    p.load(
      finish({
        id: "t",
        title: "t",
        composer: "t",
        notes: [60, 64, 67].map((midi) => ({
          midi,
          time: 0,
          duration: 2,
          velocity: 0.7,
        })),
      }),
    );
    await p.play();
    expect(calls).toHaveLength(3);
    expect(p.playing).toBe(true);
    p.pause();
    expect(p.playing).toBe(false);
  });
  it("does not restart after pause while initialization is pending", async () => {
    const p = new Player();
    let resolve!: () => void;
    p.init = () =>
      new Promise<void>((r) => {
        resolve = r;
      });
    p.load(exercise("Test", [60], 60));
    const pending = p.play();
    p.pause();
    resolve();
    await pending;
    expect(p.playing).toBe(false);
  });
  it("seeks within score boundaries", () => {
    const p = new Player();
    p.load(exercise("Test", [60], 60));
    p.seek(-10);
    expect(p.position).toBe(0);
    p.seek(99);
    expect(p.position).toBe(1);
  });
});
