# Logic and code review

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
