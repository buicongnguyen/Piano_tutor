import { shell } from "./shell";
import { mountKeyboard } from "./keyboard";
import { loadRepertoire } from "./repertoire";
import { musicMatches } from "./collection";
import { openScorePicker } from "./import-picker";
import { hasBothHands } from "./practice";
import { findDiscoverSongs } from "./discover";
import { mountTheme } from "./theme";
import { mountWaterfall } from "./waterfall";
import { mountComputerKeyboard } from "./computer-keyboard";
import "./style.css";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { exercise, parseXml, parseMidi, noteName, type Piece } from "./music";
import {
  Player,
  activeAt,
  instruments,
  instrumentTips,
  type InstrumentId,
} from "./audio";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const player = new Player();
const library = [
  exercise(
    "Morning light",
    [
      60, 64, 67, 72, 71, 67, 64, 62, 60, 65, 69, 72, 74, 69, 65, 62, 59, 62,
      67, 71, 74, 71, 67, 62, 60, 64, 67, 72, 67, 64, 62, 60,
    ],
    84,
  ),
  exercise(
    "A little room to breathe",
    [64, 67, 69, 67, 62, 65, 69, 65, 60, 64, 67, 64, 59, 62, 67, 62],
    72,
  ),
];
// Two independent staves: sustained left-hand chords under the right-hand melody.
let duet = library[0].xml!.replace("<staves>2</staves>", "");
duet = duet
  .replace("<clef>", '<staves>2</staves><clef number="1">')
  .replace(
    "</clef>",
    '</clef><clef number="2"><sign>F</sign><line>4</line></clef>',
  );
let measure = 0;
duet = duet.replace(/<\/measure>/g, () => {
  const roots = [48, 53, 43, 48, 48, 53, 43, 48];
  const root = roots[measure++];
  return `<backup><duration>4</duration></backup>${[root, root + 7].map((m, i) => `<note>${i ? "<chord/>" : ""}<pitch><step>${["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"][m % 12]}</step><octave>${Math.floor(m / 12) - 1}</octave></pitch><duration>4</duration><voice>2</voice><type>whole</type><staff>2</staff></note>`).join("")}</measure>`;
});
library[0] = parseXml(duet);
$("#app").innerHTML = shell;
mountTheme($<HTMLSelectElement>("#theme"));
const pianoOptions = $<HTMLDetailsElement>("#piano-options");
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !pianoOptions.contains(event.target))
    pianoOptions.open = false;
});
pianoOptions.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    pianoOptions.open = false;
    pianoOptions.querySelector<HTMLElement>("summary")!.focus();
  }
});
const instrumentSelect = $<HTMLSelectElement>("#instrument");
for (const [id, instrument] of Object.entries(instruments)) {
  instrumentSelect.add(new Option(instrument.label, id));
}
$("#original-instruments").onclick = () => {
  player.setOriginalInstruments(!player.originalInstruments);
  status("Sound mode changed. Press Play to continue.");
};
instrumentSelect.onchange = async () => {
  player.setOriginalInstruments(false);
  const id = instrumentSelect.value as InstrumentId;
  $("#instrument-tip").textContent = instrumentTips[id] ?? "";
  $("#instrument-tip").hidden = !instrumentTips[id];
  try {
    await player.setInstrument(id);
    if (player.instrument === id)
      status(
        `${player.instrumentLabel} ready. Press Play to continue from this position.`,
      );
  } catch {
    status(
      `${player.instrumentLabel} could not load. Synth piano fallback is active; use Load sound to retry.`,
    );
  }
};
let cursorTimes: number[] = [],
  cursorIndex = 0;
let current: Piece,
  osmd: OpenSheetMusicDisplay | undefined,
  view = "sheet",
  loadId = 0;
const time = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const status = (s: string) => {
  $("#status").textContent = s;
};
function renderLibrary() {
  const el = $("#library");
  el.replaceChildren();
  const query = $<HTMLInputElement>("#collection-search").value;
  const matches = library.filter((p) =>
    musicMatches(p.title, p.composer, query),
  );
  library.forEach((p, i) => {
    if (!matches.includes(p)) return;
    const b = document.createElement("button");
    b.className = "piece" + (p === current ? " active" : "");
    const n = document.createElement("span");
    n.className = "piece-num";
    n.textContent = String(i + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = p.title;
    const sub = document.createElement("small");
    sub.textContent = `${p.composer} · ${time(p.duration)}`;
    b.setAttribute("aria-pressed", String(p === current));
    label.append(sub);
    b.append(n, label);
    b.onclick = () => {
      $<HTMLDetailsElement>("#collection-picker").open = false;
      $("#collection-picker summary").focus();
      void select(p);
    };
    el.append(b);
  });
  $("#count").textContent = String(library.length);
  $("#collection-current").textContent = current?.title || "Choose music";
  $("#collection-results").textContent = matches.length
    ? `${matches.length} ${matches.length === 1 ? "piece" : "pieces"} · select, then press Play`
    : "No playable matches. Import a MIDI or MusicXML score.";
  const suggestions = findDiscoverSongs(query);
  if (suggestions.length) {
    const heading = document.createElement("p");
    heading.textContent = "Discover songs · import required";
    el.append(heading);
  }
  for (const song of suggestions) {
    const card = document.createElement("div");
    card.className = "collection-unavailable";
    const title = document.createElement("strong");
    title.textContent = song.title + " · " + song.artist;
    const info = document.createElement("p");
    info.textContent = song.detail;
    const button = document.createElement("button");
    button.textContent = "Import file · " + song.title;
    button.title = "Choose a MIDI or MusicXML file from your device";
    button.onclick = () => {
      $<HTMLDetailsElement>("#collection-picker").open = false;
      $("#import").click();
    };
    const link = document.createElement("a");
    link.textContent = song.sourceLabel + " ↗";
    link.href = song.url;
    link.target = "_blank";
    link.rel = "noopener";
    const note = document.createElement("small");
    note.textContent =
      "Not bundled. Import your permitted MIDI/MusicXML to play in this browser session.";
    card.append(title, info, button, link, note);
    el.append(card);
  }
}
const picker = $<HTMLDetailsElement>("#collection-picker");
const search = $<HTMLInputElement>("#collection-search");
search.addEventListener("input", renderLibrary);
picker.addEventListener("toggle", () => {
  if (picker.open) {
    search.focus();
    search.select();
  }
});
picker.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    picker.open = false;
    $("#collection-picker summary").focus();
  }
  if (event.target === search && event.key === "ArrowDown") {
    event.preventDefault();
    document.querySelector<HTMLButtonElement>("#library button")?.focus();
  }
  if (event.target === search && event.key === "Enter") {
    event.preventDefault();
    document.querySelector<HTMLButtonElement>("#library .piece")?.click();
  }
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !picker.contains(event.target))
    picker.open = false;
});
function updatePracticeControls() {
  const select = $<HTMLSelectElement>("#practice-mode");
  const supported = hasBothHands(current.notes);
  for (const option of select.options)
    option.disabled = option.value !== "listen" && !supported;
  select.value = player.practiceHand ?? "listen";
  $<HTMLButtonElement>("#metronome").disabled = !player.beats.length;
  $("#metronome").setAttribute("aria-pressed", String(player.metronome));
  $("#practice-info").textContent = !supported
    ? "Hand practice needs a score with both hands fully identified. No pitch-based guessing is used."
    : player.practiceHand
      ? "You play the " +
        player.practiceHand +
        " hand; the opposite hand plays automatically. PC bars show your part. Use Speed to slow down. Playback keeps time and does not wait for your notes."
      : "Listen to both hands, or choose a hand to play yourself. Metronome clicks follow quarter-note beats and score tempo changes.";
}
$("#practice-mode").addEventListener("change", () => {
  const value = $<HTMLSelectElement>("#practice-mode").value;
  player.setPracticeHand(
    value === "right" || value === "left" ? value : undefined,
  );
  updatePracticeControls();
  status("Practice mode ready. Press Play to start from this position.");
});
$("#metronome").onclick = () => {
  player.setMetronome(!player.metronome);
  updatePracticeControls();
  status(
    "Metronome " +
      (player.metronome ? "on" : "off") +
      ". Press Play to continue.",
  );
};
async function select(p: Piece) {
  const id = ++loadId;
  player.load(p);
  current = p;
  updatePracticeControls();
  const leftCount = p.notes.filter((n) => n.hand === "left").length,
    rightCount = p.notes.filter((n) => n.hand === "right").length;
  $("#hand-info").textContent =
    leftCount && rightCount
      ? "Both hands identified. Soften the accompaniment or bring the right hand forward."
      : "Only identified hands are adjusted. Unassigned notes keep their original strength.";
  $<HTMLInputElement>("#left-strength").disabled = !leftCount;
  $<HTMLInputElement>("#right-strength").disabled = !rightCount;
  renderLibrary();
  $("#title").textContent = p.title;
  $("#composer").textContent = p.composer;
  $("#note-count").textContent = String(p.notes.length);
  $("#warning").textContent = p.warning || "";
  const edition = $<HTMLAnchorElement>("#edition-link");
  const pdf = $<HTMLAnchorElement>("#pdf-download");
  pdf.hidden = !p.source;
  if (p.source) {
    pdf.href = p.source.sheetUrl;
    pdf.download = p.source.sheetUrl.split("/").at(-1)!;
  }
  edition.hidden = !p.source;
  if (p.source) {
    edition.href = p.source.url;
    edition.title = p.source.edition;
  }
  $("#duration").textContent =
    `${time(p.duration)} · ${p.xml ? "MusicXML score" : "MIDI performance"}`;
  $("#total").textContent = time(p.duration);
  $<HTMLInputElement>("#seek").max = String(p.duration);
  osmd = undefined;
  cursorTimes = [];
  cursorIndex = 0;
  $("#score").replaceChildren();
  $<HTMLButtonElement>("#download").disabled = !p.xml && !p.source;
  $("#download").textContent = p.xml ? "↓ Download score" : "↓ Download MIDI";
  $("#loop").setAttribute("aria-pressed", "false");
  if (p.xml) {
    try {
      const renderer = new OpenSheetMusicDisplay($("#score"), {
        autoResize: false,
        drawTitle: false,
        drawComposer: false,
        backend: "svg",
      });
      await renderer.load(p.xml);
      if (id !== loadId) return;
      renderer.render();
      osmd = renderer;
      if (p.beatToSeconds) {
        const c = renderer.cursor;
        c.reset();
        let guard = 0;
        while (!c.iterator.EndReached && guard++ < 30000) {
          cursorTimes.push(
            p.beatToSeconds(c.iterator.CurrentSourceTimestamp.RealValue * 4),
          );
          c.next();
        }
        c.reset();
        c.show();
      }
    } catch {
      if (id !== loadId) return;
      status(
        "The score could not be engraved. You can still play it in piano roll view.",
      );
      view = "roll";
    }
  } else view = "roll";
  setView(view);
}
function setView(v: string) {
  view = v;
  $("#score").hidden = v !== "sheet";
  $("#roll").hidden = v !== "roll";
  $("#sheet-tab").classList.toggle("selected", v === "sheet");
  $("#roll-tab").classList.toggle("selected", v === "roll");
  if (v === "sheet" && !current.xml) {
    const container = $("#score");
    container.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "midi-sheet";
    const title = document.createElement("h3");
    title.textContent = "The original score, beside your piano.";
    const description = document.createElement("p");
    description.textContent = current.source
      ? "This edition plays from MIDI. Follow its notes in Piano roll, or open the original printable sheet music."
      : "MIDI contains performance notes. Choose Piano roll to see every note, or import MusicXML for engraved notation.";
    empty.append(title, description);
    if (current.source) {
      const link = document.createElement("a");
      link.href = current.source.sheetUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "primary";
      link.textContent = "Open printable score ↗";
      empty.append(link);
      const credit = document.createElement("small");
      credit.textContent = current.source.edition;
      empty.append(credit);
    }
    container.append(empty);
  }
}
// Only the currently selected score may redraw on resize. OSMD's per-instance
// auto-resize callback otherwise survives selection and can repaint an old score.
let resizeTimer: ReturnType<typeof setTimeout>;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (osmd && current.xml && view === "sheet") {
      osmd.render();
      osmd.cursor.show();
    }
  }, 100);
}).observe($(".score-wrap"));
$("#sheet-tab").onclick = () => setView("sheet");
$("#roll-tab").onclick = () => setView("roll");
const dialog = $<HTMLDialogElement>("#import-dialog");
const chooseScore = () => {
  player.pause();
  try {
    openScorePicker($<HTMLInputElement>("#file"));
  } catch {
    if (!dialog.open) dialog.showModal();
    status(
      "File chooser could not open. Use Choose a file below, or try opening this site in your browser.",
    );
  }
};
for (const id of ["#import", "#import-side", "#choose"])
  $(id).onclick = chooseScore;
$("#close-dialog").onclick = () => dialog.close();

$<HTMLInputElement>("#file").onchange = async (e) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  if (dialog.open) dialog.close();
  status(`Reading ${f.name}…`);
  try {
    if (f.size > 5 * 1024 * 1024)
      throw Error("Choose a score smaller than 5 MB.");
    if (!/\.(musicxml|xml|mid|midi)$/i.test(f.name))
      throw Error("Use an uncompressed MusicXML or MIDI file.");
    const p = /\.midi?$/i.test(f.name)
      ? parseMidi(await f.arrayBuffer(), f.name)
      : parseXml(await f.text(), f.name);
    library.push(p);
    await select(p);
    status(
      `Loaded ${p.title}. ${p.notes.length} notes, including simultaneous voices.`,
    );
  } catch (e) {
    status(e instanceof Error ? e.message : "Unable to read this score.");
  }
  input.value = "";
};
$("#play").onclick = async () => {
  try {
    if (player.playing || player.preparing) player.pause();
    else await player.play();
  } catch {
    status("Audio could not start. Try pressing Play again.");
  }
};
$("#restart").onclick = () => player.seek(player.loop ? player.a : 0);
function updateHandControls() {
  for (const hand of ["left", "right"] as const) {
    const value = Math.round(player.handBalance[hand] * 100);
    $<HTMLInputElement>(`#${hand}-strength`).value = String(value);
    $(`#${hand}-value`).textContent = `${value}%`;
  }
  $("#melody-balance").setAttribute(
    "aria-pressed",
    String(player.handBalance.left === 0.75 && player.handBalance.right === 1),
  );
  $("#original-balance").setAttribute(
    "aria-pressed",
    String(player.handBalance.left === 1 && player.handBalance.right === 1),
  );
}
for (const hand of ["left", "right"] as const)
  $<HTMLInputElement>(`#${hand}-strength`).oninput = (e) => {
    player.handBalance[hand] =
      Number((e.target as HTMLInputElement).value) / 100;
    updateHandControls();
  };
$("#melody-balance").onclick = () => {
  player.handBalance = { left: 0.75, right: 1 };
  updateHandControls();
};
$("#original-balance").onclick = () => {
  player.handBalance = { left: 1, right: 1 };
  updateHandControls();
};
$<HTMLInputElement>("#seek").oninput = (e) =>
  player.seek(Number((e.target as HTMLInputElement).value));
$<HTMLSelectElement>("#speed").onchange = (e) =>
  player.setSpeed(Number((e.target as HTMLSelectElement).value));
$<HTMLInputElement>("#volume").oninput = (e) => {
  player.volume = Number((e.target as HTMLInputElement).value);
  if (player.gain) player.gain.gain.value = player.volume * 0.2;
};
$("#loop").onclick = () => {
  player.pause();
  player.loop = !player.loop;
  $("#loop").setAttribute("aria-pressed", String(player.loop));
};
$("#set-a").onclick = () => {
  if (player.position >= player.b - 0.1)
    return status("A must be before B. Seek earlier and try again.");
  player.pause();
  player.a = player.position;
};
$("#set-b").onclick = () => {
  if (player.position <= player.a + 0.1)
    return status("B must be after A. Seek later and try again.");
  player.pause();
  player.b = player.position;
};
$("#download").onclick = () => {
  if (current.source && !current.xml) {
    const a = document.createElement("a");
    a.href = current.source.fileUrl;
    a.download = current.source.fileUrl.split("/").at(-1)!;
    a.click();
    return;
  }
  if (!current.xml) return;
  const url = URL.createObjectURL(
    new Blob([current.xml], { type: "application/vnd.recordare.musicxml+xml" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "score.musicxml";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#sample").onclick = async () => {
  const b = $<HTMLButtonElement>("#sample");
  b.disabled = true;
  $("#sound-label").textContent = "Loading instrument samples…";
  $("#lcd-voice").textContent = "LOADING SOUND…";
  try {
    await player.loadGrand();
    $("#sound-label").textContent =
      `${player.instrumentLabel} · sampled · polyphonic`;
    b.textContent = "Sound ready";
    $("#lcd-voice").textContent = player.instrumentLabel.toUpperCase();
  } catch {
    $("#sound-label").textContent =
      "Sample download unavailable · synth active";
    b.disabled = false;
    $("#lcd-voice").textContent = "SYNTH PIANO";
  }
};
const keys = mountKeyboard(player);
const updateComputerKeyboard = mountComputerKeyboard(player);
const drawWaterfall = mountWaterfall();
document.addEventListener("keydown", async (e) => {
  if (
    e.defaultPrevented ||
    picker.contains(e.target as Node) ||
    pianoOptions.contains(e.target as Node) ||
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    dialog.open ||
    !(e.target instanceof HTMLElement) ||
    e.target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
  )
    return;
  if (e.code === "Space") {
    if ((e.target as HTMLElement).closest("button,a")) return;
    e.preventDefault();
    $("#play").click();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) player.pause();
});
function roll(t: number) {
  const c = $<HTMLCanvasElement>("#roll");
  if (c.hidden) return;
  const w = c.clientWidth || 800,
    h = c.clientHeight || 184;
  const pixelWidth = Math.round(w * devicePixelRatio),
    pixelHeight = Math.round(h * devicePixelRatio);
  if (c.width !== pixelWidth || c.height !== pixelHeight) {
    c.width = pixelWidth;
    c.height = pixelHeight;
  }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const dark = document.documentElement.dataset.theme === "dark";
  ctx.fillStyle = dark ? "#17231f" : "#f7f8f4";
  ctx.fillRect(0, 0, w, h);
  const low = Math.min(...current.notes.map((n) => n.midi)) - 2,
    high = Math.max(...current.notes.map((n) => n.midi)) + 2;
  const yFor = (m: number) => h - 20 - ((m - low) / (high - low)) * (h - 40);
  for (let m = 24; m <= 108; m += 12) {
    if (m < low || m > high) continue;
    const y = yFor(m);
    ctx.strokeStyle = dark ? "#35483e" : "#e0e5dc";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = dark ? "#b0c5b5" : "#84947e";
    ctx.font = "9px sans-serif";
    ctx.fillText(noteName(m), 4, y - 5);
  }
  const span = 12,
    start = Math.max(0, t - 2);
  ctx.strokeStyle = dark ? "#2d3e35" : "#e4e8df";
  for (let i = 0; i < 13; i++) {
    const x = (i * w) / 12;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (const n of current.notes) {
    if (n.time + n.duration < start || n.time > start + span) continue;
    const x = ((n.time - start) / span) * w,
      y = yFor(n.midi);
    ctx.fillStyle =
      n.time <= t && n.time + n.duration > t
        ? "#cf9e56"
        : n.midi < 60
          ? "#89a7a3"
          : dark
            ? "#83bba3"
            : "#2b5a4a";
    ctx.fillRect(x, y, Math.max(0.5, (n.duration / span) * w), 7);
  }
  ctx.fillStyle = "#b88647";
  ctx.fillRect(((t - start) / span) * w, 0, 2, h);
}
setInterval(() => player.tick(), 25);
function frame() {
  if (current) {
    const t = Math.min(current.duration, player.now());
    drawWaterfall(current.notes, t, player.playing);
    if (osmd && view === "sheet" && cursorTimes.length) {
      let target = 0;
      while (
        target + 1 < cursorTimes.length &&
        cursorTimes[target + 1] <= t + 0.001
      )
        target++;
      if (target < cursorIndex) {
        osmd.cursor.reset();
        cursorIndex = 0;
      }
      while (cursorIndex < target) {
        osmd.cursor.next();
        cursorIndex++;
      }
    }
    $("#elapsed").textContent = time(t);
    $<HTMLInputElement>("#seek").value = String(t);
    $("#play").innerHTML = player.preparing
      ? "× <span>Cancel loading</span>"
      : player.playing
        ? "Ⅱ <span>Pause</span>"
        : "▶ <span>Play</span>";
    $("#loop-range").textContent = `${time(player.a)}–${time(player.b)}`;
    const active = player.playing ? activeAt(current.notes, t) : [];
    const practiceNotes = player.practiceHand
      ? current.notes.filter((n) => n.hand === player.practiceHand)
      : current.notes;
    updateComputerKeyboard(
      (player.practiceHand
        ? active.filter((n) => n.hand === player.practiceHand)
        : active
      ).map((n) => n.midi),
      practiceNotes,
      t,
    );
    for (const [m, b] of keys)
      b.classList.toggle(
        "sounding",
        active.some((n) => n.midi === m),
      );
    $("#active-notes").textContent = active.length
      ? active.map((n) => noteName(n.midi)).join(" · ")
      : "Ready when you are";
    $("#lcd-notes").textContent = active.length
      ? active.map((n) => noteName(n.midi)).join(" · ")
      : current.title;
    $("#lcd-time").textContent = time(t);
    $("#lcd-state").textContent = player.playing ? "PLAYING" : "READY";
    const soundLabels = {
      synth: "Selected sound loads when you press Play",
      loading: "Loading instrument samples…",
      grand: `${player.instrumentLabel} · sampled · polyphonic`,
      fallback: "Sample download unavailable · synth active",
    };
    $("#sound-label").textContent =
      player.originalInstruments && player.ensembleStatus
        ? player.ensembleStatus
        : soundLabels[player.soundState];
    $("#original-instruments").setAttribute(
      "aria-pressed",
      String(player.originalInstruments),
    );
    $("#lcd-voice").textContent =
      player.originalInstruments && player.ensembleStatus
        ? "MIDI ENSEMBLE"
        : player.soundState === "grand"
          ? player.instrumentLabel.toUpperCase()
          : player.soundState === "loading"
            ? "LOADING GRAND…"
            : "SYNTH PIANO";
    const sample = $<HTMLButtonElement>("#sample");
    sample.disabled =
      player.soundState === "grand" || player.soundState === "loading";
    sample.textContent =
      player.soundState === "grand"
        ? "Sound ready"
        : player.soundState === "loading"
          ? "Loading sound…"
          : "Load sound";
    roll(t);
  }
  requestAnimationFrame(frame);
}
void select(library[0]);
void loadRepertoire().then(async ({ pieces, failures }) => {
  const untouched =
    loadId === 1 &&
    !player.playing &&
    !player.preparing &&
    player.position === 0;
  library.unshift(...pieces);
  renderLibrary();
  if (untouched && pieces.length) await select(pieces[0]);
  status(
    failures
      ? "Some collection files could not load. Your exercises and local imports are still available."
      : `${pieces.length} complete MIDI selections, with downloadable PDF scores. Grand piano loads automatically.`,
  );
});
frame();
