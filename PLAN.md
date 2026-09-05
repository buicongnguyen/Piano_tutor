# Piano Tutor implementation plan

## Reference study
Virtual Piano: https://virtualpiano.net/?song-post-14075 . Loaded River Flows in You and activated Auto Play; the UI changed to Auto Pause. Learn from its select-score, visible keyboard, note labels, restart and autoplay flow. Build an independent interface and implementation, without copying its code or song arrangement.

## Product and acceptance criteria
1. Build a responsive, quiet practice studio with a library sidebar, score workspace, transport and playable keyboard. Ship original exercises so first-run playback works immediately.
2. Import MusicXML (.xml/.musicxml) and MIDI (.mid/.midi), select an imported piece, and play it locally. Render MusicXML with OpenSheetMusicDisplay; show MIDI as a piano roll. State clearly that PDFs/images require MusicXML conversion and compressed MXL is not accepted in this version.
3. Normalize notes to seconds, pitch, duration and velocity. Preserve MusicXML rests, chords, voices, backup/forward timing, ties and tempo changes. Clearly disclose unsupported repeat navigation and ornaments; play written order. Reject malformed files and cap input size/event count.
4. Use Web Audio synthesis, started only by user gesture. Schedule short lookahead windows against the audio clock. Cancel voices on pause/stop/seek/song switch; resume held notes. Tempo is a playback-speed multiplier. Keep notes and playhead synchronized.
5. Add seek, volume, speed, section A/B loop, current-note labels and mouse/touch/computer keyboard input. Controls must have labels and visible focus. Import remains in browser memory with no upload.
6. Provide a River Flows in You reference card linking to the online player and licensed sheet source; import a user's own machine-readable score to play it in this studio. Do not bundle the commercial composition.

## Logic review before implementation
- Separate parsing, transport and DOM rendering so timing is testable without audio hardware.
- MusicXML parts share measure starts; chords do not advance position; backup rewinds within a measure; ties merge only across matching part/voice/pitch.
- Playback state must have a single clock and cancellation path. Seek and speed changes restart scheduling from the new logical position.
- Validate loops A < B and bound them to song duration. Clip notes at loop end.
- Avoid HTML insertion of imported titles; renderer receives sanitized XML. Reject DTD/entity declarations and oversized files.
- Rendering failure must not hide parser errors. An invalid import leaves the previous playable selection intact.
- Pages must use a relative asset base. Match neighboring Node 22/GitHub Actions Pages pattern and push over SSH.

## Execution and verification
1. Scaffold Vite/TypeScript, parser tests and static page.
2. Implement import adapters, original scores, audio scheduler and studio UI.
3. Run automated parser/transport tests, TypeScript and production build.
4. Review code for timing, cancellation, invalid data, imports, accessibility and deployment paths; record findings and fixes in REVIEW.md.
5. Exercise actual browser playback, pause, selection, speed and layout; inspect browser errors.
6. Initialize git, create/confirm buicongnguyen/Piano_tutor, push main using git SSH, enable Pages, wait for deployment and verify live page.

## Explicit limits
Synthesized piano tone, not a sampled concert grand. No optical music recognition, account storage, MIDI hardware scoring or arbitrary engraved-score semantics. Imported files live for this browser session only.
