# Rendering review — 2026-10-25

## Reused Claude workflow

The referenced `3D_game_scene` checkout exists, but the relevant skills are shared in
`C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md` and
`C:/Users/n/.claude/skills/lightweight-game-objects/SKILL.md`.
This review applies their measure → attribute → optimize → compare workflow to Encore.
No assets or source from the other game were copied.

The existing renderer already resets `renderer.info` once per complete frame, uses
lighter materials on phones, disables their shadows, bakes static scenery, and
instances notes. Keep those improvements. The shared skill's warning that default
Three.js counters reset between passes does not mean Encore's configured counters
are incomplete.

## Implemented change

Piano mode previously submitted every white/black key separately. `KeyBatch` now
renders matching ivory and ebony surfaces in two instanced batches. It retains
each original key's transform and independent emission state, including pressed
keys, hit flashes and miss wobble. Pointer mapping, labels, gameplay and sound are
unchanged. Both desktop PBR and phone Phong/Lambert materials are supported.

Only named piano-key surfaces are batched. Decorative children remain independent.
Geometry is cloned before adding the emission attribute, so cached Blender kits
are untouched. Batches live in stage content and use its existing disposal path.
Original hidden surfaces retain the animation state and are disposed there too.

## Measured comparison

Chromium/D3D11, Morning Light, normal difficulty, piano practice; 37 keys.
Both variants are rendered in the same frozen scene with one white and one black
key depressed and glowing. Counts include all scene, shadow and composer passes.

| Layout | Quality | Before draws/frame | After | Reduction | Triangles (unchanged) |
| --- | --- | ---: | ---: | ---: | ---: |
| Phone viewport 390×844, DPR 2 | Medium | 156 | 121 | 22.4% | 276,701 |
| Desktop viewport 1280×720 | High | 230 | 195 | 15.2% | 346,895 |

The control comparison had no pixels above a 16/255 channel difference. Before/after
had one changed pixel on phone and two on desktop (under 0.001% in both cases).
Both variants retained identical triangle counts. These are draw-call improvements,
not measured FPS improvements or proof of performance on a physical phone.

## Repeat the review

Start Vite, then run:

```powershell
npm run profile:piano -- http://127.0.0.1:5173/
```

The script asserts the reduction, geometry preservation, stable control frames,
visual tolerance, and absence of WebGL shader/page errors. PNGs and JSON go to
`artifacts/render-review/` (ignored by Git). It compares original key surfaces with
the batches in one process, avoiding scene timing and adaptive-resolution noise.
The script deliberately accesses private debug state; keep it out of production UI.

For attribution of a running scene:

```powershell
node scripts/profile-render.mjs http://127.0.0.1:5173/?capture --renderer 'window.__encore.app.renderer.renderer' --scene 'window.__encore.app.renderer.scene' --viewport 390x844 --mobile --frames 120
```

That example profiles the title scene. Use `--click` and an awaited `--setup`
expression to enter a specific level before measuring. Always verify the active
state and scene; using a stage scene while the map is active mislabels map draws as
post-processing. `--throttle 4` and `--software` are optional stress proxies, not
physical-phone measurements.

`profile-render.mjs` adapts the shared skill's attribution script. Unlike counting
calls to `renderBufferDirect` alone, it measures actual renderer counter increments:
empty instanced meshes can reach that method without issuing a draw. Triangle
counts come from the renderer too, respecting draw ranges and instance counts.

Future reviews should cover the busiest song and all modes, both phone and high
quality, then inspect shadows, transparent overdraw and post-processing before
reducing artwork. Measure frame time separately before claiming a speedup. Preserve
independent recoloring/animation when batching and check stage changes for leaks.
