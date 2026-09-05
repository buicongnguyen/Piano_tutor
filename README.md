# Stillnote · Piano Tutor

A browser piano studio with a local score library, MusicXML engraving, MIDI piano roll, polyphonic Web Audio playback, sampled Steinway option, synchronized notation/keys, speed, seek, volume and A/B looping.

## Use

Press **Load grand piano** for sampled sound, then **Play**. The original **Morning light** exercise has a right-hand melody and sustained left-hand chords, demonstrating simultaneous notes. Click piano keys or use A W S E D F T G Y H U J K (C4–C5).

Import uncompressed `.musicxml` / `.xml` or `.mid` / `.midi` files up to 5 MB. Files remain in browser memory until reload and are never uploaded. Select imported scores from the sidebar. Seek to the beginning of a phrase and select Set A, seek to its end and select Set B, enable Loop, then play.

For Yiruma's **River Flows in You**, use the linked online piano or import your own two-hand MusicXML/MIDI arrangement. The composition is not bundled. The online easy letter arrangement is monophonic; a full arrangement is necessary for both hands. PDF/image sheets require conversion to MusicXML with notation/recognition software before playback.

## Musical fidelity

- Independent voices, simultaneous chords, rests, MusicXML ties and tempo changes.
- MIDI note timing and velocity retained; CC64 sustain extends notes until release.
- MusicXML sound tempo, metronome tempo, sound dynamics and common dynamic marks supported.
- Audio-clock scheduling with 120 ms lookahead; pause, seek and score changes cancel voices. Background tabs pause to prevent timer throttling from creating bad rhythm.
- Optional Splendid Grand sampled Steinway through smplr. Samples download from the smpldsnds host; synth fallback works if unavailable. Sample loading requires internet. Fonts also use Google Fonts with local font fallback.
- MusicXML plays in written order: repeats, navigation jumps, grace ornaments, pedal and hairpin expression are not interpreted. Export expressive MIDI for those performance details. Transposing scores must be exported in concert pitch. MIDI tracks all use piano, excluding percussion.
- Piano keyboard displays C3–C6; imported playback supports the full 88-key range. All sounding pitches appear in text even outside the visible keyboard.
- Manual keys currently use a fixed 1.3-second duration. This is a score player/practice keyboard, not a replacement for a velocity-sensitive MIDI controller.

## Development

Node 22+: `npm ci`, `npm test`, `npm run build`, `npm run dev`.

GitHub Actions tests and builds on main, then deploys `dist` to GitHub Pages. Vite uses relative assets for the repository subpath. Deployment remote uses SSH.

See [PLAN.md](PLAN.md) and [REVIEW.md](REVIEW.md).

## References and credits

- [Virtual Piano reference](https://virtualpiano.net/?song-post-14075): studied library → loaded score → autoplay/keyboard flow; no site code or song arrangement copied.
- [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay): MusicXML engraving, BSD-3-Clause.
- [ToneJS MIDI](https://github.com/Tonejs/Midi): MIDI decoding, MIT.
- [smplr](https://github.com/danigb/smplr): sampled instruments, MIT; [Splendid Grand source and sample provenance](https://github.com/sfzinstruments/SplendidGrandPiano). Samples are fetched by the library, not redistributed in this repository.
- [MusicXML timing specification](https://www.w3.org/2021/06/musicxml40/tutorial/midi-compatible-part/): chord and backup semantics.
- Both bundled exercises are original material created for this project.
