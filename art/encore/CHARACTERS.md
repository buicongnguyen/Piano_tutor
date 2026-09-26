# Characters kit: `public/models/characters.glb`

Coda, the Hush and the Encore airship, built from headless Blender generators. The contract is in
`CONTRACTS.md` (the characters.glb section). This page records what was built and how to animate it.

```bash
BL=$(node scripts/blender.mjs --where)
"$BL" -b --factory-startup --python art/encore/build_characters.py     # GLB + characters.blend + contract check
"$BL" -b --factory-startup --python art/encore/render_portraits.py     # 6 portraits + key art
#   options: -- --only coda-happy,keyart  --samples 64  --scale 0.5  --out <file>   (quick tests)
"$BL" -b --factory-startup --python art/encore/preview.py -- --glb public/models/characters.glb \
    --nodes Coda --labels 0 --out artifacts/previews/characters-coda.png --size 1000x1000
```

| File | Role |
| --- | --- |
| `char_lib.py` | Shared builders (`build_coda`, `build_hush`, `build_ship`), face kit (eyes, lids, brows, mouths, decals) and expression tables `CODA_EXPR` / `HUSH_EXPR`. |
| `build_characters.py` | Builds the neutral poses, exports the GLB, then checks roots, pivots, identity rest rotations, `Ship Lacquer`, COLOR_0, no images, triangle limits and the byte budget. It exits non-zero on any failure. It also saves `characters.blend`. |
| `render_portraits.py` | Builds expression variants with the same builders and renders the portraits and `keyart.jpg` (Cycles, OptiX GPU, Standard view transform). |
| `characters.blend` | Editable native build scene (compressed). The roots are spread along X for editing; in the GLB every root sits at the origin. |

The build is deterministic: two runs produce a byte-identical GLB (see Toolkit notes).

## Roots

Blender units are metres, Z is up and the front faces −Y. In three.js the front faces +Z (glTF `(x, y, z)` = Blender `(x, z, −y)`).

| Root | Size W × D × H (m) | Triangles | Origin |
| --- | --- | --- | --- |
| `Coda` | 0.88 × 0.55 × 0.94 (body 0.57 wide × 0.50 tall) | 6,438 (limit 9,000) | Bottom of the body (feet touch z = 0) |
| `Hush` | 5.96 × 3.95 × 5.80 including the cap (cloud body 6.0 wide, about 4.0 tall) | 8,102 (limit 9,000) | Centre of the cloud body |
| `Encore_Ship` | 4.86 × 6.75 × 6.80 (hull and keyboard 2.5 × 5.5 × 0.95; legs hang 0.74 below the origin; balloon top at 6.06) | 17,964 (limit 20,000) | Centre of the hull bottom |

**GLB: 895,084 bytes** (budget 1,300,000), 80 nodes, 60 meshes, 30 materials, no images.
Every primitive carries POSITION, NORMAL and COLOR_0 (VEC4, normalized uint16). COLOR_0 is
ray-traced AO, smoothed across edges. On the Hush it also includes a soft sky falloff that
darkens the underbelly to 0.74.

## Pivots and animation axes

Every pivot is an empty with identity rest rotation and scale. Its origin is the rotation centre,
and the moving meshes are parented beneath it. The three.js column gives the local axis after
GLTFLoader import.

`src/game/render/characters.ts` assigns `Coda_Body.position.y` and `Ship_Balloon.position.y`
directly, instead of offsetting from rest. Both pivots therefore rest at their root's origin with
zero translation, so those assignments are safe. The other pivots are only rotated or scaled at runtime,
and their axes and signs match the table: wing `rotation.z` ± (lifts), flag `rotation.y`, blink
`scale.y`, prop `rotation.z`, lid `rotation.x`, cap `rotation.z`.

| Pivot | Parent | Blender position | Animate (Blender) | Animate (three.js) |
| --- | --- | --- | --- | --- |
| `Coda_Body` | `Coda` | (0, 0, 0), on the root origin at the feet, with zero rest translation | hop Z, squash scale Z (anchored at the feet), lean about X, rock about Y | `position.y` (can be assigned directly), `scale.y`, `rotation.x`, `rotation.z` |
| `Coda_EyeL` / `Coda_EyeR` | `Coda_Body` | (±0.101, −0.235, 0.278) | blink: scale Z → ~0.1 | `scale.y` |
| `Coda_WingL` / `Coda_WingR` | `Coda_Body` | (±0.248, 0.053, 0.284), the wing root | flap about Y. **L lifts with −angle, R with +angle** | `rotation.z`: **L lifts with +angle, R with −angle** |
| `Coda_Flag` | `Coda_Body` | (0.192, 0.13, 0.885), the stem top | wag about Y (−angle lifts the tip); flutter about Z | `rotation.z` (+ lifts the tip); flutter `rotation.y` |
| `Hush_Body` | `Hush` | (0, 0, 0) | breathe: scale; sway about Y | `scale`, `rotation.z` |
| `Hush_EyeL` / `Hush_EyeR` | `Hush_Body` | (±1.02, −1.45, 0.24) | blink: scale Z. The sleepy lids are inside the pivot, so the whole eye squashes. | `scale.y` |
| `Hush_Cap` | `Hush_Body` | (0.6, 0.3, 1.81), the cap base | sway about Y (±6°), nod about X | `rotation.z`, `rotation.x` |
| `Ship_Lid` | `Encore_Ship` | (0, 1.66, 0.97), the hinge line at the lid's back edge | about **X**. The rest pose is raised 66°. +angle lowers the sail toward the bow; ±4° gives a luffing sail. | `rotation.x` (same sign) |
| `Ship_PropL` / `Ship_PropR` | `Encore_Ship` | (±1.82, −0.10, 0.50), the hub | spin about **Y** | `rotation.z` (spin L and R in opposite directions) |
| `Ship_Balloon` | `Encore_Ship` | (0, 0, 0), with zero rest translation | bob Z | `position.y` (can be assigned directly) |
| `Ship_Balloon_Envelope` (extra) | `Ship_Balloon` | (0, 1.92, 5.19), the envelope centre | roll about Y, pitch about X | `rotation.z`, `rotation.x` |

Extra nodes beyond the contract (safe to ignore):
- `Coda_BrowL/R` and `Hush_BrowL/R`: brow strokes with their origin at the brow centre. Tilt them with `rotation.z` or raise them with `position.y`.
- `Hush_ArmL/R`: tiny cloud arms pivoting at the shoulder, (±1.98, −0.87, −0.68). Wave with `rotation.z`.

L and R are the character's own left and right. For a character facing −Y, its left is +X, which is
the viewer's right.

## Design notes

- **Coda** is an eighth note turned mascot. The plump golden note-head body carries the face. An amber
  stem rises from the back-right of the head to a bead, and a chunky coral flag swoops down and out to the
  right, so the ♪ silhouette reads from any distance. The face uses baby-face proportions: features set
  low, big glossy indigo eyes with a jewel-blue lower iris and two white catchlight beads (always upper
  left), rosy cheeks, a small open smile with a tongue, ink brows, stubby ivory three-lobe wings and tiny
  amber feet.
- **The Hush** is a smooth union of 12 sphere puffs sampled onto an even quad-sphere, giving soft creases
  with no marching-cubes noise. It has heavy sleepy lids with a lash line, big eyes with low catchlights,
  broad pink cheeks, a small wobbly frown, tiny resting cloud arms, and a floppy navy-striped nightcap with a
  plush ivory trim and a sunshine star pom-pom. Its body stays in the palette's pale `hush` lilac-grey (its
  colour was drained). The cap, star and cheeks carry the vivid accents.
- **The Encore** is a grand piano turned airship. The curved tail is the bow and the keyboard is the stern,
  so a chase camera sees the keys, the music desk and the sheet music. It has a cherry lacquer hull with
  gold rim and waist trim, a wood soundboard deck with a gold harp plate and brass strings, glowing
  portholes (`Ship Window Glow`), stub wings with brass propeller pods, turned legs with brass casters, and
  a gold treble-clef figurehead. The lid is hinged at its back edge and raised 66° as the sail, with a
  sunshine stripe, gold edging and a prop stick. It has a masthead pennant, forestay bunting in the lane
  colours, and a small red/cream/sunshine striped balloon with fins, tethered above the stern.

## Materials (30)

`Coda Gold`, `Coda Amber`, `Coda Flag`, `Coda Wing`; shared face kit `Char Eye`, `Char Iris`,
`Char Eye Shine`, `Char Blush`, `Char Mouth`, `Char Ink`; `Hush Cloud`, `Hush Shade`, `Hush Cap`,
`Hush Cap Stripe`, `Hush Cap Trim`, `Hush Star`; `Ship Lacquer` (contract), `Ship Gold Trim`,
`Ship Brass`, `Ship Ivory`, `Ship Ebony`, `Ship Sail Stripe`, `Ship Soundboard`, `Ship Balloon Cream`,
`Ship Rope`, `Ship Window Glow` (the only emissive), `Ship Pennant Sky/Lime/Violet/Tangerine`.
The expression-only materials `Char Teeth` and `Hush Tear` appear in portraits, not in the GLB.

All materials come from `palette.toy()`. Four colours are not palette keys because the palette has no
equivalent: `Char Iris` #3a3fa8, `Char Mouth` #9c1b3f, and white #ffffff for catchlights and teeth.

## Expressions (portraits)

`CODA_EXPR` and `HUSH_EXPR` in `char_lib.py` set the mouth shape, upper and lower lid cover and slope,
brow lift and arch, eye scale and closed eyes. `PORTRAITS` in `render_portraits.py` adds pivot poses
(body lean and tilt, wing lift, flag flick, cap sway, arm raise) and the camera angle.

| Portrait | Expression |
| --- | --- |
| `coda-happy` | big open grin with tongue, happy lower-lid squint, head tilt, wings up |
| `coda-wow` | eyes ×1.13, raised arched brows, small "o" mouth, wings high |
| `coda-determined` | lowered lids with the outer corners lifted, brows angled in, wide toothy grin, leaning forward |
| `hush-sleepy` | lids 72% closed, yawning mouth |
| `hush-sad` | drooping lids with inner corners up, inner-raised brows, frown, tear |
| `hush-smile` | happy closed ^^ eyes, soft smile, arms raised |

Each portrait is 512×512 8-bit RGBA with a transparent background, PNG compression 100, and 97–121 KB.
Framing is a slight 3/4 view with the character filling about 80% of the card. Lighting is a warm key
(upper left), a cool fill (right) and two rims.

`public/art/keyart.jpg` is 1600×900, JPEG quality 85, 132 KB. The Encore banks right over a vivid sea
under a procedural golden-hour sky, with the low sun glowing behind a beacon island. Coda flies
alongside, trailing golden notes, among floating islands and cumulus clouds, with clear sky top-centre
for the logo. The scene is built entirely inside `render_portraits.py` and does not depend on the world kit.

## Toolkit notes (worked around in `char_lib.py`; `aaa_kit.py` is unchanged)

1. `aaa_kit.sphere` and `aaa_kit.capsule` use `bmesh.ops.create_uvsphere`, which welds its poles with a
   threaded merge. Face winding therefore changes between runs, and so do the exported index buffers and
   COLOR_0 order. `char_lib.uv_sphere_bm`, `ball` and `capsule` are deterministic drop-ins, and the eyelid
   shells use them too. Other kits that need byte-stable output may want the same fix.
2. `aaa_kit.extrude` bevels every edge, including the vertical edges between outline samples, which is
   expensive on smooth outlines. `char_lib.loft` and `shape2d` build slabs with rounded rims only.
3. `aaa_kit.bake_ao` samples per vertex, which shows as blotchy streaks on large smooth surfaces such as
   the 6 m cloud. `char_lib.smooth_ao` blurs the baked values across mesh edges after baking.
4. `aaa_kit.save_kit` rebuilds the `.blend` from re-imported GLBs. `build_characters.py` saves the
   native build scene instead, so the named source objects, pivots and materials stay editable.

## Review renders

In `artifacts/previews/`: `characters-sheet.png` and `characters-night.png` (all three roots),
`characters-coda.png`, `characters-coda-back.png`, `characters-hush.png`, `characters-hush-side.png`,
`characters-ship.png`, `characters-ship-back.png` (stern and keyboard) and `characters-ship-map.png`
(the high world-map angle).
