# Gameplay review — Learn and Perform

Reviewed challenge eligibility, phrase construction, manual down/up matching,
countdown/start/cancel transitions, playback boundaries, scoring, and persistence.

## Fixed

- Learn could accept a future note while another key of the current chord was
  still held. Keep the gate on the chord until every target is played and released.
- Identified right-hand notes were accepted in input order. Sort by onset before
  forming phrases; collapse layered copies of the same pitch/onset into one target,
  retaining the longest original note so playback hand assignment still works.
- Perform silently released held targets for scoring at completion. Only actual
  releases now earn hold credit; allow 350 ms after the phrase for final input.
  Keep playback's automatic stop beyond that window, excluding next-phrase notes.
- Old asynchronous audio errors could cancel a newer challenge. Check the start
  generation before applying failure cleanup.
- Empty scoring input returned non-finite percentages. Return zero metrics.
- Chord prompts used one duration for every key. Show each remaining key's hold.
- The progress label claimed persistence after a failed save. Report session-only
  storage after failure.

## Validation and evaluation

111 automated tests pass, including new chord, duplicate-target, ordering,
empty-score, unreleased-final-note, and stale-error regressions. Production build
passes. These are code and simulated interaction checks, not a physical mobile
keyboard or audio-latency certification.

Learn is intentionally an untimed pitch-and-release exercise: short taps may
complete it; use Perform to assess timing and duration. Perform works best with
reliable hand annotations or a single melody. Unidentified polyphonic arrangements
remain Listen-only. Device audio latency and limited laptop key rollover can still
affect real play; latency calibration and a keyboard capability check would be
useful future additions. No claim that every possible gameplay defect is eliminated.
