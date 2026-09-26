# World kit (`public/models/world-kit.glb`)

Headless generator: `art/encore/build_world.py` (helpers in `world_lib.py`, builders in `world_nature.py`,
`world_buildings.py`, `world_landmarks.py`, `world_festive.py`). Editable scene: `art/encore/world-kit.blend`.

```
BL=$(node scripts/blender.mjs --where); "$BL" -b --factory-startup --python art/encore/build_world.py
# or: npm run assets:world        (~11 s, no GPU needed)
# iterate: ... build_world.py -- --only Beacon,Windmill --out artifacts/wk-test --noblend
```

**GLB: 2,550,016 bytes** (budget 2,600,000), 33 roots, 92,326 triangles, 71 materials, no textures.
Units are metres, Blender Z-up, and fronts face -Y (three.js +Z). Each root is one top-level node, and the
roots are laid out side by side along X in the file.

## Roots

The size column is W (X) x D (Y) x H (Z) in Blender metres. The Z column is the vertical extent relative to
the root origin. Unless noted, the origin is the ground-contact centre.

| Root | Size W x D x H | Z range | Tris | Pivots | Glow materials |
| --- | --- | --- | --- | --- | --- |
| `Tree_Round` | 3.0 x 2.9 x 4.4 | -0.05 .. 4.37 | 1382 | - | - |
| `Tree_Pine` | 3.4 x 3.4 x 4.8 | -0.05 .. 4.74 | 1560 | - | - |
| `Tree_Blossom` | 4.4 x 3.9 x 4.8 | -0.08 .. 4.73 | 1538 | - | - |
| `Tree_Maple` | 3.7 x 3.5 x 4.9 | -0.05 .. 4.83 | 1884 | - | - |
| `Tree_Palm` | 5.4 x 5.3 x 5.7 | -0.07 .. 5.58 | 1772 | - | - |
| `Tree_SnowPine` | 3.8 x 3.5 x 4.9 | -0.05 .. 4.84 | 2592 | - | - |
| `Bush` | 2.2 x 1.8 x 1.4 | 0.01 .. 1.39 | 1672 | - | - |
| `Rock` | 3.4 x 2.2 x 1.2 | -0.05 .. 1.18 | 596 | - | - |
| `Flower_Patch` | 3.1 x 1.8 x 1.1 | -0.01 .. 1.07 | 1600 | - | - |
| `Sunflower_Patch` | 3.1 x 1.6 x 2.9 | -0.01 .. 2.86 | 2596 | - | - |
| `Cloud_Puff` | 7.3 x 3.9 x 3.3 | -1.66 .. 1.66 (origin = centre) | 1536 | - | - |
| `Mountain` | 30.2 x 30.2 x 25.0 | -0.90 .. 24.10 | 3916 | - | - |
| `Island_Base` | 22.3 x 22.4 x 10.1 | -10.05 .. 0.00 (top = 0) | 3200 | - | - |
| `House_Cottage` | 7.0 x 5.9 x 6.7 | 0.00 .. 6.68 | 3294 | - | Window Glow |
| `House_Tall` | 5.4 x 5.8 x 11.7 | 0.00 .. 11.71 | 5190 | - | Window Glow |
| `House_Round` | 6.4 x 6.5 x 8.0 | 0.00 .. 7.95 | 4920 | - | Window Glow |
| `Glasshouse` | 9.3 x 10.7 x 10.1 | 0.00 .. 10.11 | 6056 | - | Window Glow |
| `Tent_Circus` | 10.1 x 10.1 x 8.8 | 0.00 .. 8.80 | 3464 | - | - |
| `Pier` | 4.1 x 10.0 x 5.5 | -1.50 .. 4.04 (origin = water line) | 2384 | - | Lantern Glow |
| `Boat_Sail` | 2.3 x 6.0 x 7.1 | -0.55 .. 6.57 (origin = water line) | 2216 | - | Window Glow |
| `Beacon` | 7.7 x 7.6 x 14.9 | 0.00 .. 14.90 | 5438 | `Beacon_Spin` | Beacon Light, Window Glow |
| `Windmill` | 8.4 x 7.1 x 11.8 | 0.00 .. 11.76 | 4028 | `Windmill_Blades` | Window Glow |
| `FerrisWheel` | 12.6 x 5.7 x 13.5 | 0.00 .. 13.52 | 6162 | `Ferris_Wheel` | Ferris Bulb Glow, Window Glow |
| `Carillon_Tower` | 9.5 x 9.1 x 23.6 | -0.10 .. 23.55 | 6722 | `Carillon_Bell` | Window Glow |
| `Tower_Neon` | 5.6 x 5.6 x 18.7 | 0.00 .. 18.69 | 3268 | - | Neon Glow, Neon Glow Cyan, Window Glow |
| `Tree_Xmas` | 3.2 x 3.2 x 5.4 | -0.01 .. 5.40 | 3468 | - | Xmas Light Glow, Star Glow |
| `Snowman` | 2.5 x 2.1 x 3.6 | -0.01 .. 3.55 | 2000 | - | - |
| `Fountain` | 5.4 x 5.4 x 3.9 | 0.00 .. 3.86 | 2990 | - | - |
| `Lantern_Paper` | 0.7 x 0.7 x 1.5 | -1.49 .. 0.02 (origin = top hook) | 688 | - | Lantern Glow |
| `Lantern_Post` | 2.2 x 0.9 x 3.9 | 0.00 .. 3.89 | 1828 | - | Lantern Glow |
| `Bunting` | 6.4 x 0.4 x 2.8 | 0.00 .. 2.79 (posts at x = +-3) | 432 | - | - |
| `Balloon_Hot` | 6.0 x 6.0 x 10.0 | 0.00 .. 10.00 (origin = basket base) | 1260 | - | Lantern Glow |
| `Crystal_Stillnote` | 2.0 x 1.7 x 2.1 | -0.05 .. 2.02 | 674 | - | - |

## Pivots

All pivots are empties with identity rest rotation. Their origin is the rotation centre, and every animated
mesh is parented under them.

- `Beacon_Spin` sits at the lamp-room floor (z = 10.18) and spins about Blender Z (three.js Y). The glass, the
  Beacon Light core with its two Fresnel lenses, the red dome and the gold note weathervane all turn together.
- `Windmill_Blades` is the hub at (0, -3.25, 7.55). The sails lie in the XZ plane, face -Y and turn about
  Blender Y (three.js Z). The sail plane sits in front of the gallery, so a full turn never clips the railing
  (sweep-tested).
- `Ferris_Wheel` is the hub at (0, 0, 7.2) and turns about Blender Y (three.js Z). The eight gondolas are round
  bubble cars on the wheel itself, and their look doesn't change with wheel rotation, so no counter-rotation is
  needed. The lowest car clears the platform through a full turn (sweep-tested).
- `Carillon_Bell` is the bell's yoke hinge at (0, 0, 16.25). The bell swings through the open belfry arches.

## Materials

- Every material is a `palette.toy()` material (`world_lib.SPEC`). Colour lives in `baseColorFactor` and baked
  AO lives in `COLOR_0`. `COLOR_0` includes a gentle vertical tint on foliage, walls, rock, cloud and snow.
- `Foliage`, `Foliage Deep` and `Blossom` are the retintable foliage names; `Foliage` is double-sided for the
  palm fronds. The maple uses `Maple Leaf`, `Maple Leaf Deep` and `Maple Leaf Gold`, so its autumn colours are
  not retinted.
- `Island Top` covers the island top and lip, plus the Mountain's grass skirt and ledges, so they follow the
  island tint. `Island Rock` covers the island underside, the Rock prop and the mountain rock.
- Glow materials (all use `emit`, and every name contains Glow or Light): Window Glow (blue glass base with a
  warm 2.4 emission), Beacon Light (7), Lantern Glow (2.4), Neon Glow / Neon Glow Cyan (4), Xmas Light Glow
  (4.5), Star Glow (3), Ferris Bulb Glow (4.5). No other material is emissive.
- `Glass Pane` (glasshouse and lamp room) is alpha-blended at 0.38. `Stillnote Crystal` is glossy grey-lilac,
  flat-shaded facets.

## Export notes

- After export, `build_world.py` rewrites `COLOR_0` from normalized uint16 to normalized uint8 (core glTF, no
  extension) and writes JSON floats as the shortest float32 round-trip strings. Accessor min/max stay exact.
- Each mesh node has an identity transform under its root or pivot, so bounding boxes are tight.
- Geometry is deterministic (fixed seeds). Byte-identical rebuilds are not guaranteed: Blender's multithreaded
  mesh evaluation can reorder triangles and adds about 1e-4 of noise to normals.

Review renders are in `artifacts/previews/world-*.png`. `artifacts/tools/` has the review helpers:
`scene_preview.py` (gameplay-camera shot), `world_kit_check.mjs` (loads the GLB with three's GLTFLoader and
checks the contract) and `glb_bytes.py` (per-root byte report).
