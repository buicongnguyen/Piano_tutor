# Logic and code review

## Follow-up keyboard and transport audit

- Fixed stale computer-key state after pause, seek, song changes or instrument switching. Player silence now notifies the input controller to release held notes and invalidate pending note starts before stopping voices.
- Fixed an asynchronous failure race: an older rejected audio initialization cannot release a newer press of the same key or overwrite its status.
- Validate own-property key/instrument identifiers and supported integer octaves. Keyboard handlers ignore non-element event targets and editable content, avoiding errors and accidental musical shortcuts while typing.
- Reduced repeated held-note label construction in the animation loop.
- 43 tests and production build pass, including stale rejection, transport cancellation, pending-note invalidation and unsupported key/octave cases. Existing scope limits remain: manual velocity is fixed, full MusicXML expression is not interpreted, and the notation library still produces a large-bundle advisory.

## Computer keyboard guide

- Added a QWERTY-position guide with 17 semitones, octave selection, blue ripple highlights and playback-following within the chosen range. Input fields and dialogs are excluded from musical shortcuts.
- Physical keyboard notes use note-on/note-off rather than fixed durations. A per-key token prevents delayed initialization from starting an already released note. Blur, hidden documents and octave/instrument changes release held notes.
- 42 tests and build pass. Tests cover complete chromatic mapping, octave bounds, chords, key release, blur cleanup and release before initialization. Browser checked octave relabeling, clickable guide keys and physical-key input dispatch.

## Selectable sampled instruments

- Added ten instrument choices using the existing smplr package: Splendid grand plus nine MusyngKite soundfonts. Sample libraries are independent of Virtual Piano.
- Switching pauses and cancels scheduled voices, preserves position, and loads the selected instrument. Sound-load generations prevent a slower previous request from replacing the current voice; tests cover this race and reuse of cached instruments.
- Failed sample loads remove the failed cache entry and expose a synth-piano fallback with retry. Instrument choice is session-local.
- 40 tests pass and the production build succeeds. Browser confirmed classical-guitar sample readiness and playback initiation. Soundfont timbre and natural decay depend on the source samples; this does not simulate physical guitar strumming or bow technique.

## Dark mode and follow-up review

- Fixed a stale asynchronous MusicXML error handler: an older failed load now returns before changing the current score view or status.
- Avoid resizing the piano-roll canvas on every animation frame. Resize only when its actual pixel dimensions change, and reset the transform explicitly to prevent cumulative scaling.
- Handle computer-key AudioContext initialization failures through the visible status message, consistent with clicking a piano key.
- Ignore non-finite seek values and non-positive/non-finite speeds before mutating transport state.
- Added System / Light / Dark appearance with persisted explicit preference, OS theme-change handling and graceful behavior when storage is blocked. Piano-roll colors follow the theme; only engraved SVG notation is inverted, preserving physical key colors.
- 36 tests and production build pass. Browser checks confirm dark selection persists after navigation and collection/notation switching remains available. The existing large JavaScript bundle advisory and MusicXML interpretation limitations remain.

## Precise note lengths

- Separated MIDI key-down duration from pedal-held sound; CC64 follows its channel even when stored on another track. Keyboard highlights and piano-roll widths follow key release. Removed the fixed two-pixel shortening of every roll note.
- Reduced the sampler's default 500 ms release to 120 ms. This tail starts after the source note/pedal release; it does not replace the source duration.
- Retained final MusicXML rests and isolated independent ties by staff/voice/pitch. Exact division durations remain authoritative for dots and tuplets, including tempo changes during tied notes.
- 30 tests cover channel-specific pedal timing, note release boundaries, dotted/tuplet values, trailing rests, ties across tempo changes, independent staff ties, speed scaling and seek/loop duration clipping. Source PDFs are not automatically audited against MIDI; downloaded source articulation is preserved.

## Complete downloadable repertoire

- Expanded the library to eight complete MIDI selections from Mutopia, with six local PDF scores. All three Moonlight Sonata movements are individually selectable and share the complete sonata PDF. Downloads are unchanged; source editions, attribution and applicable public-domain / CC BY-SA terms are documented in public/music/SOURCES.md.
- Recognize explicit upper/lower MIDI track names for hand controls. Preserve source timing and dynamics; Moonlight's source uses 60 BPM and is slower than typical performances.
- All 25 tests and the TypeScript/production build pass. Import tests check exact event counts, durations and both hands for every new MIDI; PDF tests verify file signatures and endings.
- Local browser verification confirms all ten library entries (eight editions plus two exercises), Clair de lune playback advancing, and Moonlight III's full duration and local printable/download links. This is a functional check, not a full-length listening assessment.

## Hand dynamics refinement

- Inspected actual source data: Für Elise uses MIDI velocity 62 throughout both tracks; Gymnopédie bass primarily uses 90 while treble varies from 62 to 95. Preserving the source alone does not provide a melody-forward interpretation.
- Added labeled hand metadata during import and configurable per-hand velocity multipliers. Defaults LH 75% / RH 100%; original dynamics preset is exactly 100% / 100%. Multipliers preserve relative expression, clamp at the valid range, skip muted note attacks and do not mutate source notes.
- Tests check crossed-hand pitch ranges in both bundled MIDI files, MusicXML staff assignment, clamping/muting/unassigned notes, and the effective velocity passed into the sampler. No fixed pitch split or random humanization is introduced.
- Controls apply to newly scheduled attacks. A maximum 120 ms of lookahead can retain previous settings, and held notes keep their original attack; this is communicated in the UI/README.

## September 6 refinement

- Added unchanged Mutopia public-domain MIDI files (Satie 2:21 / 282 notes, Beethoven 2:10 / 905 notes). Both are tested through the same importer used for local uploads. Source edition and PDF links accompany each piece; no copyrighted commercial song is bundled.
- Rebuilt the digital piano cabinet and isolated keyboard geometry and repertoire loading into modules. A geometry test covers all 88 keys / 52 white keys. Compact and full-range keyboards scroll within the cabinet on narrow screens.
- Fixed a real sampler cancellation bug: `smplr.stop()` only stops active voices. Retain each `start()` cancellation function to cancel pending queue entries too, with unique IDs for independent voices.
- Chords now receive identical absolute audio timestamps. A regression test verifies onset, independent velocity/duration, unique voice IDs and cancellation.
- First Play awaits sampled grand loading. Concurrent loading shares one promise, cancellation invalidates pending playback, and failure has a labeled synth fallback. A light compressor controls combined peaks without normalizing individual note strengths.
- Narrow-screen testing exposed stale OSMD auto-resize listeners repainting an old score over a MIDI selection. Disabled per-instance auto-resize and replaced it with an observer that redraws only the current MusicXML score.
- 16 tests plus TypeScript/production build pass. Browser checks verify automatic sample loading, elapsed playback beyond 25 seconds, 88-key count, label toggle, printable-score URL and no console errors.

## Completed checks

- Parser separates notation time (quarter-note beats) from playback seconds. Chords share an onset; backup permits independent simultaneous voices; shared measure lengths align parts. Ties merge to avoid repeated attacks. Tests verify all these cases.
- MIDI retains expressive onset/duration and velocity, including CC64 pedal extension. MusicXML handles basic dynamics and metronome/sound tempo. Full performance expression requires MIDI and an appropriate source arrangement.
- Audio schedules against AudioContext time, not individual DOM keypress delays. All notes in a chord are scheduled in the same tick. Voices overlap naturally; sampling uses velocity layers.
- Fixed an asynchronous play/pause race with a generation counter: a pending initialization cannot restart after pause/song switch. Seek and tempo changes cancel existing scheduled voices and reschedule from the current position.
- Loop selection enforces A before B and clips note lengths at the loop end. Background tabs pause to avoid audible timer throttling.
- Titles are assigned with textContent. Imported XML rejects entity declarations and strips executable/foreign nodes and event/link attributes. Files capped at 5 MB, events at 30,000; non-finite timing and out-of-range pitch rejected. Invalid imports retain the prior score.
- File parsing, transport and UI are separate modules, formatted with Prettier. Uncompressed MusicXML and MIDI scope is explicit in import UI and README.
- Sheet renderer and piano roll are alternatives; rendering errors fall back to piano roll. The notation cursor follows source timestamps transformed by the same tempo map.
- Pages uses relative asset paths; CI runs tests and build before upload/deploy.

## Verification

- 12 Vitest tests pass, including chords, voices, rests, ties, tempo, dynamics, MIDI timing/velocity, sustain pedal, corrupt XML, invalid timing, seek bounds and pending-play cancellation.
- TypeScript and Vite production build pass.
- Browser confirmed original two-staff score rendering, successful Steinway sample load, and simultaneous C4/C3/G3 playback with Pause state and no console errors.

## Remaining limitations

- OSMD accounts for most of the approximately 350 kB gzip initial JavaScript. Build reports a large-chunk advisory; this does not block deployment.
- No PDF optical recognition, compressed MXL, score persistence, full MusicXML expression interpreter, MIDI hardware input or performance grading.
- Fixed-duration manual computer keys cannot infer finger pressure. Source score quality determines rhythm and phrasing. The app does not claim an automatically generated human performance.
- Sustain extension is a note-duration approximation, not a physical pedal/resonance model. Continuous MIDI controllers other than sustain are not synthesized.
- Browser UI verification establishes playback state and sample loading, not a subjective listening assessment.

## Accompaniment practice and metronome review — 2026-09-06

Reviewed hand isolation, manual-note independence, pending playback cancellation, tempo conversion and seek/loop boundaries. Practice requires complete explicit left/right labels; unknown assignments reset to Listen. Mode and metronome changes pause and clear scheduled voices. PC previews filter to the practice hand, while the full score/piano view retains context. Metronome uses an independent short oscillator routed through the existing master volume; it does not change the selected instrument. Beats are deduplicated and clipped before the loop end and before a seek offset. MIDI tempo maps now expose quarter-note conversion alongside the existing MusicXML conversion.

Validation: 57 tests pass, including opposite-hand scheduling, mode changes, ambiguous assignments, tempo changes, speed scaling, beat deduplication, seek offsets and loop clipping. Production build passes. No automatic rhythm generation, note grading, tempo following of live input, or waiting for the player is claimed.
