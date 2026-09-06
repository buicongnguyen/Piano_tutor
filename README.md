# Stillnote · Piano Tutor

A browser piano studio with a local score library, MusicXML engraving, MIDI piano roll, polyphonic Web Audio playback, sampled Steinway option, synchronized notation/keys, speed, seek, volume and A/B looping.

The optional **Classic chromatic** computer keyboard layout uses physical QWERTY positions: A S D F G H J K L ; for natural notes, W E T Y U O P for sharps/flats. The default range is C4–E5; the Octave selector shifts the 17-note range from C2–E3 through C6–E7. Hold a key for its duration, release to stop, and hold multiple keys for chords. The guide lights up for score notes in the selected octave and for your own presses. Blur, backgrounding and octave changes release held keys. Keyboard rollover limits depend on your laptop/keyboard hardware; the guide does not infer touch velocity. Other keyboard languages use the same physical QWERTY positions.

Thin blue bars preview four seconds of upcoming notes above each computer-key row, ending directly at the matching button. Length represents key-down duration. **NEXT KEYS** shows up to ten note/chord groups in the next eight seconds: `[A D]` means press together, and `C2↕` means that pitch is outside the chosen octave. Both previews follow seeking, speed changes and octave selection. Reduced-motion mode keeps the text sequence while hiding the falling lanes.

**Rows** selects 2, 3 or 4 compact physical keyboard rows. Two rows preserve the original mapping; three adds ten lower semitones on Z through /, and four adds ten upper semitones on 1 through 0. The Octave selector sets the base C for A; keys outside the 88-key range are disabled. Changing rows releases held notes and updates prediction labels. Predictive lanes are now 28 px high instead of 72 px. **Display options**, above the piano beside Sound, contains note labels, visual effects, falling notes and full 88-key mode.

The **Sound** selector offers Grand piano, Classical piano, Bright piano, Electric piano, Classical guitar, Steel-string guitar, Harp, Church organ, Violin and Flute. Grand piano uses SplendidGrandPiano; other voices use smplr's MusyngKite soundfonts from [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts). These are independent sample libraries, not Virtual Piano's audio. Changing sounds pauses at the current position while samples load; press Play to continue. Loaded instruments are cached for the session, and failed downloads are explicitly labeled as synth-piano fallback. All pitched tracks and manual keys use the selected instrument; guitar playback retains the score's note timing rather than automatically strumming.

Use **Theme** in the header to choose System, Light or Dark. Your choice is saved in this browser; System follows changes to the device appearance. The collection dropdown searches titles and composers, including accent-insensitive matches.

**Falling notes** shows a compact blue waterfall aligned with the scrolling keyboard. Bar length follows key-down duration, and the leading edge reaches the keyboard at note onset. **Effect** offers Water ripples, Flow particles, Sparkles, Soft glow and None. Effects follow score playback; changing them does not change audio. The display and effect preferences are saved locally. Reduced-motion users start with falling notes off, and animated strike particles remain suppressed. The falling-note toggle restores the compact keyboard-only layout.

**[Open the live piano studio](https://buicongnguyen.github.io/Piano_tutor/)**

The digital piano has a wood-sided cabinet, recessed display, speaker grilles, sculpted keys, note-label toggle and an expandable 88-key keyboard.

## Ready-to-play collection

| Piece | Composer | Duration | Edition |
| --- | --- | --- | --- |
| Gymnopédie No. 1 | Erik Satie | 2:21 | [Mutopia, public domain](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37) |
| Für Elise | Ludwig van Beethoven | 2:10 | [Mutopia, public domain](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931) |
| Clair de lune | Claude Debussy | 5:22 | [Mutopia, public domain](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778) |
| The Entertainer | Scott Joplin | 4:12 | [Mutopia, public domain](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=263) |
| Nocturne Op. 9 No. 2 | Frédéric Chopin | 3:22 | [Mutopia, CC BY-SA 3.0](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590) |
| Moonlight Sonata · I | Ludwig van Beethoven | 4:36 | [Mutopia, CC BY-SA 2.5](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=276) |
| Moonlight Sonata · II | Ludwig van Beethoven | 2:59 | Same edition |
| Moonlight Sonata · III | Ludwig van Beethoven | 13:21 | Same edition |
| Maple Leaf Rag | Scott Joplin | 2:24 | [Mutopia, public domain](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=23) |
| Arabesque No. 1 | Claude Debussy | 2:56 | [Mutopia, public domain](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1777) |
| Prelude (2005) | Ramana Kumar | 4:12 | [Mutopia, CC BY-SA 3.0](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=657) |
| Flat (2007) | Ramana Kumar | 11:02 | [Mutopia, CC BY-SA 3.0](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1004) |
| Variations d’automne (2007) | Stéphane Magnenat | 2:21 | [Mutopia, CC BY-SA 3.0](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=973) |
| Morning light | Original exercise | 0:22 | Two-hand study |
| A little room to breathe | Original exercise | 0:13 | Melody study |

Thirteen complete MIDI selections and eleven printable PDF scores are bundled locally, totaling about 61 minutes of source-file playback. Use **PDF sheet** or **Download MIDI** for a local copy. See [source provenance and licenses](public/music/SOURCES.md). These are notation-generated renditions, not recordings of a human performance. Moonlight's three movements are separate selections; its source MIDI uses 60 BPM, so durations can be longer than familiar recordings. The speed control changes playback without modifying downloads.

The three 2000s selections are contemporary original piano compositions, not chart hits. Their Creative Commons licenses permit redistribution with attribution and ShareAlike terms; these music files retain their source licenses.

## Use

Press **Play**: the sampled grand loads automatically before playback begins. Cancel loading if needed; unavailable samples fall back to a clearly labeled synth. **Load grand piano** can preload or retry the samples. The original **Morning light** exercise has a right-hand melody and sustained left-hand chords, demonstrating simultaneous notes. Click piano keys or use A W S E D F T G Y H U J K (C4–C5).

Import uncompressed `.musicxml` / `.xml` or `.mid` / `.midi` files up to 5 MB. Files remain in browser memory until reload and are never uploaded. Select imported scores from the sidebar. Seek to the beginning of a phrase and select Set A, seek to its end and select Set B, enable Loop, then play.

For Yiruma's **River Flows in You**, use the linked online piano or import your own two-hand MusicXML/MIDI arrangement. No edition with verified public redistribution permission was found, so the composition is not bundled. Buying a personal-use score does not by itself authorize bundling it on this public website. The online easy letter arrangement is monophonic; a full arrangement is necessary for both hands. PDF/image sheets require conversion to MusicXML with notation/recognition software before playback.

## Musical fidelity

**Hand dynamics:** the default **Melody forward** preset scales identified left-hand velocities to 75% and leaves the right hand at 100%. Separate sliders allow 0–125% of source velocity; **Original dynamics** restores both to 100%. This changes attack strength/sample velocity layers while preserving each hand's relative dynamics. It is an adjustable balance, not an automatically inferred human interpretation. Changes affect newly scheduled notes (up to 120 ms lookahead), not already ringing notes.

Hands come from explicit MIDI track names (treble/up/right, bass/down/left) or a two-staff MusicXML layout. Unassigned notes remain unchanged. No pitch threshold is used, so labeled hands can cross middle C. Sliders for absent/unidentified hands are disabled. Most bundled MIDI files have matching hand labels; Variations d’automne has unnamed tracks, so hand balance is unavailable for that edition.

- Independent voices, simultaneous chords, rests, MusicXML ties and tempo changes.
- MIDI key-down timing and velocity are retained. Same-channel CC64 pedal events extend sounding duration separately; the piano roll and key highlights show the original key-down length. Sample release is 120 ms after note/pedal release (previously the sampler default was 500 ms).
- MusicXML uses exact duration/divisions values for dotted notes and tuplets, integrates durations across tempo changes, merges ties per staff/voice/pitch and retains final rests. Speed changes scale onset and duration together. MIDI reflects its source performance; PDF notation is not automatically compared or used to overwrite MIDI articulation.
- MusicXML sound tempo, metronome tempo, sound dynamics and common dynamic marks supported.
- Audio-clock scheduling with 120 ms lookahead and one absolute onset per chord. Each voice preserves its duration and velocity; a gentle master compressor controls dense mixes. Pause, seek and score changes cancel both active voices and queued sample callbacks. Background tabs pause to prevent timer throttling from creating bad rhythm.
- Splendid Grand sampled Steinway through smplr loads automatically on first Play. Samples download from the smpldsnds host; synth fallback works if unavailable. Sample loading requires internet. Fonts also use Google Fonts with local font fallback.
- MusicXML plays in written order: repeats, navigation jumps, grace ornaments, pedal and hairpin expression are not interpreted. Export expressive MIDI for those performance details. Transposing scores must be exported in concert pitch. MIDI tracks all use piano, excluding percussion.
- Piano keyboard displays C2–C6 in compact mode; **Full 88 keys** expands to A0–C8 with horizontal scrolling. Playback supports the full 88-key range. All sounding pitches appear in the display even outside the visible keyboard. Piano roll adapts to each score's pitch range.
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

## Pop discovery (import required)

The Collection now includes a separate searchable discovery list for Adele’s Someone Like You and Rolling in the Deep, Maroon 5’s Memories and Girls Like You, and Yiruma’s River Flows in You. Search by artist, title or `pop`. These are retailer links and local-import actions, not bundled playable files; the playable count excludes them. No purchase or download was performed.

Sources checked 2026-09-06: [Someone Like You](https://synthesiagame.com/store/Song/3), [Rolling in the Deep](https://synthesiagame.com/store/Song/37), [Memories](https://www.midi.com.au/maroon-5/memories-midi/), [Girls Like You](https://www.midi.com.au/maroon-5/girls-like-you-midi/). Synthesia lists US-licensed piano arrangements with backing tracks. Hit Trax lists licensed full-band MIDI backing tracks, not solo piano. This app renders pitched tracks with the selected instrument and does not reproduce a General MIDI band. Public redistribution permission was not established for these editions.

## Laptop and eight-finger playing

The default **8-finger home row** layout puts C D E F / G A B C on A S D F / J K L ;. Sharps use W E T I O. G and H are left unassigned to keep the two hands in their usual typing positions. Octave and 2/3/4-row options still work; falling bars and the upcoming key sequence use the selected mapping. Choose Classic chromatic to restore the previous mapping. These are physical QWERTY positions.

**Space → Hold sustain** uses a thumb as a pedal. Release note keys while holding Space, then release Space to stop those sustained notes. **Toggle sustain** lets you tap Space on/off and enter chords sequentially without holding many physical keys simultaneously. These sequential attacks are rolled chords, not automatically simultaneous score chords. The visible sustain button also toggles the pedal; Escape or Release all stops manual notes. Space → Play / pause restores the original transport shortcut. Use the onscreen Play button in sustain modes. Focused form controls retain their normal keyboard behavior.

Sustain changes only manual sound, not score timing or score bar lengths. Re-striking a sustained key releases its previous voice. Blur, backgrounding, transport silence, sound changes, layout changes and octave/row changes release manual notes and reset the pedal, including pending audio starts. Computer keyboards still have no touch velocity and hardware rollover varies; toggle sustain reduces simultaneous-key requirements without changing those hardware limits.
