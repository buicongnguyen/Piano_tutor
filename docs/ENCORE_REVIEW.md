# Code and logic review — Stillnote Encore

This pass reviewed the game in `src/game/` in two parts. The code review covered
lifecycle, GPU resources, input, audio and i18n. The logic review covered scoring,
charts, progression, story and the play modes. Each finding below comes with its fix
and, where it can be tested, a regression test.

## Code review

- **Reset left state behind.** Reset progress now also clears the pending
  celebration and the "islands already announced" set, and refreshes the map.
- **Back during a dialogue** closed panels behind it. Back is now ignored while a
  dialogue is open.
- **Exposure leaked from stages to the map.** The map resets tone-mapping exposure
  when it is entered.
- **Loading showed the old HUD.** The HUD hides while a stage loads. A failed piano
  sample load retries in the background instead of blocking. GM programs that failed
  once are not refetched on every stage.
- **Focus stayed on the Play button**, so Space re-clicked it. Play now blurs the
  active element and focuses the canvas.
- **Resume while the tab was hidden** restarted the song in the background. It now
  stays paused until the tab is visible. An interrupted audio context (phone call,
  another app) pauses the game.
- **Settings sliders wrote storage on every pixel.** Writes are debounced.
- **Calibration could run twice** when its button was tapped mid-run. It is guarded,
  and the button is disabled while it runs.
- **Renderer**: re-attaching a scene rebuilt the composer and dropped bloom/grade
  settings. The composer is reused, rebuilt passes are disposed, and stored bloom and
  grade values are re-applied. The map's staff trail disposes its old geometry.
- **Stage**: a missed gem's fade could start with a negative age. Uniform textures are
  disposed. Per-frame lookups (bar keys, line colours, held notes) are cached.
- **Words input** ignored IME ("Process") and non-Latin layouts. Those fall back to
  the physical key.
- **MIDI**: unplugging a keyboard left its notes held. It now releases them.
- **Key labels** assumed QWERTY. On Chromium they follow the real layout
  (`keyboard-layout.ts`), so AZERTY players see the keys printed on their keyboard.
- **i18n**: a `$` in a translated value was treated as a replacement pattern. Values
  are now inserted literally.
- **Menu music** kept ringing into a stage because queued notes played on. Stopping
  now cancels them.

## Logic review

### Scoring

- **Mashing every lane earned three stars.** A press with no note in its lane while
  a note is due in another lane is now a **wrong key**. It shows ✗ WRONG KEY, breaks the
  combo, lowers Harmony and counts as an extra note in accuracy. Strays with nothing
  due anywhere stay harmless. Real piano on a MIDI keyboard is exempt, because
  pianists add harmony.
- **One late press cost two notes.** Pressing just after a note timed out used to
  consume the next note as an early miss. It now counts as the missed note's own
  mistake.
- **Holds didn't matter.** Letting go of a hold before half its length now breaks the
  combo and the full combo.
- **A steadily late player earned no stars.** The first star is now for hitting 60%
  of the notes (or 60% accuracy). ★★ and ★★★ still need timing.
- **Encore was unreachable in short songs.** Each golden phrase now fills
  1 / (phrases in the song) of the gauge, clamped to a quarter to a half. A song too
  short for the regular spacing still gets one golden phrase.
- **Records mixed runs.** The best score used to show another run's accuracy and rank.
  Records now keep score, rank and accuracy from the same best-scoring run, plus the
  best rank of any run. Practice-only records show "Not cleared yet".

### Charts

- **Vivaldi's slow movements charted the accompaniment.** In Spring II the
  tutti violins' figure (457 notes) outscored the solo tune (85 notes). A track named
  for the tune (solo, melody, lead, voice…) with at least 24 notes is now the lead.
  All twelve movements now follow the solo violin.
- **Easy placed notes at odd points between beats.** A fixed 0.42 s gap in a fast song
  kept every 1.26 beats. Easy now keeps to the pulse: one note per beat, per half
  beat in a slow song, or per two beats in a fast one.
- **Hard was identical to Normal in slow pieces.** Hard now fills beats where the
  melody rests with the accompaniment's top line (never the bass). For example,
  Spring II goes from 85 to 121 notes, Gymnopédie from 92 to 135 and Clair de lune from
  131 to 218. Tap Normal's spacing moves from 0.27 to 0.24 s, so it no longer matches
  Tap Easy on songs moving in 0.25 s steps.
- **Practice taught a different chart.** At 50% speed the chart was built denser than
  the real one. It is now built at full speed; only the clock slows.
- **Thinned melody notes changed instrument.** Notes a lighter difficulty leaves out
  now play on the piano, like the player's own notes.
- **Tap runs wore out one thumb.** A quick repeated-note run stayed on one side. After
  four notes in a row the next switches sides.
- **One-hand keys stretched to six lanes.** A S D F G H and H J K L ; ' put six lanes
  on one hand. The one-hand presets now always use four lanes.
- **Laptop real piano auto-played many notes.** The 17-key window now adds the Z row
  (ten semitones below), and the window is placed with it in mind.

### Words mode

- Breaths are judged against the phrase just played, not the whole song's median, so
  a pause after a fast run ends the word. Any pause of a second or more ends a word,
  and no word spans more than about three seconds.
- A lone pickup note joins its phrase instead of becoming a one-letter word.
- A word never repeats back to back. Island words are capped at about one in five
  (they were doubled in the bank), and Normal words are 3–5 letters. `fa`, `ha` and
  `la` join the home-row bank.
- The results line shows your WPM next to the song's own pace, which is the maximum
  a flawless run can reach.

### Progression and story

- **The island order didn't ramp.** Maple Leaf Rag sat before Für Elise. The order is
  now meadow, snow, festival, garden, harbour, neon, pier, seasons, crown. Gates and
  map spots stay by position. An island with any record stays open, so nobody loses an
  island they reached.
- **Story scenes could be lost.** A restore scene interrupted by Retry or a reload
  was kept only in memory. Due scenes are now derived from the save on every map
  visit: each restore (after its arrival, if that was missed), with the ending last.
- **"Open all islands" told the story out of order.** Restore scenes and the Canon
  finale now wait until the island's real star gate is met.
- The story lines that name the next island and the Hush's appearances follow the new
  order, in English and Vietnamese.
- The Encore key hint follows the mode (ENTER in Words, TAP on touch), and so does the
  festival tutorial line.
- A steady timing offset above 60 ms adds a **Calibrate timing** button to the
  results.

## Validation

- 222 unit tests pass (`npx vitest run`), including a regression test for each
  logic fix above. `tsc` and `npm run build` pass.
- The GPU end-to-end suite (`node tests/e2e.mjs`) runs against the dev server and a
  production preview. It covers the title, map, setup, autoplay clears, Words, Tap on
  a phone viewport, pause, results and unlocks.
- Chart sizes were checked across the campaign with a probe over the real MIDI files.
  These are simulated checks: nobody has played the new tiers on a real phone or MIDI
  keyboard yet.


## Mobile performance and hit-streak review — 2026-10-04

Reviewed the pending audio-clock, water, particle, instance-upload, beat-search,
classic-studio note-index and HUD changes, including their gameplay integration.

- Accompaniment must be queued from the audio processing clock, not the delayed
  speaker clock. The scheduling fix retains the heard clock for input/visual timing
  and caps queued events at practice gates. Tests cover 80–250 ms output latency,
  playback speed, gate release, pauses and stalled frames.
- Indexed note windows retain overlapping sustained notes and work after backward
  seeks. Particle pool reuse, expiry and clearing keep the active draw count correct;
  populated buffer ranges retain the existing instance-capacity guards.
- Phone water omits animated wave noise and normals. Desktop water and the existing
  quality governor retain their behavior. Streak feedback uses transform/opacity
  animations without forcing synchronous layout reads.
- **Live stars disagreed with results.** The HUD ignored wrong-key penalties and the
  first-star reward for consistently hitting Good notes. Both now use the same star
  rules; the live calculation considers judged notes only, and practice stays unscored.
- **The new streak effect ignored the game's reduced-motion setting.** Each run now
  passes that preference to the HUD, suppressing the ring and shortening the counter
  pulse. System reduced-motion preferences remain supported.
- The streak reads the existing judge combo: hits increase it; misses, wrong keys
  and sufficiently early hold releases break it. Retry clears the display. Milestones
  handle simultaneous hits crossing a threshold and continue every 50 after 100.

Checks cover the production build, unit suite, full GPU browser suite and a dedicated
phone streak scenario: first hit, 25-hit milestone, miss/reset, retry, Words-mode
placement, calm water, and both reduced-motion preferences. Browser emulation is not
a physical-phone performance measurement.

Validation for this revision: 249 unit tests and all 17 GPU browser scenarios pass
on the production build; TypeScript and the production build also pass.
