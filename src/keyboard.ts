import { noteName } from "./music";
import type { Player } from "./audio";
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);
export function keyboardLayout(first: number, last: number) {
  const notes = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const whiteCount = notes.filter((m) => !isBlack(m)).length;
  let white = 0;
  return {
    whiteCount,
    keys: notes.map((midi) => {
      const black = isBlack(midi);
      const left = ((black ? white - 0.32 : white++) / whiteCount) * 100;
      return { midi, black, left };
    }),
  };
}
export function mountKeyboard(player: Player) {
  const root = document.querySelector<HTMLElement>("#keyboard")!;
  const keys = new Map<number, HTMLButtonElement>();
  const held = new Map<HTMLButtonElement, { stop?: () => void }>();
  const release = (key: HTMLButtonElement) => {
    const note = held.get(key);
    held.delete(key);
    note?.stop?.();
    key.classList.remove("pressed");
  };
  const releaseAll = () => {
    for (const key of held.keys()) release(key);
  };
  player.onSilence.add(releaseAll);
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAll();
  });
  let full = false;
  const render = () => {
    releaseAll();
    const layout = keyboardLayout(full ? 21 : 36, full ? 108 : 84);
    keys.clear();
    root.replaceChildren();
    root.style.setProperty("--white-count", String(layout.whiteCount));
    root.classList.toggle("full-range", full);
    for (const { midi, black, left } of layout.keys) {
      const b = document.createElement("button");
      b.className = `key ${black ? "black" : "white"}`;
      b.style.left = `${left}%`;
      b.setAttribute("aria-label", `Play ${noteName(midi)}`);
      const label = document.createElement("span");
      label.className = "note-label";
      label.textContent = noteName(midi);
      b.append(label);
      if (midi === 60) {
        b.classList.add("middle-c");
        const marker = document.createElement("i");
        marker.className = "middle-c-dot";
        b.append(marker);
      }
      const press = async () => {
        if (held.has(b)) return;
        const note: { stop?: () => void } = {};
        held.set(b, note);
        b.classList.add("pressed");
        try {
          await player.init();
          if (held.get(b) !== note) return;
          note.stop = player.hold(midi);
        } catch {
          if (held.get(b) !== note) return;
          release(b);
          document.querySelector("#status")!.textContent =
            "Audio could not start. Try the key again.";
        }
      };
      b.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        b.setPointerCapture(event.pointerId);
        void press();
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        b.addEventListener(event, () => release(b));
      b.onkeydown = (event) => {
        if (event.code !== "Space" && event.code !== "Enter") return;
        event.preventDefault();
        if (!event.repeat) void press();
      };
      b.onkeyup = (event) => {
        if (event.code !== "Space" && event.code !== "Enter") return;
        event.preventDefault();
        release(b);
      };
      b.onblur = () => release(b);
      // Assistive technology may activate a button without pointer/key events.
      b.onclick = (event) => {
        if (event.detail !== 0 || held.has(b)) return;
        void press();
        const note = held.get(b);
        setTimeout(() => {
          if (held.get(b) === note) release(b);
        }, 250);
      };
      keys.set(midi, b);
      root.append(b);
    }
    document.querySelector("#range-label")!.textContent = full
      ? "88 KEYS · A0 — C8"
      : "49 KEYS · C2 — C6";
    document
      .querySelector("#range-toggle")!
      .setAttribute("aria-pressed", String(full));
  };
  document.querySelector<HTMLButtonElement>("#range-toggle")!.onclick = () => {
    full = !full;
    render();
  };
  const labels = document.querySelector<HTMLButtonElement>("#labels-toggle")!;
  labels.onclick = () => {
    const hide = root.classList.toggle("hide-labels");
    labels.setAttribute("aria-pressed", String(!hide));
  };
  render();
  return keys;
}
