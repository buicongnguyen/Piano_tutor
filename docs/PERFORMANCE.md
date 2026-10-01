# Performance on phones

The phone pass (2026-10-01) followed the `smooth-dense-scenes` and `lightweight-game-objects`
skills: measure, find the real cost, fix it, measure again, and confirm the picture didn't change.

## Results

All results come from a phone-sized view (390×844 at DPR 2), the medium tier that most phones get,
and the Für Elise stage in Tap mode.

| Measure | Before | After |
|---|---:|---:|
| Real draw calls on the stage, including post passes (`render-probe`) | 355 | 130–134 |
| Real draw calls on the map | 235 | 104 |
| Frame time median / p95, CPU slowed 4× | 17.5 / 95 ms | 9.9 / 17.4 ms |
| Frames over 33 ms, CPU slowed 4× (of ~120) | 36 | 1 |
| Uncapped GPU frame on SwiftShader (weak-GPU proxy) | 131–135 ms | 75–85 ms |
| Desktop high-quality draws (`renderer.info`) | 595 | 186 |

These numbers include the new shore foam and flocks. The machine was shared with other busy
sessions, so trust the draw counts and the ranking over single timings.

## What changed and why

- **Baked scenery** (`render/bake.ts`). An islet was 13–36 draws (one per material of every
  prop), and the destination island was 150. Static parts that differ only in colour now merge
  into one mesh per finish (gloss, satin, matte, metal), with colour moved into vertex colours
  (material colour × baked AO).
  - Glowing, transparent and pivot-animated parts stay separate.
  - World draws went from 414 to 73.
  - Map islands and the Coda and Hush rigs (baked per moving part) get the same treatment.
- **Instanced clouds and lamps.** Nine cloud puffs became one instanced mesh, and the 24 road
  lamps became one instanced draw per lamp part. The clouds have their own material, because
  sharing one between instanced and plain meshes makes three.js swap shader programs every frame.
- **Light materials on the phone tiers** (`render/lite.ts`). Physically based shading was half of
  the scene's per-pixel cost on a weak GPU (scene pass 81.5 → 40 ms with Lambert).
  - Medium and low use Lambert for matte and satin surfaces and Phong (for a sun highlight) for
    gloss and metal.
  - Kits are converted once at load, before anything is spawned. Colour, vertex colours, emissive
    glow and every `onBeforeCompile` patch carry over.
  - The environment map is not built on phones.
  - High quality keeps the physically based look.
- **A leaner post chain** (`render/renderer.ts`).
  - The colour grade, vignette, flash and fade are folded into the output pass: one full-screen
    pass, not two.
  - Bloom buffers run at a quarter of the screen size below high.
  - Canvas MSAA is off on DPR ≥ 2 screens; the composer renders off-screen anyway.
  - The resolution governor ignores the first 2 s after a scene change, so loading hitches aren't
    read as a slow device.
- **Less work per frame on the CPU.**
  - Piano-key curbs are written once and the mesh slides with the scroll; they were ~520
    instances, colours included, rewritten every frame.
  - The beat-line and note loops start from a cursor instead of the first note of the song.
  - The HUD writes the DOM only when a value changes.
  - `stage.update` went from 2.6 to 0.37 ms and all game logic from 3.9 to 1.3 ms (CPU ÷4).

## Small details added

Each detail costs one draw and almost no CPU:
- **Shore foam** (`render/foam.ts`): one instanced ring per islet, boat and island, measured from
  each island base's waterline. It is drawn on the stage and the map.
- **Gulls** (`render/flock.ts`): a GPU-only flock (swallows in snowy themes). On the stage it
  circles over the sea beside the road ahead, anchored in course space and wrapping to the far
  end. Birds circling the far destination were invisible in the haze. On the map, gulls glide to
  the island the ship is heading for.

## Guards and how to measure

- `tests/e2e.mjs` ("phone budget") fails if a phone stage exceeds 170 draws or the map exceeds
  130, if any physically based material is drawn on the phone tier, if canvas MSAA comes back on
  a DPR 2 screen, or if baking regresses.
- Real draw calls: run `render-probe.mjs` from the `smooth-dense-scenes` skill. It needs no hooks,
  so drive the boot through `--eval`; for example, click `.title-play`, skip the dialogue, then
  call `window.__encore.play(...)`.
- Uncapped GPU cost per system: use `render-cost.mjs` from the `lightweight-game-objects` skill.
  It syncs with a 1-pixel `readPixels`, because `gl.finish` doesn't wait in Chrome.
