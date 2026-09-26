// Player input: physical keys (event.code, so any keyboard language works),
// touch/mouse on the road, and Web MIDI keyboards. Everything becomes
// lane down/up events stamped with the event's performance time.
import { computerNote } from "../computer-keyboard";

export type LaneEvent = { down: boolean; lane: number; at: number; source: "key" | "touch" | "midi" };

export const LANE_KEYS: Record<number, string[]> = {
  4: ["KeyD", "KeyF", "KeyJ", "KeyK"],
  6: ["KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"],
};
export const LANE_LABELS: Record<number, string[]> = {
  4: ["D", "F", "J", "K"],
  6: ["S", "D", "F", "J", "K", "L"],
};
// Arcade lanes on a MIDI keyboard: consecutive white keys from C (any octave).
const WHITE_LANE: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5 };

export type InputMode =
  | { kind: "lanes"; lanes: number }
  | { kind: "piano"; base: number; layout: "chromatic" | "home" };

export function laneForKey(code: string, mode: InputMode): number | undefined {
  if (mode.kind === "lanes") {
    const i = LANE_KEYS[mode.lanes]?.indexOf(code) ?? -1;
    return i >= 0 ? i : undefined;
  }
  const octave = Math.round(mode.base / 12) - 1;
  return computerNote(code, octave, 2, mode.layout === "home" ? "home" : "classic");
}

export function laneForMidi(midi: number, mode: InputMode): number | undefined {
  if (mode.kind === "piano") return midi;
  const lane = WHITE_LANE[midi % 12];
  return lane !== undefined && lane < mode.lanes ? lane : undefined;
}

export class Input {
  mode: InputMode = { kind: "lanes", lanes: 6 };
  enabled = false;
  onLane?: (e: LaneEvent) => void;
  onAction?: (action: "encore" | "pause" | "confirm" | "back") => void;
  pointerLane?: (clientX: number, clientY: number) => number | undefined;
  midiName = "";
  private keys = new Map<string, number>(); // code -> lane held
  private pointers = new Map<number, number>(); // pointerId -> lane
  private midiHeld = new Map<number, number>();

  constructor(readonly surface: HTMLElement) {
    addEventListener("keydown", (e) => this.keydown(e));
    addEventListener("keyup", (e) => this.keyup(e));
    addEventListener("blur", () => this.releaseAll());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseAll();
    });
    surface.addEventListener("pointerdown", (e) => this.pointerdown(e));
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const)
      surface.addEventListener(type, (e) => this.pointerup(e as PointerEvent));
    surface.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  setMode(mode: InputMode) {
    this.releaseAll();
    this.mode = mode;
  }

  releaseAll() {
    const at = performance.now();
    const lanes = new Set([...this.laneCount.keys()]);
    this.keys.clear();
    this.pointers.clear();
    this.midiHeld.clear();
    this.laneCount.clear();
    for (const lane of lanes) this.onLane?.({ down: false, lane, at, source: "key" });
  }

  // Several inputs can hold one lane (two MIDI keys, two fingers): a lane is
  // released only when the last of them lets go.
  private laneCount = new Map<number, number>();

  private down(lane: number, at: number, source: LaneEvent["source"]) {
    this.laneCount.set(lane, (this.laneCount.get(lane) ?? 0) + 1);
    this.onLane?.({ down: true, lane, at, source });
  }

  private up(lane: number, at: number, source: LaneEvent["source"]) {
    const n = (this.laneCount.get(lane) ?? 0) - 1;
    if (n > 0) {
      this.laneCount.set(lane, n);
      return;
    }
    this.laneCount.delete(lane);
    this.onLane?.({ down: false, lane, at, source });
  }

  private typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t?.closest?.("input, select, textarea, [contenteditable='true']");
  }

  private keydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Escape always works, even with a slider or checkbox focused.
    if (e.code === "Escape") {
      e.preventDefault();
      if (!e.repeat) this.onAction?.(this.enabled ? "pause" : "back");
      return;
    }
    if (this.typing(e) || !this.enabled) return;
    const lane = laneForKey(e.code, this.mode);
    // P pauses unless the real-piano layout uses it as a note.
    if (e.code === "KeyP" && lane === undefined) {
      e.preventDefault();
      if (!e.repeat) this.onAction?.("pause");
      return;
    }
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (!e.repeat) this.onAction?.("encore");
      return;
    }
    if (lane === undefined) return;
    e.preventDefault();
    if (e.repeat) return;
    // A fresh (non-repeat) keydown for a key we think is held means its keyup
    // was swallowed (e.g. by a Cmd shortcut on macOS): release it first.
    const stale = this.keys.get(e.code);
    if (stale !== undefined) this.up(stale, e.timeStamp || performance.now(), "key");
    this.keys.set(e.code, lane);
    this.down(lane, e.timeStamp || performance.now(), "key");
  }

  private keyup(e: KeyboardEvent) {
    const lane = this.keys.get(e.code);
    if (lane === undefined) return;
    this.keys.delete(e.code);
    this.up(lane, e.timeStamp || performance.now(), "key");
  }

  private pointerdown(e: PointerEvent) {
    if (!this.enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const lane = this.pointerLane?.(e.clientX, e.clientY);
    if (lane === undefined) return;
    e.preventDefault();
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events cannot be captured */
    }
    this.pointers.set(e.pointerId, lane);
    this.down(lane, e.timeStamp || performance.now(), "touch");
  }

  private pointerup(e: PointerEvent) {
    const lane = this.pointers.get(e.pointerId);
    if (lane === undefined) return;
    this.pointers.delete(e.pointerId);
    this.up(lane, e.timeStamp || performance.now(), "touch");
  }

  /** Ask for Web MIDI once the player opts in; returns the connected input names. */
  async connectMidi(): Promise<string[]> {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!nav.requestMIDIAccess) throw Error("This browser has no Web MIDI support. Try Chrome or Edge.");
    const access = await nav.requestMIDIAccess();
    const attach = () => {
      const names: string[] = [];
      access.inputs.forEach((input) => {
        names.push(input.name || "MIDI keyboard");
        input.onmidimessage = (m) => this.midi(m);
      });
      this.midiName = names.join(", ");
      return names;
    };
    access.onstatechange = () => attach();
    return attach();
  }

  private midi(m: MIDIMessageEvent) {
    const data = m.data;
    if (!data || data.length < 3) return;
    const status = data[0] & 0xf0,
      note = data[1],
      velocity = data[2];
    const at = m.timeStamp || performance.now();
    if (status === 0x90 && velocity > 0) {
      if (!this.enabled) return;
      const lane = laneForMidi(note, this.mode);
      if (lane === undefined) return;
      const stale = this.midiHeld.get(note);
      if (stale !== undefined) this.up(stale, at, "midi");
      this.midiHeld.set(note, lane);
      this.down(lane, at, "midi");
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      const lane = this.midiHeld.get(note);
      if (lane === undefined) return;
      this.midiHeld.delete(note);
      this.up(lane, at, "midi");
    }
  }
}
