import { shell } from "./shell";
import { mountKeyboard } from "./keyboard";
import { loadRepertoire } from "./repertoire";
import "./style.css";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { exercise, parseXml, parseMidi, noteName, type Piece } from "./music";
import { Player, activeAt } from "./audio";
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
  library.forEach((p, i) => {
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
    b.onclick = () => void select(p);
    el.append(b);
  });
  $("#count").textContent = String(library.length);
}
async function select(p: Piece) {
  const id = ++loadId;
  player.load(p);
  current = p;
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
for (const id of ["#import", "#import-side"])
  $(id).onclick = () => dialog.showModal();
$("#close-dialog").onclick = () => dialog.close();
$("#choose").onclick = () => $<HTMLInputElement>("#file").click();
$<HTMLInputElement>("#file").onchange = async (e) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  dialog.close();
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
  $("#sound-label").textContent = "Loading piano samples…";
  $("#lcd-voice").textContent = "LOADING GRAND…";
  try {
    await player.loadGrand();
    $("#sound-label").textContent = "Steinway grand · polyphonic";
    b.textContent = "Grand piano ready";
    $("#lcd-voice").textContent = "STEINWAY GRAND";
  } catch {
    $("#sound-label").textContent =
      "Sample download unavailable · synth active";
    b.disabled = false;
    $("#lcd-voice").textContent = "SYNTH PIANO";
  }
};
const keyMap = "awsedftgyhujk",
  pitches = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];
const keys = mountKeyboard(player);
document.addEventListener("keydown", async (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    dialog.open ||
    ["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
  )
    return;
  const i = keyMap.indexOf(e.key.toLowerCase());
  if (i >= 0) {
    await player.init();
    player.tone(pitches[i], 1.3);
  }
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
  c.width = w * devicePixelRatio;
  c.height = h * devicePixelRatio;
  const ctx = c.getContext("2d")!;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.fillStyle = "#f7f8f4";
  ctx.fillRect(0, 0, w, h);
  const low = Math.min(...current.notes.map((n) => n.midi)) - 2,
    high = Math.max(...current.notes.map((n) => n.midi)) + 2;
  const yFor = (m: number) => h - 20 - ((m - low) / (high - low)) * (h - 40);
  for (let m = 24; m <= 108; m += 12) {
    if (m < low || m > high) continue;
    const y = yFor(m);
    ctx.strokeStyle = "#e0e5dc";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = "#84947e";
    ctx.font = "9px sans-serif";
    ctx.fillText(noteName(m), 4, y - 5);
  }
  const span = 12,
    start = Math.max(0, t - 2);
  ctx.strokeStyle = "#e4e8df";
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
          : "#2b5a4a";
    ctx.fillRect(x, y, Math.max(0.5, (n.duration / span) * w), 7);
  }
  ctx.fillStyle = "#b88647";
  ctx.fillRect(((t - start) / span) * w, 0, 2, h);
}
setInterval(() => player.tick(), 25);
function frame() {
  if (current) {
    const t = player.position;
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
      synth: "Grand piano loads when you press Play",
      loading: "Loading piano samples…",
      grand: "Steinway grand · polyphonic",
      fallback: "Sample download unavailable · synth active",
    };
    $("#sound-label").textContent = soundLabels[player.soundState];
    $("#lcd-voice").textContent =
      player.soundState === "grand"
        ? "STEINWAY GRAND"
        : player.soundState === "loading"
          ? "LOADING GRAND…"
          : "SYNTH PIANO";
    const sample = $<HTMLButtonElement>("#sample");
    sample.disabled =
      player.soundState === "grand" || player.soundState === "loading";
    sample.textContent =
      player.soundState === "grand"
        ? "Grand piano ready"
        : player.soundState === "loading"
          ? "Loading grand…"
          : "Load grand piano";
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
      : `${pieces.length} complete piano selections, with downloadable PDF scores. Grand piano loads automatically.`,
  );
});
frame();
