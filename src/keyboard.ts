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
  let full = false;
  const render = () => {
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
      // Native click supports mouse, touch, Enter and Space equally.
      b.onclick = async () => {
        try {
          await player.init();
          player.tone(midi, 1.3);
          b.classList.add("pressed");
          setTimeout(() => b.classList.remove("pressed"), 220);
        } catch {
          document.querySelector("#status")!.textContent =
            "Audio could not start. Try the key again.";
        }
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
