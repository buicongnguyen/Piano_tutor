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
$("#app").innerHTML =
  `<aside><a class="brand" href="./"><span class="brand-icon">♮</span> stillnote<span class="brand-dot">.</span></a><div class="eyebrow">YOUR PIANO STUDIO</div><div class="nav-item">▤ <span>Practice library</span><span class="count" id="count">2</span></div><div class="library-label">YOUR MUSIC <span>♫</span></div><div id="library"></div><button class="import-side" id="import-side">＋ Import a score</button><div class="reference"><span class="eyebrow">ON YOUR MUSIC STAND</span><h3>River Flows in You</h3><p>Yiruma</p><p class="small">For the full two-hand sound, import your own MusicXML or MIDI arrangement.</p><a href="https://virtualpiano.net/?song-post-14075" target="_blank" rel="noopener">Open online piano ↗</a><a href="https://www.virtualsheetmusic.com/score/HL-302236.html" target="_blank" rel="noopener">Find licensed sheet music ↗</a></div><div class="aside-bottom"><span class="status-dot"></span> A little practice, every day.</div></aside><main><header><div><span class="eyebrow">SLOW DOWN. FIND YOUR FLOW.</span><h1>Make time for music.</h1><p>Your scores, your pace. One note at a time.</p></div><button class="primary" id="import">↑ &nbsp; Import score</button></header><input hidden id="file" type="file" accept=".xml,.musicxml,.mid,.midi"><div id="status" role="status">Choose a piece, then press play. Scores stay on this device for this session.</div><section class="workspace"><div class="piece-header"><div class="piece-icon">♫</div><div><span class="eyebrow">NOW ON THE STAND</span><h2 id="title"></h2><p id="composer"></p></div><span class="badge">PIANO · <span id="note-count"></span> NOTES</span></div><div class="view-toolbar"><div class="tabs"><button class="selected" id="sheet-tab">Sheet music</button><button id="roll-tab">Piano roll</button></div><span id="duration"></span></div><div class="score-wrap"><div id="score"></div><canvas id="roll" hidden aria-label="Piano roll showing all simultaneous notes"></canvas></div><div class="score-caption"><span id="warning"></span><button id="download">↓ Download score</button></div><div class="transport"><div class="seek-row"><span id="elapsed">0:00</span><input id="seek" aria-label="Playback position" type="range" min="0" step="0.01" value="0"><span id="total">0:00</span></div><div class="controls"><div class="play-controls"><button id="restart" aria-label="Restart">↤</button><button id="play" class="play">▶ <span>Play</span></button></div><label>Speed <select id="speed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><div class="loop-controls"><button id="loop" aria-pressed="false">⟳ Loop</button><button id="set-a">Set A</button><button id="set-b">Set B</button><small id="loop-range"></small></div><label class="volume">Volume <input id="volume" aria-label="Volume" type="range" min="0" max="1" step=".01" value=".65"></label></div></div></section><section class="keyboard-section"><div class="keyboard-heading"><div><span class="eyebrow">MEET THE KEYS</span><h3>Play along, or just explore.</h3></div><div class="sound"><button id="sample">Load grand piano</button><span id="sound-label">Synth piano · polyphonic</span></div></div><div class="keyboard-scroll"><div id="keyboard"></div></div><div class="key-caption"><span><i class="legend"></i> <span id="active-notes">Ready when you are</span></span><span>Keyboard: A W S E D F T G Y H U J K · C4–C5</span></div></section><footer>Built for the joy of playing.<span>MusicXML & MIDI · Local imports · No account needed</span></footer></main><dialog id="import-dialog"><h2>Bring your own music.</h2><p>Choose a MusicXML or MIDI file to see it, slow it down, and play it with both hands.</p><div class="upload-zone"><span>↑</span><button class="primary" id="choose">Choose a score</button><p>.musicxml, .xml, .mid, .midi · up to 5 MB</p></div><p class="small">PDFs and photos are visual sheets, not playable note data. Convert them to uncompressed MusicXML in notation software first. Imported scores are kept only until you reload.</p><button id="close-dialog">Back to practice</button></dialog>`;
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
    sub.textContent = p.composer;
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
  renderLibrary();
  $("#title").textContent = p.title;
  $("#composer").textContent = p.composer;
  $("#note-count").textContent = String(p.notes.length);
  $("#warning").textContent = p.warning || "";
  $("#duration").textContent =
    `${time(p.duration)} · ${p.xml ? "MusicXML score" : "MIDI performance"}`;
  $("#total").textContent = time(p.duration);
  $<HTMLInputElement>("#seek").max = String(p.duration);
  osmd = undefined;
  cursorTimes = [];
  cursorIndex = 0;
  $("#score").replaceChildren();
  $<HTMLButtonElement>("#download").disabled = !p.xml;
  $("#loop").setAttribute("aria-pressed", "false");
  if (p.xml) {
    try {
      const renderer = new OpenSheetMusicDisplay($("#score"), {
        autoResize: true,
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
  if (v === "sheet" && !current.xml)
    $("#score").textContent =
      "MIDI contains performance notes. Choose Piano roll to see them.";
}
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
    if (player.playing) player.pause();
    else await player.play();
  } catch {
    status("Audio could not start. Try pressing Play again.");
  }
};
$("#restart").onclick = () => player.seek(player.loop ? player.a : 0);
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
  try {
    await player.loadGrand();
    $("#sound-label").textContent = "Steinway grand · polyphonic";
    b.textContent = "Grand piano ready";
  } catch {
    $("#sound-label").textContent =
      "Sample download unavailable · synth active";
    b.disabled = false;
  }
};
const keyMap = "awsedftgyhujk",
  pitches = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];
const keys = new Map<number, HTMLButtonElement>();
let white = 0;
for (let m = 48; m <= 84; m++) {
  const black = [1, 3, 6, 8, 10].includes(m % 12),
    b = document.createElement("button");
  b.className = "key " + (black ? "black" : "white");
  b.style.left = `${black ? (white * 100) / 22 - (100 / 22) * 0.32 : (white++ * 100) / 22}%`;
  b.setAttribute("aria-label", `Play ${noteName(m)}`);
  b.textContent = noteName(m);
  b.onpointerdown = async (e) => {
    e.preventDefault();
    await player.init();
    player.tone(m, 1.3);
    b.classList.add("pressed");
    setTimeout(() => b.classList.remove("pressed"), 250);
  };
  keys.set(m, b);
  $("#keyboard").append(b);
}
document.addEventListener("keydown", async (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    dialog.open ||
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
      (e.target as HTMLElement).tagName,
    )
  )
    return;
  const i = keyMap.indexOf(e.key.toLowerCase());
  if (i >= 0) {
    await player.init();
    player.tone(pitches[i], 1.3);
  }
  if (e.code === "Space") {
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
    h = 260;
  c.width = w * devicePixelRatio;
  c.height = h * devicePixelRatio;
  const ctx = c.getContext("2d")!;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.fillStyle = "#f7f8f4";
  ctx.fillRect(0, 0, w, h);
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
      y = 240 - ((n.midi - 36) / 60) * 220;
    ctx.fillStyle =
      n.time <= t && n.time + n.duration > t
        ? "#cf9e56"
        : n.midi < 60
          ? "#89a7a3"
          : "#2b5a4a";
    ctx.fillRect(x, y, Math.max(3, (n.duration / span) * w - 2), 7);
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
    $("#play").innerHTML = player.playing
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
    roll(t);
  }
  requestAnimationFrame(frame);
}
void select(library[0]);
frame();
