# Light the River — product plan

## Purpose

Turn Stillnote's piano studio into a welcoming learning game while preserving its
music player, imports, instruments, notation and desktop/mobile keyboards.
Success means a new player can choose a route, finish a short musical phrase,
understand their result, and know what to do next without navigating settings.

## Player journey and story

The player follows a river at dusk. Each completed phrase lights a lantern along
the river. Music, rather than dialogue or currency, advances the story. The first
destinations are Morning Light (an original beginner exercise), Arirang (Korean
traditional music), and the Christmas collection. Routes remain freely accessible;
there are no lives, purchases, daily streak penalties, or locked music.

Arirang is a beginner melody route. Morning Light introduces right-hand playing
over automatic, explicitly identified left-hand accompaniment. Silent Night's
bundled guitar arrangement is a listening destination until a verified melody
arrangement is available; do not guess its melody from the highest pitches.

## Three modes

| Mode | Purpose | Behavior |
| --- | --- | --- |
| Listen | Explore and hear a model performance | Existing full-song playback, speed, loop, instruments and sheet views. |
| Learn | Find the notes without time pressure | Select a short phrase; the timeline waits at the next note/chord until the correct keys have been pressed and released. Show the next pitches and hold guidance. No timing score. |
| Perform | Apply rhythm and articulation | Two-second preparation lead-in, selected speed, melody muted, known accompaniment automatic. Match each physical note press once; score pitch, onset timing and physical hold duration. |

## Layout

1. Compact mode navigation and river route panel immediately above the piano.
2. Piano and falling notes remain the central stage; playback stays in its console.
3. Route selector, phrase selector, start/stop and progress sit together.
4. Advanced sound controls collapse into a labeled menu. Existing piano options
   remain available. The computer guide gets a visibility toggle and stays hidden
   on mobile using the existing responsive behavior.
5. Results appear inline with Retry and Next phrase; do not interrupt with a modal.
6. A simple river illustration and lit lanterns communicate progress in both themes.
   Respect reduced-motion settings and provide text equivalents for every reward.

## Challenge selection

Use explicitly labeled right-hand notes for two-hand scores. Accept fully monophonic
melodies even without hand names. Reject ambiguous polyphonic/ensemble scores for
challenges with a clear explanation and offer the starter routes instead.
Split targets into approximately 20-second musical excerpts at distinct onsets,
never split simultaneous targets, and include the final note's hold in the phrase.
No claim that these are editorially defined musical phrases or exact printed bars.
For laptop players, show the target range and remind them to change octave when
needed; the on-screen piano is always an alternative. Do not transpose silently.

## Feedback and scoring

- A note can be credited once; repeated keydown events and duplicate held keys
  cannot farm points. Match by pitch and a bounded real-time onset window.
- Correct notes get calm positive feedback; wrong pitches get an actionable next
  note prompt. Misses do not end the session.
- Perform result: matched notes / targets, extra presses, mean timing accuracy,
  hold accuracy, and a combined score. Unplayed targets reduce the score.
- Computer keyboards do not measure velocity: never score press strength.
- Physical release ends hold measurement even when the sustain pedal stays down.
- Learn completion lights a lantern but has no performance score. Store the best
  Perform score separately. Partial or interrupted sessions do not earn completion.
- A finished Perform phrase lights a lantern when at least 70% of targets were
  matched. A no-input run receives zero; retries remain unlimited.
- Local progress uses stable musical fingerprints and phrase boundaries, not the
  randomly generated runtime piece ID. Storage failure must not break playing.

For this release challenges use the selected piano sound for predictable manual
playing and accompaniment. Original MIDI instrument preference is restored afterward.
Learn previews target notes without automatic accompaniment; Perform supplies the
identified accompaniment. The destination selector provides direct route access.

## Scope of this release

Deliver all three modes, phrase practice, starter route shortcuts, the lightweight
river story, inline feedback/results, local progress, and a compact studio layout.
All existing music remains available in Listen. Generated notation remains labeled
approximate; challenges follow actual note data, not inferred engraving.

Future expansion (not part of this implementation): authored scenery for every
genre, verified beginner Silent Night arrangement, adaptive tempo, hardware MIDI
input/calibration, cloud saves, multiplayer, and a full percussion engine.

## Acceptance criteria

- Both physical PC keys and touch/on-screen keys can finish a Learn phrase.
- Perform cannot autoplay its own scored melody or count autoplay as user input.
- Speed changes preserve scoring units; control changes interrupt safely.
- Switching song/mode, hiding the page or losing focus cancels an active challenge.
- Retry works, next advances, and a reload restores earned phrase progress.
- Existing Listen playback/imports work; mobile does not show the PC guide.
- Core matching, boundaries, ties/holds, storage validation and interruption paths
  are tested. Build and browser checks pass before deployment.
