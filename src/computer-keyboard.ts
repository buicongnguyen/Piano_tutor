import { noteName } from "./music";
import type { Player } from "./audio";
export const pcOffsets: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
};
export function computerNote(code: string, octave: number) {
  return Object.hasOwn(pcOffsets, code) &&
    Number.isInteger(octave) &&
    octave >= 2 &&
    octave <= 6
    ? 12 * (octave + 1) + pcOffsets[code]
    : undefined;
}
export function mountComputerKeyboard(player: Player) {
  const root = document.querySelector<HTMLElement>("#computer-keys")!;
  const octaveSelect =
    document.querySelector<HTMLSelectElement>("#computer-octave")!;
  const buttons = new Map<string, HTMLButtonElement>();
  const held = new Map<string, { midi: number; stop?: () => void }>();
  let octave = 4;
  const release = (code: string) => {
    held.get(code)?.stop?.();
    held.delete(code);
  };
  const releaseAll = () => {
    for (const code of held.keys()) release(code);
  };
  player.onSilence.add(releaseAll);
  const press = async (code: string) => {
    if (held.has(code)) return;
    const midi = computerNote(code, octave);
    if (midi === undefined) return;
    const entry = { midi } as { midi: number; stop?: () => void };
    held.set(code, entry);
    try {
      await player.init();
      if (held.get(code) === entry) entry.stop = player.hold(midi);
    } catch {
      if (held.get(code) !== entry) return;
      release(code);
      document.querySelector("#status")!.textContent =
        "Audio could not start. Try the key again.";
    }
  };
  const render = () => {
    root.replaceChildren();
    buttons.clear();
    for (const row of [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";"],
    ]) {
      const container = document.createElement("div");
      container.className = "pc-row";
      for (const label of row) {
        const code = label === ";" ? "Semicolon" : `Key${label}`;
        const midi = computerNote(code, octave);
        const key = document.createElement("button");
        key.className = "pc-key";
        const letter = document.createElement("kbd");
        letter.textContent = label;
        const name = document.createElement("small");
        name.textContent = midi === undefined ? "—" : noteName(midi);
        key.append(letter, name);
        key.disabled = midi === undefined;
        key.setAttribute(
          "aria-label",
          midi === undefined
            ? `${label} unassigned`
            : `Computer ${label}: ${noteName(midi)}`,
        );
        key.onpointerdown = (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          key.setPointerCapture(event.pointerId);
          void press(code);
        };
        key.onpointerup = () => release(code);
        key.onpointercancel = () => release(code);
        key.onlostpointercapture = () => release(code);
        key.onkeydown = (event) => {
          if (event.code === "Space" || event.code === "Enter") {
            event.preventDefault();
            void press(code);
          }
        };
        key.onkeyup = (event) => {
          if (event.code === "Space" || event.code === "Enter") {
            event.preventDefault();
            release(code);
          }
        };
        key.onblur = () => release(code);
        buttons.set(code, key);
        container.append(key);
      }
      root.append(container);
    }
  };
  octaveSelect.onchange = () => {
    releaseAll();
    octave = Number(octaveSelect.value);
    render();
  };
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      event.repeat ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !(target instanceof HTMLElement) ||
      target.isContentEditable ||
      target.closest(
        'input,select,textarea,[contenteditable="true"],#collection-picker,dialog[open]',
      )
    )
      return;
    if (computerNote(event.code, octave) !== undefined) {
      event.preventDefault();
      void press(event.code);
    }
  });
  document.addEventListener("keyup", (event) => release(event.code));
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAll();
  });
  document.querySelector("#instrument")!.addEventListener("change", releaseAll);
  render();
  return (active: number[]) => {
    for (const [code, key] of buttons) {
      const midi = computerNote(code, octave);
      key.classList.toggle(
        "pc-active",
        held.has(code) || (midi !== undefined && active.includes(midi)),
      );
    }
    const heldLabels = new Set(
      [...held.values()].map((n) => `Play ${noteName(n.midi)}`),
    );
    for (const key of document.querySelectorAll<HTMLElement>(
      "#keyboard .key",
    )) {
      key.classList.toggle(
        "pc-held",
        heldLabels.has(key.getAttribute("aria-label") || ""),
      );
    }
  };
}
