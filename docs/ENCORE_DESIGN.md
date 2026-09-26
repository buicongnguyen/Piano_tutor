# Stillnote Encore — game design

Stillnote began as a calm browser piano studio. Encore turns it into a 3D rhythm
adventure: every song is a stage, every stage restores part of a world, and the
same bundled music (43 MIDI editions) becomes a campaign. The studio remains
available as **Classic Studio** (`studio.html`) for sheet music, imports and free
playing.

## Research that shaped the design

| Reference | What we took | What we avoided |
| --- | --- | --- |
| Rock Band 3 keys / Pro Keys | Two tiers: a 4–6 lane "arcade" chart and a real-note chart on an actual keyboard. Laptop, touch and MIDI keyboards all get a playable path. | Plastic-instrument lock-in. |
| Deemo | Playing songs grows the world and unlocks story; first clears and full combos give the biggest rewards. | Opaque grind. Stars here map directly to accuracy. |
| Hi-Fi Rush | The whole world moves on the beat: props bounce, lamps flash, the beacon pulses, the camera breathes. | Punishing timing. |
| Guitar Hero / DJMax / osu!mania | Judgement windows, combo multiplier, a fever meter (our **Encore**), early-press misses that stop key mashing. | Fail states — a learning game should never throw you out of a song. |
| Synthesia / Simply Piano | Falling notes, slow practice, a wait-for-me mode, hands separately, MIDI keyboard input. | Subscription walls, locked music. |
| "Juice it or lose it" (Jonasson & Purho, GDC 2012) | Every hit gets sound, particles, key depression, a popping judgement and a camera kick. | Juice that hides the notes. |

Visual bar: Mario Kart 8-style stylized toys — chunky bevelled forms, glossy
saturated PBR, readable silhouettes, warm vivid colour. Night scenes use a very
dark blue sky and black-blue water with the colour carried by lights.

## Story — "Play the Silent Isles back to life"

The Sky Isles of Melodia used to sing. Each island's **Beacon**, a giant music-box
lighthouse, kept its song alive. Then the **Hush**, a huge sleepy cloud who hadn't
slept in a hundred years, gathered every song into silent crystals called
*stillnotes*. Colour drained away.

The player is the new **Keykeeper**, captain of the **Encore**, a grand piano that
flies with its lid as a sail. The guide is **Coda**, a plump golden note-sprite
and the last note still singing. Clearing stages frees stillnotes, relights the
beacons and brings back the colour. Mid-campaign the Hush appears, sad rather
than evil. In the finale the islanders play Pachelbel's Canon together and the Hush
learns that rests are part of music. It falls asleep to the song, and the isles agree
to end each night with a lullaby.

## Islands (campaign order)

| # | Island | Mood | Songs | Stars to open |
| --- | --- | --- | --- | --- |
| 1 | Dawn Meadow | Sunny spring morning, windmills | Morning Light, A Little Room to Breathe, Arirang | 0 |
| 2 | Starlight Snow Village | Snowy evening, warm windows | Silent Night, O Come All Ye Faithful | 4 |
| 3 | Festival Hills | Golden-hour lantern festival | Aegukga, Tiến quân ca, Star-Spangled Banner | 8 |
| 4 | Ragtime Pier | Bright seaside carnival | The Entertainer, Maple Leaf Rag | 13 |
| 5 | Glasshouse Gardens | Afternoon conservatory | Für Elise, Arabesque No. 1, Gymnopédie No. 1, Prelude, Variations d'automne, Flat | 18 |
| 6 | Neon Reef | Twilight synth lagoon | A1 Listen First, Action Title | 26 |
| 7 | Moonlit Harbour | Deep-blue night | Moonlight Sonata I–III, Clair de lune, Nocturne Op. 9 No. 2 | 32 |
| 8 | Season Wheel | Spring, summer, autumn and winter per movement | Vivaldi, The Four Seasons (12) | 40 |
| 9 | Carillon Crown | The Hush's cloud castle at sunset | Canon in D (finale) | 60 |

Settings has **Open all islands** for teachers and players who just want a song.
Imported MIDI files are charted automatically and appear in **My Songs**.

## Core loop

1. Pick an island on the 3D world map (the Encore flies there).
2. Pick a stage, difficulty (Easy / Normal / Hard) and keys (**Lanes** or **Real piano**).
3. Play: the Piano Road carries notes toward your keys and the island's beacon
   gets closer as the song progresses. Harmony colours the world.
4. Results: accuracy, stars, rank, full-combo crown, new bests.
5. First clears trigger story beats and restore the island on the map.

## Modes

- **Lanes (arcade)**: Easy has 4 lanes (D F J K), Normal and Hard have 6 (S D F J K L).
  Lanes follow the melody contour: up the scale means rightward, and a repeated
  note stays in its lane. Every hit plays the real melody pitch on a sampled grand.
- **Real piano**: lanes are actual piano keys. Best with a MIDI keyboard or
  the on-screen keyboard. Like Rock Band 3's Pro Keys window, the road shows at most
  three octaves around the busiest part of the melody. Laptop keys use a 17-key
  chromatic window (or the home-row layout) placed automatically for the stage. Notes
  outside the playable window are played for you as *assist* notes: they flash their
  key and are never scored.
- **Words** (typing): every charted note carries a letter and consecutive letters
  spell words fitted to the phrases. Breaths in the music end a word. Easy uses only
  home-row words, Normal everyday words, and Hard long words plus island-themed ones.
  Spacing is capped at typeable speeds of about 22, 37 and 60 WPM. The keys form a toy
  QWERTY keyboard coloured by touch-typing finger, and gems share their finger's colour.
  Input reads the typed character, so AZERTY and other layouts work. Space never fires
  Encore here (typists tap it between words); Enter does.
- **Tap** (phones): two lanes chosen by the melody's contour (up = right, down =
  left, repeated notes stay put). The whole left or right half of the screen is the
  button, so it doesn't matter where on the road you tap, and two thumbs can press at once.
  Spacing is 0.5 / 0.27 / 0.17 s, with both-sides chords only on Hard. Timing windows are
  ×1.35 (×1.5 on Easy) for touch latency. Phones default to Tap with the song kept playing.
  Keyboards use F/J, D/K or the arrows; MIDI splits at middle C.
- **Lane keys** preset: D F J K (split hands, default), A S D F (left hand) or
  J K L ; (right hand).
- **Keep the song playing** (toggle, default on for Words): the whole melody is
  scheduled with the accompaniment, so the song always sounds right. Hits add no
  second copy, and misses and wrong keys make no sound: they only show MISS on screen.
  Scoring is unchanged.
- **Practice** (toggle): the road waits at every note until you press it. No
  score and no stars, and you can play at 50–100% speed. This is the tutor mode.

Notes removed by a lighter chart are never silent. They play automatically as
accompaniment, so every difficulty sounds like the whole piece.

## Scoring

- Windows: Perfect ±45 ms, Great ±90 ms, Good ±140 ms (Easy ×1.25). An early
  press inside the miss zone (≤ 200 ms) consumes the note as a Miss.
- Points: 300 / 200 / 100 × multiplier (×1 to ×4, +1 every 10 combo) × Encore ×2.
- Holds: the head scores normally, then ticks while held. Releasing early loses
  only the remaining tail.
- Accuracy = Σ weight / notes (Perfect 1, Great 0.8, Good 0.5, Miss 0).
  Stars: ★ 60%, ★★ 75%, ★★★ 88%. Ranks: S+ (all Perfect), S 95%, A 88%, B 75%, C 60%, D.
  A Full Combo earns the crown.
- **Harmony** (0–1) rises with hits and falls with misses. It drives world
  saturation, beacon brightness and crowd energy. There is no fail state.
- **Encore**: golden phrases fill the Encore gauge. At half or more, press Space
  or tap ENCORE for double points, a golden road and full colour. It drains over
  about eight seconds per quarter gauge.

## Presentation

- **Title**: the Encore flies over a golden sea with Coda alongside. Menu music is an
  original looping theme played on the sampled grand.
- **World map**: nine floating islands on a stylized ocean, linked by a
  five-line musical-staff trail. Locked islands sit under grey Hush fog. The
  Encore airship moves between islands.
- **Stage**: the Piano Road is a glossy highway with piano-key curbs, beat lines
  and bar arches. Scenery scrolls past with parallax. The destination island (beacon,
  landmarks and houses) grows on the horizon. Props squash on the beat, and combo
  milestones fire fireworks.
- **Feedback**: keys depress and glow, lane-coloured bursts and a shockwave ring
  play on each hit, judgement text pops, the multiplier badge pulses, misses thud and
  flash the lane.
- **HUD**: score, combo, multiplier, harmony bar, Encore gauge, song progress with
  star ticks, and pause.
- **Dialogue**: portrait cards for Coda and the Hush, advanced with any key or tap.

## Art pipeline

All 3D art comes from headless Blender generators in `art/encore/`, built on the
shared chunky-toy toolkit (`aaa_kit.py`): bevelled forms, saturated PBR, baked AO
in `COLOR_0`. It exports GLB files to `public/models/`. Runtime tints come from material
names listed in `art/encore/CONTRACTS.md`. Character portraits are Blender renders.

## Technical design

- Vite + TypeScript + three.js. `index.html` is the game (`src/game/`);
  `studio.html` is the classic studio (`src/main.ts`).
- Pure, unit-tested modules: `chart.ts` (lead extraction, thinning, holds, golden
  phrases, excerpts), `lanes.ts` (contour mapping), `judge.ts` (windows, score,
  combo, harmony, Encore, results), `campaign.ts` (islands, stages, unlocks,
  saves).
- `sound.ts`: one AudioContext, sampled grand plus on-demand General MIDI voices for
  accompaniment, and a synth fallback. `conductor.ts` keeps the song clock on the audio
  clock (with output latency and a user offset), schedules accompaniment with 120 ms
  lookahead, and implements the practice gate.
- Input: keyboard (`event.code`, physical positions), pointer/touch on 3D keys
  (raycast), and Web MIDI.
- Rendering: quality tiers (auto / low / medium / high), bloom, neutral tone
  mapping, instanced notes, adaptive resolution, and reduced-motion support.
