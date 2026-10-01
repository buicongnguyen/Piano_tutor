# Encore art contracts

Runtime code (`src/game/`) depends on the node names, material names, pivots
and sizes below. Change them only together with the runtime and
`src/game/assets.test.ts`.

General rules for every kit:

- Build with `aaa_kit.py` and `palette.py`: bevel every hard edge, keep forms chunky
  and toy-like (Mario Kart 8 is the quality bar, never the source of designs),
  and use saturated palette colours. Colour lives in `baseColorFactor`; baked AO lives in `COLOR_0`.
  Do not use image textures.
- Units are metres. Blender Z is up, and the asset front faces **-Y** (it becomes +Z in
  three.js). Each prop's root origin sits at its ground contact point (centre of the base)
  unless noted.
- Every top-level root is one prop. Keep pivots as empties or mesh parents with the
  exact names below, with identity rest rotation.
- Emissive materials use `emit` so bloom picks them up. Their names contain **Glow** or
  **Light** so the runtime can find and animate them.
- Budgets are decimal bytes in `public/models`: stage-kit ≤ 450 KB, world-kit ≤ 2,600 KB,
  characters ≤ 1,300 KB, fish-kit ≤ 160 KB. Most props should stay under 3k triangles and landmarks under 14k.
- Review with `art/encore/preview.py`. It renders a labelled contact sheet under the
  shared lights.

## stage-kit.glb (runtime: `src/game/stage.ts`)

| Root | Size / origin | Materials | Notes |
| --- | --- | --- | --- |
| `LanePad` | 1.0 W × 2.4 L × 0.42 H; origin at back-top hinge (y=+2.4 back … front at y=0) | `Pad Ivory`, `Pad Glow` (emissive, runtime tints per lane) | Big arcade key. Rotates about X at the hinge when pressed. |
| `WhiteKey` | 1.0 W × 6.0 L × 0.9 H; origin back-top hinge | `Key Ivory` | Scaled uniformly at runtime to key width. |
| `BlackKey` | 0.6 W × 3.8 L × 0.95 H, top 0.55 above the white-key top; origin back-top hinge | `Key Ebony` | |
| `Keybed_Mid` | 1.0 W (X extrusion, flat ends, **no** X bevel) | `Cabinet Lacquer` (runtime skin tint), `Cabinet Trim` (gold), `Cabinet Felt` | Stretched along X to fit the keys. |
| `Keybed_Left` / `Keybed_Right` | Rounded cheek blocks, ~1.4 W, with inner face at x=0 | same as above | Placed at the keybed ends. |
| `NoteGem` | 0.92 W × 0.62 D × 0.46 H, centred | `Gem Body` (white, runtime instance colour) | Chunky faceted jelly gem. One mesh and one material, for instancing. |
| `GoldGem` | same footprint as NoteGem | `Gem Gold` | Star-cut, for Encore phrases. |
| `HoldCap` | 0.7 W disc, 0.2 H | `Gem Body` | Tail end marker. |
| `CurbBlock` | 0.6 W × 1.0 L × 0.35 H, centred at the base | `Curb Paint` (white, runtime instance colour) | Piano-key curb. |
| `BarArch` | spans 9.0 between pillar centres, 5.5 tall; origin at the centre of the road | `Arch Paint` (runtime theme tint), `Arch Trim`, `Arch Bulb Glow` | Metronome-shaped pillars with a bulb-lit beam. |
| `RoadLamp` | ~3.2 tall | `Lamp Metal`, `Lamp Glow` | Music-stand lamp post. |

## world-kit.glb (runtime: `src/game/world.ts`)

Props are placed by per-island recipes. Required roots (height ranges are guides):

- Nature: `Tree_Round` (lollipop, 3.5–4.5 m), `Tree_Pine` (4–5 m), `Tree_Blossom`,
  `Tree_Maple` (autumn), `Tree_Palm`, `Tree_SnowPine`, `Bush`, `Rock`, `Flower_Patch`,
  `Sunflower_Patch`, `Cloud_Puff` (6–8 m wide, floats, origin at the centre),
  `Mountain` (25–35 m wide, 18–26 m tall), `Island_Base` (floating island chunk 22 m wide:
  top surface at z=0 with material **`Island Top`** that runtime tints to grass/snow/sand,
  and rocky underside ~10 m deep with `Island Rock`).
- Buildings: `House_Cottage`, `House_Tall`, `House_Round` (windows use **`Window Glow`**,
  emissive and dimmed by runtime in daytime), `Glasshouse` (conservatory dome),
  `Tent_Circus`, `Pier` (a 10 m straight segment), `Boat_Sail`.
- Landmarks: `Beacon`, a music-box lighthouse ~14 m tall with pivot `Beacon_Spin`
  (lamp room that rotates about Z) and emissive **`Beacon Light`**. `Windmill` with pivot
  `Windmill_Blades` (rotates about Y in Blender, facing -Y). `FerrisWheel` ~13 m with pivot
  `Ferris_Wheel` (rotates about Y) and bulbs **`Ferris Bulb Glow`**. `Carillon_Tower`
  (the finale castle bell tower, ~22 m, pivot `Carillon_Bell`). `Tower_Neon` (synth-city
  tower with **`Neon Glow`**). `Tree_Xmas` with **`Xmas Light Glow`**. `Snowman`. `Fountain`.
- Festive: `Lantern_Paper` (hanging lantern, **`Lantern Glow`**; origin at the top hook),
  `Lantern_Post`, `Bunting` (a 6 m flag string between two posts), `Balloon_Hot`
  (origin at the basket base).
- Story: `Crystal_Stillnote`, a frozen grey-lilac music-note crystal cluster ~2 m
  (material **`Stillnote Crystal`**). Silent notes on locked islands.

Foliage materials are named **`Foliage`**, **`Foliage Deep`** or **`Blossom`**. The runtime may
retint them per season. The desaturation shader treats every non-glow world material alike.

## fish-kit.glb (runtime: `src/game/render/shoals.ts`)

Roots: `Fish_Minnow`, `Fish_Koi`, `Fish_Gold`, `Fish_Clown`, `Fish_Neon`, `Fish_Ice`,
`Fish_Moon`. `THEME_FISH` in `shoals.ts` names the fish of each island's sea.

- Each fish is 1.0 m long with its origin at the body centre. The head faces -Y in
  Blender (+Z in three.js) and the tail tip sits at the opposite end.
- Keep each fish between 100 and 450 triangles. The runtime merges a species into one
  geometry (material colour × baked AO in vertex colours) and draws every fish of that
  species as one instanced mesh. It bends the body in the vertex shader, holding the
  head still and swinging the tail, so no tail pivot or rig is needed.
- Colour carries the read from the chase camera: bold bands, patches and stripes on a
  plain body. Faces take their material by position (`paint` in `build_fish.py`).
- Glowing parts use materials whose names contain **Glow** (`Fish Neon Glow`,
  `Fish Moon Glow`). They shine through the water tint and pick up bloom.

## characters.glb (runtime: `src/game/characters.ts`)

| Root | Pivots (exact) | Notes |
| --- | --- | --- |
| `Coda` | `Coda_Body`, `Coda_WingL`, `Coda_WingR`, `Coda_Flag`, `Coda_EyeL`, `Coda_EyeR` | Plump golden note-sprite ~0.9 m tall. Round body is the note head with big glossy eyes; the stem rises from the back of the head and ends in a flag (wags about its base). Stubby wings, rosy cheeks. Origin at the bottom of the body. |
| `Hush` | `Hush_Body`, `Hush_EyeL`, `Hush_EyeR`, `Hush_Cap` | Huge soft lilac-grey cloud creature (~6 m wide) with sleepy half-closed eyes, a floppy navy nightcap with a star pom-pom, and tiny cloud arms. Sad but lovable, never scary. Origin at the centre. |
| `Encore_Ship` | `Ship_Lid` (lid sail, hinge at the back edge), `Ship_PropL`, `Ship_PropR` (propellers rotate about their Y axis), `Ship_Balloon` | Flying grand piano: glossy cherry-red lacquer body (**`Ship Lacquer`**), gold trim, ivory/ebony keys, a raised lid as a sail with a sunshine stripe, two brass propeller pods, a small striped balloon envelope above and pennant flags. ~6 m long. Origin at the centre of the hull bottom. |

Portraits (Blender renders, 512×512 PNG with transparent background) go in `public/art/portraits/`:
`coda-happy.png`, `coda-wow.png`, `coda-determined.png`, `hush-sleepy.png`, `hush-sad.png`,
`hush-smile.png`. Key art (`public/art/keyart.jpg`, 1600×900) shows the Encore ship with Coda
over a golden sea of islands.
