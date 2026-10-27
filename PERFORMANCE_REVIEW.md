# Encore performance review

Review date: 2026-10-25 (Asia/Seoul). The review initially kept all changes local.
On 2026-10-28, the user authorized committing and publishing these changes to GitHub Pages.

## Scope and baseline

Applied `C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md`, including its
CPU/buffer reference. The requested `C:/Users/n.claude/...` path did not exist.
Installed engine: **Three.js 0.180.0**. Inspected the installed Object3D matrix
traversal and WebGLAttributes upload implementation rather than copying r185 code.

Baseline is this checkout **including the preceding, uncommitted piano-key batching**.
The earlier 35-draw reduction is not counted again here. Existing phone materials,
baked scenery, note instances, streamed curbs, post-processing and resolution tiers
were retained. The unrelated `stillnote-screenshot.png` was untouched.

## Findings and changes

1. **Unchanged transforms were recomposed every frame.** Ordinary automatic local
   updates also forced repeated descendant world-matrix multiplication. Live scene
   nodes now cache position/quaternion/scale at double precision. The normal engine
   traversal and force propagation remain; parent changes invalidate the world matrix.
   Cameras, lights, bones, custom traversal methods and shared kit templates are not
   patched. Explicit `updateMatrix` / `updateWorldMatrix` retain engine behavior, and
   manually managed matrices retain their normal path. Caching is installed at scene
   attachment, not with a second full traversal every frame.

2. **Key batching walked ancestors separately for every key.** It now calculates
   transforms relative to the batch parent, caching the local chain and composing
   only changed chains. Common world ancestors cancel out. Independent key motion,
   colored emission, labels and pointer mapping remain intact.

3. **Buffers were resent despite identical contents.** Keys, notes, beat lines,
   lamps, clouds, fish and foam now compare stored typed-array contents and upload
   only the bounded changed range inside their live prefix. Comparison occurs after
   Float32 rounding. Pending ranges are unioned, not discarded if an object has not
   rendered. Shrinking counts do not upload unused tails; growth/replacement initializes
   new contents. WeakMap ownership allows old attribute caches to be collected.

4. **Particles already had a good live-prefix pool.** Kept its density, motion,
   fade, blending and lifetime simulation. Fixed its shared upload helper to preserve
   pending ranges. Weather skips unchanged data; disabled weather submits nothing and
   becomes visible again when enabled. Ring pooling was retained. No particle density,
   shadow setting, material finish, animation rate or gameplay timing was reduced.

5. **Remaining rendering cost is largely submission/state work.** CPU samples show
   `getParameters`, `renderBufferDirect`, program/uniform setup, scene projection and
   native `(program)` work prominently. The latter is not a GPU timer. Moving fish,
   notes, weather and scenery still legitimately require work. Desktop renders about
   400k triangles in this fixture. Further merging could change independent materials
   or animation; no such visual trade was made without evidence.

## Measurement method

Chromium using D3D11, local unminified Vite build. Desktop: 1280×720, DPR 1, High.
Mobile emulation: 390×844, DPR 2, Medium, 4× CPU throttle; actual rendering buffer
487×1055 (the existing 1.25 quality cap). Adaptive scaling was held at 1 for comparison.
No physical phone, thermal/battery test, GPU timer or total-VRAM measurement was used.

Fixture: **Für Elise, Hard, piano practice**, fixed camera after fly-in, fixed seed
and cosmetic time. Ten warm-up frames, then 60 stationary and 60 moving frames at
1/60 simulated seconds, including press/release, bursts, rings, fish, flowing scenery,
weather and Coda animation. The stationary fixture still calls the update methods
with dt=0; it is not a claim that the production pause screen performs those updates.

Raw WebGL draw methods count every pass, including shadow-map draws. A surrounding
`renderBufferDirect` hook attributes actual draws to scene/shadow/post. This avoids
counting an empty instance submission as a draw. **Shadow-map draws were zero in
these scenes**, even at High; contact-shadow geometry is counted in the main pass.
No shadows were disabled to obtain that result. Encore already resets renderer.info
once per whole frame; its configured counters are not the default per-pass counters
warned about in the skill.

Counted Matrix4 composition/multiplication calls and actual `bufferSubData` calls and
bytes, including WebGL2 element offsets/lengths. Initial `bufferData` allocations were
separated from steady uploads. Removed all counting wrappers before timing/CPU sampling.
These measurements isolate presentation update/render work, not audio decoding,
network loading or the full judgement/HUD loop; browser tests separately exercise
actual gameplay and input.

## Repeatable work reduction

Numbers are averages per rendered frame. Arrows mean baseline → optimized.

| Fixture | Matrix compositions | Matrix multiplications | Upload calls | Upload bytes |
| --- | ---: | ---: | ---: | ---: |
| Desktop stationary | 740 → 116 | 866 → 244 | 19 → 0 | 18,892 → 0 |
| Mobile stationary | 637 → 91 | 706 → 162 | 19 → 0 | 16,972 → 0 |
| Desktop moving | 744.57 → 159.75 | 871.92 → 502.97 | 22 → 20.33 | 20,908.80 → 12,989.87 |
| Mobile moving | 641.03 → 131.22 | 710.75 → 382.85 | 22 → 20.33 | 18,564.20 → 10,452.20 |

Moving compositions decreased about **79%**, matrix multiplications **42–46%**, and
uploaded bytes **38–44%**. Stationary zero uploads do not imply zero uploads during play.
Moving effect warm-up still allocates about 73.53 buffer bytes/frame averaged over the
60-frame window (0.4 allocation calls/frame), unchanged from baseline.

| Fixture | Total draws before = after | Main draws | Shadow-map draws | Post draws | Triangles at final sampled frame, unchanged |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop stationary | 209 | 194 | 0 | 15 | 408,349 |
| Mobile stationary | 128 | 113 | 0 | 15 | 320,455 |
| Desktop moving | 214.02 | 199.02 | 0 | 15 | 404,317 |
| Mobile moving | 132.25 | 117.25 | 0 | 15 | 313,329 |

## CPU timing: no proven FPS improvement

Separate runs were inconsistent: desktop median measured update/render work was
2.26 → 2.94 ms and throttled mobile 9.36 → 13.42 ms. Earlier runs differed in the
other direction. Those runs must not be presented as a speedup or a confirmed regression.

Then alternated baseline and optimized pages in one browser, reversing order on each
of 12 pairs of five-frame blocks, followed by 12 identical-code control pairs.
The pages use equal moving workloads and quality; no instrumentation wrappers run
during timing. Using two pages is an approximation to same-page A/B and is another
reason to avoid a precise performance claim.

| Interleaved measurement | Desktop | Mobile, 4× throttle |
| --- | ---: | ---: |
| Baseline median work/block frame | 2.22 ms | 11.34 ms |
| Optimized median work/block frame | 2.12 ms | 11.14 ms |
| Median paired optimized/baseline ratio | 1.010 | 1.039 |
| Identical-code control median ratio | 1.010 | 1.086 |
| Control ratio range | 0.851–1.157 | 0.508–2.741 |

Medians of separate arms and medians of paired ratios are different statistics.
Observed changes fall inside control variation. Separate frame intervals remained
near the 16.7 ms display cap; p95 was 17.7 → 17.7 ms desktop and 21.3 → 21.7 ms mobile.
**Work reductions are established; faster FPS, better battery life, and a moving-play
CPU speedup are not established.** No reliable material timing regression emerged
from the interleaved control test either.

## Memory and resource lifetime

Unique scene geometry/instance ArrayBuffer storage is unchanged: **7,223,652 bytes
desktop; 6,156,704 bytes mobile**. This is CPU-side array storage, not total VRAM.

After explicit GC, JS used heap in the final runs was approximately 16.11 → 16.32 MiB
desktop and 13.94 → 14.29 MiB mobile. Backing storage increased by about 241 KiB desktop
and 237 KiB mobile. Caches intentionally trade a small amount of memory for less work;
heap numbers also include browser/debug instrumentation and are not exact attribution.

Three consecutive level rebuilds stabilized at the same counts in both builds:

| After each warmed rebuild | Desktop | Mobile |
| --- | ---: | ---: |
| Renderer geometries | 317 | 185 |
| Textures | 61 | 18 |
| Shader programs | 56 | 46 |
| Scene geometry/instance array bytes | 7,227,364 | 6,160,416 |

The small one-time geometry/program increase from initial idle is the ring-effect
pool/shader warm-up, present before and after. No accumulating resource-count growth
was observed across these three rebuilds; this is not a long-duration leak proof.
WebGL does not expose a reliable total allocation figure for driver memory/render targets.

## Visual and correctness checks

- Seeded stationary **and moving** mobile images are pixel-identical (513,785 pixels).
- Desktop stationary and moving differ in one of 921,600 pixels by one channel level;
  the identical-build control has the same difference. No pixels exceed 16/255.
- An early moving comparison failed because weather used `performance.now()` while
  the rest of the fixture used fixed time. Fixed the harness's weather clock, then
  reran both builds. The failing comparison was not accepted by relaxing tolerance.
- 12 focused render tests pass: parent motion, child rotation, scaling, reparenting,
  hidden/revealed nodes, explicit matrix calls, forced updates, manual/automatic
  transitions, nested key transforms, independent emission, unchanged uploads,
  pending ranges while culled, shrinking/growing/replaced data, expiry, pool reuse,
  and disabled/re-enabled weather.
- All 17 browser checks pass, including real piano keyboard input, practice gates,
  pause/resume, Words/lane modes, phone touch/Tap controls, fish effects, rendering
  budget, no-black-frame checks, classic studio, and Vietnamese settings.
- Production build/type checking passes. No browser page/shader errors in fixtures.

## Reproduce and inspect

```powershell
npm run dev -- --port 5278
npm run profile:performance -- http://127.0.0.1:5278/ my-run
npx vitest run src/game/render
npm run build
node tests/e2e.mjs --url http://127.0.0.1:5278/
```

Evidence is local and Git-ignored under `artifacts/performance/`:

- `baseline-final/` and `optimized-final/`: JSON counters, CPU profiles, control,
  stationary and moving PNGs; `optimized-final/visual-diff.json` records comparisons.
- `timing-comparison.json`: all interleaved and null-control pairs.
- `baseline/`: local source snapshot reconstructing the pre-pass checkout, including
  the earlier key batching; benchmark-only files do not enter the production build.

```powershell
node scripts/compare-performance.mjs baseline-final optimized-final
node scripts/compare-performance-timing.mjs http://127.0.0.1:5278/artifacts/performance/baseline/ http://127.0.0.1:5278/
```

The scripts use existing debug hooks and page-only instrumentation; they add no
production performance switch. Future engine upgrades should rerun transform and
buffer tests against the installed source. Before claiming phone FPS gains, repeat
live full-game traces on physical devices and longer/busier songs. Submission cost,
post-processing and triangle load are the next profiling candidates, not reasons
to silently lower graphics quality.
