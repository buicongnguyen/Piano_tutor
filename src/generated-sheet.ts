import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { Piece } from "./music";
import { transcribe } from "./transcription";

export function mountGeneratedSheet(root: HTMLElement, piece: Piece) {
  const score = transcribe(piece);
  const help = document.createElement("p");
  help.className = "instrument-tip";
  help.textContent =
    "Generated transcription · approximate 4/4 bars and sixteenth-note rhythm, with a visual treble/bass split. Playback keeps the original MIDI timing and sound. Not the original edition.";
  const controls = document.createElement("div");
  controls.className = "generated-sheet-controls";
  const previous = document.createElement("button"),
    next = document.createElement("button"),
    label = document.createElement("span"),
    download = document.createElement("button");
  previous.textContent = "← Previous";
  next.textContent = "Next →";
  download.textContent = "↓ This page · MusicXML";
  label.setAttribute("role", "status");
  controls.append(previous, label, next, download);
  const host = document.createElement("div");
  root.replaceChildren(help, controls, host);
  let page = 0,
    generation = 0,
    renderer: OpenSheetMusicDisplay | undefined;
  const render = async () => {
    const id = ++generation;
    renderer = undefined;
    previous.disabled = page === 0;
    next.disabled = page === score.pages - 1;
    label.textContent = `Page ${page + 1} / ${score.pages} · loading…`;
    const canvas = document.createElement("div");
    host.replaceChildren(canvas);
    try {
      const instance = new OpenSheetMusicDisplay(canvas, {
        autoResize: false,
        drawTitle: false,
        drawComposer: false,
        backend: "svg",
      });
      await instance.load(score.xml(page));
      if (generation !== id || !canvas.isConnected) return;
      instance.render();
      renderer = instance;
      label.textContent = `Page ${page + 1} / ${score.pages}`;
    } catch {
      if (generation !== id) return;
      label.textContent =
        "Unable to engrave this page. Piano roll remains available.";
    }
  };
  previous.onclick = () => {
    if (page > 0) {
      page--;
      void render();
    }
  };
  next.onclick = () => {
    if (page < score.pages - 1) {
      page++;
      void render();
    }
  };
  download.onclick = () => {
    const url = URL.createObjectURL(
      new Blob([score.xml(page)], {
        type: "application/vnd.recordare.musicxml+xml",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `transcription-page-${page + 1}.musicxml`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  void render();
  return () => renderer?.render();
}
