import type { Player } from "./audio";
import { mountStudioStage } from "./studio-stage";
import { noteName, type Piece } from "./music";
import {
  phrasesFor,
  progressKey,
  Performance,
  readProgress,
  saveProgress,
  type Phrase,
  type Progress,
} from "./journey";

export function mountJourney(
  player: Player,
  library: Piece[],
  select: (p: Piece) => Promise<void>,
) {
  const root = document.createElement("section");
  root.className = "journey";
  root.setAttribute("aria-label", "Light the River learning journey");
  root.innerHTML = `<div class="journey-top"><div><span class="eyebrow">LIGHT THE RIVER</span><h2>A little music. A brighter river.</h2></div><nav aria-label="Studio mode"><button data-mode="listen" aria-pressed="true">Listen</button><button data-mode="learn" aria-pressed="false">Learn</button><button data-mode="perform" aria-pressed="false">Perform</button></nav></div><div class="river-scene" aria-hidden="true"><div class="river-moon"></div><div class="river-water"></div><div class="river-lanterns"></div></div><div class="journey-row"><label>Destination <select id="journey-route"></select></label><label>Phrase <select id="journey-phrase"></select></label><button id="journey-start" class="primary">Start phrase</button><button id="journey-stop" hidden>Stop challenge</button><button id="journey-guide" aria-pressed="true">PC guide</button></div><p id="journey-description"></p><p id="journey-feedback" role="status" aria-live="polite">Choose Learn to light your first lantern.</p><div id="journey-progress"></div><div id="journey-result" hidden><h3>Another bend in the river.</h3><p></p><button id="journey-retry">Retry phrase</button><button id="journey-next">Next phrase →</button></div>`;
  document.querySelector(".keyboard-section")!.before(root);
  const stage = mountStudioStage(
    root.querySelector(".river-scene")!,
    root.querySelector(".journey-row")!,
  );
  const sound = document.querySelector<HTMLElement>(".sound")!;
  const advanced = document.createElement("details");
  advanced.className = "studio-settings";
  const summary = document.createElement("summary");
  summary.textContent = "Sound & piano settings";
  sound.before(advanced);
  advanced.append(summary, sound);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
    root.querySelector<T>(s)!;
  const route = $<HTMLSelectElement>("#journey-route"),
    picker = $<HTMLSelectElement>("#journey-phrase");
  let piece: Piece,
    phrases: Phrase[] = [],
    mode = "listen",
    phase: "idle" | "preparing" | "countdown" | "playing" = "idle";
  let index = 0,
    generation = 0,
    startAt = 0,
    gate = 0,
    lastCountdown = -1;
  let run: Performance | undefined, phrase: Phrase;
  const learned = new Set<number>(),
    held = new Map<number, number>();
  let progress: Progress = {};
  try {
    progress = readProgress(localStorage);
  } catch {
    /* Private storage can be unavailable. */
  }
  let saved:
    | {
        hand: Player["practiceHand"];
        loop: boolean;
        end?: number;
        piece?: Piece;
        original: boolean;
      }
    | undefined;
  const disabled = new Map<
    HTMLInputElement | HTMLButtonElement | HTMLSelectElement,
    boolean
  >();
  function feedback(text: string) {
    $("#journey-feedback").textContent = text;
  }
  function restore() {
    if (saved) {
      player.practiceHand = saved.hand;
      player.loop = saved.loop;
      player.playbackEnd = saved.end;
      player.piece = saved.piece;
      player.originalInstruments = saved.original;
      saved = undefined;
    }
    for (const [el, value] of disabled) el.disabled = value;
    disabled.clear();
    $("#journey-stop").hidden = true;
    document.body.classList.remove("challenge-active");
  }
  function cancel(message = "Challenge stopped. Retry whenever you’re ready.") {
    const active = phase !== "idle";
    phase = "idle";
    generation++;
    if (active) {
      player.pause();
      restore();
      feedback(message);
    }
    held.clear();
    refresh();
  }
  function refresh() {
    if (!piece) return;
    const count = phrases.filter(
      (p) => progress[progressKey(piece, p)]?.learned,
    ).length;
    $("#journey-progress").textContent =
      `${count} / ${phrases.length} lanterns lit · progress saved on this device`;
    const lanterns = $(".river-lanterns");
    lanterns.replaceChildren();
    for (const p of phrases.slice(0, 24)) {
      const light = document.createElement("i");
      light.className = progress[progressKey(piece, p)]?.learned ? "lit" : "";
      lanterns.append(light);
    }
    const eligible = phrases.length > 0;
    $<HTMLButtonElement>("#journey-start").disabled =
      mode === "listen" || !eligible || phase !== "idle";
    $<HTMLButtonElement>("#journey-start").textContent =
      mode === "perform" ? "Perform phrase" : "Learn phrase";
    picker.disabled = !eligible || phase !== "idle";
    $("#journey-description").textContent =
      mode === "listen"
        ? "Explore a destination and listen using Play on the piano. Choose Learn when you’re ready."
        : !eligible
          ? "This arrangement has no reliable melody part for challenges. Try Arirang or Morning light; this song is still available in Listen."
          : `${mode === "learn" ? "Wait for the next keys; release them to continue. Timing is not scored." : "Follow the falling notes. Your melody is muted; identified accompaniment plays automatically."} Range ${noteName(Math.min(...phrases[index].targets.map((n) => n.midi)))}–${noteName(Math.max(...phrases[index].targets.map((n) => n.midi)))}. Change PC octave if needed, or use the piano keys.`;
  }
  function setPiece(p: Piece) {
    cancel();
    piece = p;
    index = 0;
    phrases = phrasesFor(p);
    refreshRoutes();
    picker.replaceChildren();
    for (const [i, p] of phrases.entries())
      picker.add(
        new Option(
          `${i + 1} · ${Math.round(p.end - p.start)} sec · ${p.targets.length} notes`,
          String(i),
        ),
      );
    $("#journey-result").hidden = true;
    feedback(
      "Choose a phrase and start. Each completed phrase lights a lantern.",
    );
    refresh();
  }
  function refreshRoutes() {
    route.replaceChildren();
    for (const item of library) route.add(new Option(item.title, item.id));
    if (piece && !library.includes(piece))
      route.add(new Option(piece.title, piece.id));
    if (piece) route.value = piece.id;
  }
  function nextPrompt() {
    if (!phrase) return;
    const n = phrase.targets[gate];
    player.position = n.time;
    const group = phrase.targets.filter(
      (t, i) => i >= gate && Math.abs(t.time - n.time) < 0.025,
    );
    feedback(
      `Next: ${group.map((t) => noteName(t.midi)).join(" + ")} · hold about ${(n.duration / player.speed).toFixed(1)} seconds, then release.`,
    );
  }
  function finish() {
    if (run) for (const midi of [...run.held.keys()]) run.up(midi, phrase.end);
    phase = "idle";
    generation++;
    const result = run?.result();
    player.pause();
    restore();
    const key = progressKey(piece, phrase),
      old = progress[key] ?? { learned: false, best: 0 };
    // Completing a Learn phrase or matching at least 70% in Perform earns a lantern.
    const earned =
      mode === "learn" ||
      (result !== undefined && result.matched / result.total >= 0.7);
    if (earned) stage.pulse(true);
    progress[key] = {
      learned: old.learned || earned,
      best: Math.max(old.best, result?.score ?? 0),
    };
    let stored = false;
    try {
      stored = saveProgress(localStorage, progress);
    } catch {
      /* Keep this session's progress. */
    }
    $("#journey-result").hidden = false;
    $("#journey-result p").textContent = result
      ? `${result.score}/100 · ${result.matched}/${result.total} notes · ${result.extras} extra presses · timing ${result.timing}% · holds ${result.hold}%. Best ${progress[key].best}/100. ${earned ? "Lantern lit!" : "Match 70% of the notes to light this lantern. Try Learn or a slower speed."}`
      : "Phrase learned — lantern lit! Try Perform to practice timing and note holds.";
    $<HTMLButtonElement>("#journey-next").disabled =
      index >= phrases.length - 1;
    feedback(
      stored
        ? "Progress saved. Retry or follow the river to the next phrase."
        : "Progress kept for this session; browser storage is unavailable.",
    );
    refresh();
  }
  async function start() {
    cancel();
    if (mode === "listen" || !phrases[index]) return;
    const token = ++generation;
    phase = "preparing";
    phrase = phrases[index];
    learned.clear();
    held.clear();
    gate = 0;
    run = undefined;
    saved = {
      hand: player.practiceHand,
      loop: player.loop,
      end: player.playbackEnd,
      piece: player.piece,
      original: player.originalInstruments,
    };
    player.pause();
    player.loop = false;
    player.originalInstruments = false;
    document.body.classList.add("challenge-active");
    for (const el of document.querySelectorAll<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement
    >(
      ".transport button,.transport select,#seek,.sound select,.sound button",
    )) {
      disabled.set(el, el.disabled);
      el.disabled = true;
    }
    $("#journey-result").hidden = true;
    $("#journey-stop").hidden = false;
    refresh();
    feedback("Preparing your piano…");
    try {
      await player.init();
      if (token !== generation) return;
      try {
        await player.loadGrand();
      } catch {
        /* Existing synth fallback remains playable. */
      }
      if (token !== generation) return;
      if (mode === "learn") {
        phase = "playing";
        nextPrompt();
      } else {
        // Only eligible targets are assigned right; preserve known left accompaniment.
        const targets = new Set(phrase.targets);
        player.piece = {
          ...piece,
          notes: piece.notes.map((n) =>
            targets.has(n) ? { ...n, hand: "right" } : n,
          ),
        };
        player.practiceHand = "right";
        player.playbackEnd = phrase.end;
        player.position = phrase.start;
        run = new Performance(phrase, player.speed);
        phase = "countdown";
        startAt = performance.now() + 2000;
        lastCountdown = -1;
      }
    } catch {
      cancel("Audio could not start. Try again.");
    }
  }
  player.onManual.add((midi, down) => {
    if (phase !== "playing") return;
    if (mode === "perform") {
      if (down) {
        const correct = run!.down(midi, player.now());
        if (correct) stage.pulse();
        feedback(
          correct
            ? "Good note — keep flowing."
            : "Listen for the next pitch and try to land with the bar.",
        );
      } else run!.up(midi, player.now());
      return;
    }
    if (down) {
      if (held.has(midi)) return;
      const at = phrase.targets[gate].time;
      const i = phrase.targets.findIndex(
        (n, i) =>
          i >= gate &&
          !learned.has(i) &&
          n.midi === midi &&
          Math.abs(n.time - at) < 0.025,
      );
      if (i < 0) {
        feedback(
          `Try ${noteName(phrase.targets[gate].midi)} — follow the next blue bar.`,
        );
        return;
      }
      held.set(midi, i);
      stage.pulse();
      feedback(
        `Playing ${noteName(midi)}. Release when you’re ready to continue.`,
      );
    } else {
      const i = held.get(midi);
      if (i === undefined) return;
      held.delete(midi);
      learned.add(i);
      while (learned.has(gate)) gate++;
      if (gate === phrase.targets.length) finish();
      else if (!held.size) nextPrompt();
    }
  });
  function frame() {
    if (phase === "countdown") {
      const seconds = Math.ceil((startAt - performance.now()) / 1000);
      if (seconds !== lastCountdown) {
        lastCountdown = seconds;
        feedback(
          seconds > 0
            ? `Ready in ${seconds}… first note ${noteName(phrase.targets[0].midi)}`
            : "Go — follow the falling notes.",
        );
      }
      if (seconds <= 0) {
        phase = "preparing";
        const token = generation;
        void player
          .play()
          .then(() => {
            if (token !== generation) return;
            phase = "playing";
            feedback("Go — follow the falling notes.");
          })
          .catch(() => cancel("Playback could not start. Try again."));
      }
    } else if (
      phase === "playing" &&
      mode === "perform" &&
      player.now() >= phrase.end
    )
      finish();
  }
  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        cancel();
        player.pause();
        mode = b.dataset.mode!;
        root
          .querySelectorAll("[data-mode]")
          .forEach((el) =>
            el.setAttribute(
              "aria-pressed",
              String((el as HTMLElement).dataset.mode === mode),
            ),
          );
        $("#journey-result").hidden = true;
        refresh();
      }),
  );
  route.onchange = () => {
    cancel();
    const p = library.find((p) => p.id === route.value);
    if (p) void select(p);
  };
  picker.onchange = () => {
    cancel();
    index = Number(picker.value);
    $("#journey-result").hidden = true;
    refresh();
  };
  $("#journey-start").onclick = () => void start();
  $("#journey-retry").onclick = () => void start();
  $("#journey-stop").onclick = () => cancel();
  $("#journey-next").onclick = () => {
    cancel();
    if (index < phrases.length - 1) index++;
    picker.value = String(index);
    $("#journey-result").hidden = true;
    refresh();
  };
  $("#journey-guide").onclick = () => {
    const hidden = document.body.classList.toggle("hide-pc-guide");
    $("#journey-guide").setAttribute("aria-pressed", String(!hidden));
  };
  window.addEventListener(
    "blur",
    (event) => {
      if (event.target === window)
        cancel(
          "Challenge paused because the window lost focus. Restart when ready.",
        );
    },
    true,
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) cancel();
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.code === "Escape") cancel();
    },
    true,
  );
  return {
    refreshRoutes,
    get busy() {
      return phase !== "idle";
    },
    get targets() {
      return phrase?.targets ?? [];
    },
    setPiece,
    cancel,
    frame,
    get active() {
      return phase === "playing";
    },
  };
}
