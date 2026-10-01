"""Fish kit for Stillnote Encore: tiny toy fish that swim beside the Piano Road.

Run from the repository root:
    BL=$(node scripts/blender.mjs --where); "$BL" -b --factory-startup --python art/encore/build_fish.py

Exports public/models/fish-kit.glb. The idea comes from the Zoo Garden pond fish
(cute_game): fish read from a high game camera through bold silhouettes and simple
high-contrast colour patterns, not detail. So each species is a few hundred
triangles: a lofted body with per-face colour bands or patches, a flat tail and
dorsal fin, and dark eyes.

Runtime contract (art/encore/CONTRACTS.md, src/game/render/shoals.ts):
  * one root per species, named Fish_<Species>, origin at the body centre;
  * 1.0 m long, head toward -Y in Blender (+Z in three.js), tail toward +Y;
  * the runtime merges each species into one instanced geometry and bends it in
    the vertex shader (head still, tail swinging), so no tail pivot is needed;
  * emissive parts use materials whose names contain "Glow".
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aaa_kit import *
from palette import P, toy

random.seed(23)
reset()

SIDES = 10  # body cross-section: low, but smooth-shaded it still reads round


def hash01(*v):
    s = math.sin(sum(c * k for c, k in zip(v, (12.9898, 78.233, 37.719)))) * 43758.5453
    return s - math.floor(s)


def body(name, rings, materials, paint):
    """Loft a fish body along +Y from the nose.

    rings: [(y, half_width, half_height, z_centre), ...] from nose to tail root; a zero
    width ring becomes a pole. paint(cx, cy, cz, side) -> material index for each face.
    """
    bm = bmesh.new()
    loops = []
    for y, w, h, zc in rings:
        if w <= 1e-6:
            loops.append([bm.verts.new((0, y, zc))])
            continue
        loops.append([bm.verts.new((w * math.cos(TAU * i / SIDES + math.pi / 2) * 1.0,
                                    y,
                                    zc + h * math.sin(TAU * i / SIDES + math.pi / 2)))
                      for i in range(SIDES)])
    for a, b in zip(loops, loops[1:]):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        c = f.calc_center_median()
        f.material_index = paint(c.x, c.y, c.z, 1 if c.x >= 0 else -1)
    ob = from_bmesh(name, bm, None, smooth_angle=60)
    for m in materials:
        ob.data.materials.append(m)
    return ob


def fin(name, outline, thick, material, x=0.0):
    """A flat fin in the YZ plane: outline [(y, z), ...], `thick` across X."""
    bm = bmesh.new()
    left = [bm.verts.new((x - thick / 2, y, z)) for y, z in outline]
    right = [bm.verts.new((x + thick / 2, y, z)) for y, z in outline]
    bm.faces.new(left)
    bm.faces.new(list(reversed(right)))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], ngon_method='EAR_CLIP')
    return from_bmesh(name, bm, material, smooth_angle=30)


def plate(name, base, du, dv, outline, thick, material):
    """A thin fin plate: outline [(u, v), ...] mapped to base + u*du + v*dv, `thick` along du x dv."""
    base, du, dv = Vector(base), Vector(du), Vector(dv)
    n = du.cross(dv).normalized() * thick / 2
    bm = bmesh.new()
    top = [bm.verts.new(base + du * u + dv * v + n) for u, v in outline]
    bot = [bm.verts.new(base + du * u + dv * v - n) for u, v in outline]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    k = len(outline)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((top[i], top[j], bot[j], bot[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], ngon_method='EAR_CLIP')
    return from_bmesh(name, bm, material, smooth_angle=30)


def side_fins(name, y, z, w, length, material, spread=.75, droop=.35):
    """A pair of paddle fins (pectorals) swept out and back from the body sides."""
    out = []
    for s in (-1, 1):
        du = Vector((s * math.cos(spread), math.sin(spread), -droop)).normalized() * length
        dv = Vector((0, 1, 0)) * length * .5
        shape = [(0, -.25), (.55, -.35), (1, -.1), (.9, .25), (.3, .35), (0, .25)]
        out.append(plate(f'{name} {s}', (s * w * .9, y, z), du, dv, shape, .012, material))
    return out


def eyes(name, y, z, w, r, material):
    return [sphere(f'{name} eye {s}', r, (s * w, y, z), material, seg=8, rings=5) for s in (-1, 1)]


def profile(length_body, w, h, belly=0.0, nose=0.06, tail_root=0.035, y0=-0.5, n=7):
    """Body rings from the nose pole at y0 back over `length_body`: plump at ~36%, then
    tapering to the tail root, where a second pole closes the body under the tail fin."""
    rings = [(y0, 0, 0, 0), (y0 + .02, w * .45, h * .45, 0)]  # a rounded toy nose, not a point
    for k in range(1, n + 1):
        t = k / n
        if t < .36:
            shape = math.sin(t / .36 * math.pi / 2)
        else:
            shape = 1 - ((t - .36) / .64) ** 1.6 * (1 - tail_root / w)
        y = y0 + nose * .5 + t * (length_body - nose * .5)
        rings.append((y, max(tail_root, w * shape), max(tail_root * 1.4, h * shape), -belly * h * shape * .35))
    rings.append((y0 + length_body + .03, 0, 0, 0))
    return rings


EYE = toy('Fish Eye', 'eye', 'gloss')
roots = []


def species(name, rings, mats, paint, tail, dorsal, fins_mat, extra=(), eye=(.035, .03), pect=None, tail_x=0.0):
    root = empty(name)
    parts = [body(f'{name} body', rings, mats, paint)]
    parts.append(fin(f'{name} tail', tail, .018, fins_mat, x=tail_x))
    if dorsal:
        parts.append(fin(f'{name} dorsal', dorsal, .016, fins_mat))
    if pect:
        parts += side_fins(f'{name} pect', *pect, fins_mat)
    # Eyes sit on the widest ring near the head.
    ny, nz, nw = rings[3][0], rings[3][3] + rings[3][2] * .28, rings[3][1] * .86
    parts += eyes(name, ny, nz, nw, eye[0], EYE)
    parts += list(extra)
    merged = join(parts, f'{name} Mesh')
    set_parent(merged, root)
    bake_ao([merged], rays=24, distance=.12, strength=.45)
    roots.append(root)
    return root


def fork_tail(y0, span, height, notch=.55):
    """Forked caudal fin starting at the tail root (y0)."""
    return [(y0 - .02, .025), (y0 + span * .55, height * .45), (y0 + span, height), (y0 + span * notch, 0),
            (y0 + span, -height), (y0 + span * .55, -height * .45), (y0 - .02, -.025)]


def fan_tail(y0, span, height, notch=.25):
    """Rounded double-lobed fan (goldfish, koi, clownfish): root top, rim top to bottom, root bottom."""
    pts = [(y0 - .02, .03)]
    for k in range(9):
        a = math.pi / 2 - math.pi * k / 8
        r = span * (1 - notch + notch * abs(math.sin(a)))
        pts.append((y0 + span * .12 + r * math.cos(a) * .9, height * math.sin(a)))
    pts.append((y0 - .02, -.03))
    return pts


def dorsal_fin(y0, y1, base_z, height, sweep=.6):
    return [(y0, base_z - .01), (y0 + (y1 - y0) * sweep * .4, base_z + height), (y1, base_z + height * .35),
            (y1 + .02, base_z - .01)]


# ------------------------------------------------------------------ Minnow (meadow, pier, spring)
back = toy('Fish Minnow Back', 'sky', 'gloss')
belly = toy('Fish Minnow Belly', 'ivory', 'gloss')
stripe = toy('Fish Minnow Stripe', 'tangerine', 'gloss')
finm = toy('Fish Minnow Fin', 'sunshine', 'gloss')
r = profile(.72, .075, .1, belly=.3)
species('Fish_Minnow', r, [back, belly, stripe],
        lambda x, y, z, s: 2 if abs(z + .005) < .022 and y < .1 else (1 if z < -.01 else 0),
        fork_tail(.2, .3, .16), dorsal_fin(-.08, .08, .085, .09), finm)

# ------------------------------------------------------------------ Koi (garden, festival, spring, autumn, crown)
kbody = toy('Fish Koi Body', 'ivory', 'gloss')
kpatch = toy('Fish Koi Patch', 'coral', 'gloss')
kgold = toy('Fish Koi Gold', 'tangerine', 'gloss')
kfin = toy('Fish Koi Fin', '#ffe3d6', 'gloss')


def koi_paint(x, y, z, s):
    if z < -.03:
        return 0  # pale belly
    n = hash01(round(y * 7), 1 if x >= 0 else 0, round(z * 9))
    if (y < -.3 and z > .02) or n > .62:
        return 1
    return 2 if n < .14 else 0


species('Fish_Koi', profile(.74, .1, .11, belly=.2), [kbody, kpatch, kgold], koi_paint,
        fan_tail(.22, .3, .19), dorsal_fin(-.16, .14, .1, .07, sweep=.9), kfin,
        pect=(-.24, -.04, .085, .14))

# ------------------------------------------------------------------ Goldfish (festival, summer, autumn, crown)
gbody = toy('Fish Gold Body', 'tangerine', 'gloss')
gback = toy('Fish Gold Back', 'coral', 'gloss')
gbelly = toy('Fish Gold Belly', 'sunshine', 'gloss')
gfin = toy('Fish Gold Fin', '#ffb347', 'gloss')
species('Fish_Gold', profile(.6, .13, .17, belly=.5, nose=.05), [gbody, gback, gbelly],
        lambda x, y, z, s: 1 if z > .07 else (2 if z < -.06 else 0),
        fan_tail(.1, .4, .26), dorsal_fin(-.2, .04, .15, .12, sweep=.7), gfin,
        pect=(-.26, -.07, .11, .13), eye=(.042, .04))

# ------------------------------------------------------------------ Clownfish (pier, summer)
cbody = toy('Fish Clown Body', 'tangerine', 'gloss')
cband = toy('Fish Clown Band', 'ivory', 'gloss')
cedge = toy('Fish Clown Edge', 'ebony', 'gloss')
cfin = toy('Fish Clown Fin', '#ff7a1a', 'gloss')


def clown_paint(x, y, z, s):
    for c in (-.3, -.02, .2):
        d = abs(y - c)
        if d < .05:
            return 1
        if d < .075:
            return 2
    return 0


species('Fish_Clown', profile(.7, .1, .15, belly=.25), [cbody, cband, cedge], clown_paint,
        fan_tail(.2, .26, .16), dorsal_fin(-.2, .16, .13, .08, sweep=.5), cfin,
        pect=(-.22, -.05, .09, .12))

# ------------------------------------------------------------------ Neon tetra (neon reef)
nback = toy('Fish Neon Back', 'navy', 'gloss')
nglow = toy('Fish Neon Glow', 'neon_cyan', 'gloss', emit=2.2)
nred = toy('Fish Neon Red', 'berry', 'gloss')
nbelly = toy('Fish Neon Belly', 'ivory', 'gloss')
nfin = toy('Fish Neon Fin', '#9fdcff', 'gloss')


def neon_paint(x, y, z, s):
    if abs(z - .012) < .026 and y < .12:
        return 1  # the glowing stripe
    if z < -.01:
        return 2 if y > -.12 else 3
    return 0


species('Fish_Neon', profile(.72, .07, .1, belly=.25), [nback, nglow, nred, nbelly], neon_paint,
        fork_tail(.2, .28, .15), dorsal_fin(-.04, .1, .08, .09), nfin)

# ------------------------------------------------------------------ Ice fish (snow, winter)
iback = toy('Fish Ice Back', 'sky', 'gloss')
ibody = toy('Fish Ice Body', 'ice', 'gloss')
ibelly = toy('Fish Ice Belly', 'snow', 'gloss')
ifin = toy('Fish Ice Fin', '#e6f7ff', 'gloss')
species('Fish_Ice', profile(.74, .085, .12, belly=.3), [iback, ibody, ibelly],
        lambda x, y, z, s: 0 if z > .05 else (2 if z < -.04 else 1),
        fork_tail(.22, .28, .17, notch=.45), dorsal_fin(-.12, .12, .1, .1, sweep=.4), ifin,
        pect=(-.24, -.04, .07, .12))

# ------------------------------------------------------------------ Moon fish (harbour at night)
mbody = toy('Fish Moon Body', 'violet', 'gloss')
mback = toy('Fish Moon Back', 'royal', 'gloss')
mglow = toy('Fish Moon Glow', 'window_glow', 'gloss', emit=2.6)
mfin = toy('Fish Moon Fin', '#b79cff', 'gloss')


def moon_paint(x, y, z, s):
    if abs(z) < .05 and hash01(round(y * 11), 1 if x >= 0 else 0, 3) > .58 and -.38 < y < .16:
        return 2  # lantern spots along the flank
    return 1 if z > .05 else 0


species('Fish_Moon', profile(.72, .1, .14, belly=.2), [mbody, mback, mglow], moon_paint,
        fork_tail(.2, .3, .19), dorsal_fin(-.14, .1, .12, .1), mfin,
        pect=(-.22, -.05, .09, .12))

# The runtime clones each root by name and places every copy itself.
bpy.context.view_layer.update()
info = export('fish-kit', roots)
assert info['bytes'] <= 160_000, info
# The editable .blend lays the fish out in a row.
for i, root in enumerate(roots):
    root.location = (i * 1.5, 0, 0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'encore', 'fish-kit.blend'), compress=True)
