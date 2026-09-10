# Light the River — implementation plan

Product specification: [LIGHT_THE_RIVER_PRODUCT_PLAN.md](LIGHT_THE_RIVER_PRODUCT_PLAN.md).

## Architecture and sequence

1. **Plan and baseline.** Inspect transport, keyboard lifecycle and collection;
   preserve current MIDI assets, source credits, mobile rules and user screenshot.
2. **Pure challenge engine.** Add eligible target selection, phrase construction,
   stable fingerprint, unique note matching, physical release scoring, and validated
   local progress helpers. Keep scoring independent from DOM and audio.
3. **Input and transport integration.** Publish manual down/up events from both
   keyboards. Sustain release must remain distinct from physical key release.
   Add an optional playback endpoint for phrase Perform sessions. Reset it on load.
4. **Journey controller.** Mount modes, route shortcuts, phrase picker, feedback,
   river lanterns, results, Retry/Next and guide toggle. Learn uses a waiting clock;
   Perform uses the audio clock and mutes only identified target notes. Restore
   player state on finish/cancel. Prevent competing controls during a challenge.
5. **Layout.** Add responsive river styling and compact mode controls; collapse
   advanced sound settings. Preserve accessible labels, focus and reduced motion.
6. **Review and tests.** Verify phrase boundaries, note reuse, timing at different
   speeds, physical holds, malformed storage, stale async starts, and cancellation.
   Fix issues found; run all tests and production build.
7. **Browser validation.** Exercise starter selection, Learn input, Perform start,
   results/retry, route switching and mobile layout. Distinguish observed UI state
   from sound quality or physical-device behavior not actually tested.
8. **Publish.** Commit the two plans, implementation and tests; push main over SSH;
   wait for successful Pages deployment and verify the public build.

## Implementation rules

- No guessed hand assignments for polyphonic music.
- No new sample libraries, paid services, or music downloads needed for this scope.
- No velocity scoring, score inflation from autoplay, or rewards for cancellation.
- Use real elapsed time for input tolerances, score time for note positions.
- Clear pending starts when song/mode changes. Restore practice hand, loop, speed
  and playback endpoint after a challenge; never resume old playback unexpectedly.
- Treat saved progress as untrusted data; clamp values and cap record count.

## Validation record

### Completed implementation

- Steps 1–5 complete: pure challenge engine, manual input events, bounded transport,
  Learn/Perform controller, local progress, river illustration, route/phrase controls,
  Retry/Next, collapsed sound settings and optional PC guide.
- Arirang is the initial destination; Morning light remains an original two-hand
  starter. All collection entries remain accessible. Ambiguous arrangements explain
  why challenges are unavailable.
- Manual down/up hooks are separate from automatic playback and physical release
  is recorded before sustain defers audio release.

### Review fixes

- Destination values use runtime song IDs rather than mutable library indices.
- Saved records fingerprint musical content rather than those runtime IDs.
- Late asynchronous audio starts cannot reactivate cancelled sessions.
- Window blur cancellation ignores ordinary button/input blur events.
- Final held notes receive endpoint hold credit; partial sessions earn no progress.
- Phrase targets alone feed challenge previews; accompaniment is not shown as a
  required user key. Original-instrument preference and loop/hand state restore.
- Samples prepare before the countdown. Storage errors are nonfatal.

### Browser validation (2026-09-10)

- Completed all 38 target presses/releases in Arirang phrase 1 using on-screen keys:
  result appeared, one lantern lit, and reload restored 1 / 2 completion.
- Ran phrase 2 in Perform without input: 0 / 21 notes, 0 / 100 score; no free lantern.
- At 390 × 844 viewport, PC guide is hidden and document width does not overflow.
- Desktop browser reported no JavaScript errors during the checked mode switch.
- Physical phone audio/multitouch and subjective latency were not tested. This
  release does not claim hardware-calibrated scoring.

### Final checks

- 99 tests passed across 17 files, including challenge engine, UI lifecycle and
  phrase transport endpoint regressions.
- TypeScript and Vite production build passed. Existing large-bundle advisory
  remains; no additional dependencies were introduced.
- Git whitespace check passed. The user's existing screenshot remains untracked.
- Steps 6–7 complete. Step 8 publishes through the existing GitHub Pages workflow;
  its successful run and public bundle are verified after the main-branch push and
  reported with the delivered link. No manual hosting configuration is required.
