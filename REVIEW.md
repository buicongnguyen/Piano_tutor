# Logic and code review

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
