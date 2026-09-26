"""Stage kit for Stillnote Encore: the playable keys, note gems and Piano Road dressing.

Run from the repository root:
    BL=$(node scripts/blender.mjs --where); "$BL" -b --factory-startup --python art/encore/build_stage.py

Exports public/models/stage-kit.glb. Sizes and names are runtime contracts
(art/encore/CONTRACTS.md, src/game/stage.ts). Keys hinge at their back-top edge
(origin), extend toward the player along -Y (three.js +Z) and sit below z=0.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aaa_kit import *
from palette import P, toy

random.seed(11)
reset()


def rounded_rect(w, l, r, y0=0.0, seg=5):
    """Outline of a w x l rectangle spanning y in [y0 - l, y0] with corner radius r (XY plane)."""
    pts = []
    corners = [(w / 2 - r, y0 - r, 0), (-w / 2 + r, y0 - r, 90), (-w / 2 + r, y0 - l + r, 180),
               (w / 2 - r, y0 - l + r, 270)]
    for cx, cy, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def finish(root, objs, ground=None, strength=.55):
    merged = join_by_material(objs, root.name)
    bake_ao(merged, rays=40, distance=.5, strength=strength, ground=ground)
    return merged


roots = []

# ------------------------------------------------------------------ LanePad
ivory = toy('Pad Ivory', 'ivory', 'gloss')
pad_glow = toy('Pad Glow', '#ffffff', 'gloss', emit=1.6)
lane = empty('LanePad')
parts = [extrude('pad body', rounded_rect(.96, 2.36, .2, seg=3), .42, ivory, bevel=.07, segments=3,
                 loc=(0, -.02, -.21), plane='XY')]
# A slightly raised finger dish and the lane-colour jewel near the front edge.
parts.append(cyl('pad dish', .34, .05, (0, -1.55, .005), ivory, verts=24, bevel=.02))
parts.append(cyl('pad jewel', .2, .07, (0, -1.55, .03), pad_glow, verts=20, bevel=.025))
parts.append(box('pad nose light', (.72, .06, .1), (0, -2.405, -.2), pad_glow, bevel=.025))
for p in parts:
    set_parent(p, lane)
finish(lane, parts)
roots.append(lane)

# ------------------------------------------------------------------ Real piano keys
key_ivory = toy('Key Ivory', 'ivory', 'gloss')
key_ebony = toy('Key Ebony', 'ebony', 'gloss')
white = empty('WhiteKey', loc=(3, 0, 0))
wparts = [extrude('white body', rounded_rect(.94, 5.96, .12, seg=1), .9, key_ivory, bevel=.08, segments=2,
                  loc=(3, -.02, -.45), plane='XY')]
for p in wparts:
    set_parent(p, white)
finish(white, wparts)
roots.append(white)

black = empty('BlackKey', loc=(5, 0, 0))
# Origin at the back edge at white-key-top height; the key top rises 0.55 above it.
bparts = [extrude('black body', rounded_rect(.6, 3.8, .1, seg=1), .95, key_ebony, bevel=.08, segments=2,
                  loc=(5, -.01, .55 - .475), plane='XY')]
# Sloped front face: a bevelled wedge that softens the nose like a real sharp key.
bparts.append(box('black nose', (.54, .5, .5), (5, -3.72, .22), key_ebony, bevel=.1, segments=2,
                  rot=(math.radians(-32), 0, 0)))
for p in bparts:
    set_parent(p, black)
finish(black, bparts)
roots.append(black)

# ------------------------------------------------------------------ Keybed (cabinet under/around the keys)
lacquer = toy('Cabinet Lacquer', 'cherry', 'gloss')
trim = toy('Cabinet Trim', 'gold', 'metal')
felt = toy('Cabinet Felt', 'felt', 'matte')


def profile_bar(name, outline, material, x0=-.5, width=1.0):
    """Extrude a Y/Z profile along X from x0 to x0+width with flat ends (safe to stretch in X)."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in outline]
    b = [bm.verts.new((x0 + width, y, z)) for y, z in outline]
    n = len(outline)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bmesh(name, bm, material, smooth_angle=40)


def rounded_profile(pts, r, seg=4):
    """Round the corners of a closed Y/Z polygon."""
    out = []
    n = len(pts)
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        d0, d1 = (p0 - p1).normalized(), (p2 - p1).normalized()
        rr = min(r, (p0 - p1).length * .45, (p2 - p1).length * .45)
        a, b = p1 + d0 * rr, p1 + d1 * rr
        for k in range(seg + 1):
            t = k / seg
            q = (1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t * t * b
            out.append((q.x, q.y))
    return out


mid = empty('Keybed_Mid', loc=(0, 6, 0))
# Body under the keys and the key slip rail in front of them (front is -Y).
body_profile = rounded_profile([(-2.95, -.18), (-2.95, -1.25), (.5, -1.25), (.5, -.46), (-2.45, -.46),
                                (-2.45, -.18)], .12)
mparts = [profile_bar('keybed body', [(y, z) for y, z in body_profile], lacquer)]
mparts.append(profile_bar('keybed trim', rounded_profile([(-3.02, -.3), (-3.02, -.42), (-2.9, -.42), (-2.9, -.3)], .03),
                          trim))
mparts.append(profile_bar('keybed felt', rounded_profile([(0, -.02), (0, -.1), (.42, -.1), (.42, -.02)], .03), felt))
mparts.append(profile_bar('keybed back', rounded_profile([(.42, .12), (.42, -.46), (.62, -.46), (.62, .12)], .06), lacquer))
mparts.append(profile_bar('keybed back trim', rounded_profile([(.4, .12), (.4, .05), (.64, .05), (.64, .12)], .02), trim))
for p in mparts:
    p.location.y += 6
    set_parent(p, mid)
finish(mid, mparts, strength=.35)
roots.append(mid)


def cheek(name, side, x):
    root = empty(name, loc=(x, 6, 0))
    s = 1 if side > 0 else -1
    cparts = []
    # The rounded arm: a thick slab with a scrolled front.
    body = box(f'{name} arm', (1.35, 3.6, 1.55), (x + .675 * s, 6 - 1.25, -.35), lacquer, bevel=.22, segments=4)
    cparts.append(body)
    scroll = cyl(f'{name} scroll', .78, 1.35, (x + .675 * s, 6 - 3.0, -.1), lacquer, verts=40, bevel=.16,
                 rot=(0, math.radians(90), 0))
    cparts.append(scroll)
    cparts.append(torus(f'{name} scroll trim', .78, .06, (x + (1.35 + .02) * s if s > 0 else x - 1.37, 6 - 3.0, -.1),
                        trim, rot=(0, math.radians(90), 0), maj=40, mn=10))
    cparts.append(cyl(f'{name} boss', .3, .1, (x + (1.36) * s if s > 0 else x - 1.36, 6 - 3.0, -.1), trim, verts=28,
                      bevel=.04, rot=(0, math.radians(90), 0)))
    cparts.append(box(f'{name} cap trim', (1.39, 3.64, .08), (x + .675 * s, 6 - 1.25, .43), trim, bevel=.035))
    # A tiny gold stud row along the top, like a toy's rivets.
    for i in range(4):
        cparts.append(sphere(f'{name} stud {i}', .07, (x + .675 * s, 6 - .1 - i * .65, .5), trim, seg=12, rings=6))
    for p in cparts:
        set_parent(p, root)
    finish(root, cparts, strength=.45)
    return root


roots.append(cheek('Keybed_Left', -1, -4))
roots.append(cheek('Keybed_Right', 1, 4))

# ------------------------------------------------------------------ Note gems
gem_body = toy('Gem Body', '#ffffff', 'gloss')
gem_gold = toy('Gem Gold', 'gold', 'metal', emit=.35)


def gem_mesh(name, outline_pts, height, table_scale, mat, loc, bevel=.045, segments=3, smooth=34):
    """A chunky cut gem: bevelled prism with a raised, inset table facet on top."""
    bm = bmesh.new()
    bot = [bm.verts.new((u, v, -height / 2)) for u, v in outline_pts]
    mid = [bm.verts.new((u * 1.0, v * 1.0, height * .12)) for u, v in outline_pts]
    top = [bm.verts.new((u * table_scale, v * table_scale, height / 2)) for u, v in outline_pts]
    n = len(outline_pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], mid[j], mid[i]))
        bm.faces.new((mid[i], mid[j], top[j], top[i]))
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, offset_type='OFFSET', segments=segments, profile=.5,
                        affect='EDGES', clamp_overlap=True)
    ob = from_bmesh(name, bm, mat, loc=loc, smooth_angle=smooth)
    return ob


def cut_gem(name, w, d, h, sides, mat, loc):
    """Brilliant-style jewel: pavilion, girdle band, crown facets and a flat table.
    Crisp facets (low smoothing angle) so env reflections sparkle; ~20 tris per side."""
    bm = bmesh.new()

    def ring(scale, z, twist=0.0):
        out = []
        for i in range(sides):
            a = TAU * (i + twist) / sides
            c, s_ = math.cos(a), math.sin(a)
            # squircle-ish footprint so the gem fills its lane
            x = math.copysign(abs(c) ** .7, c) * w / 2 * scale
            y = math.copysign(abs(s_) ** .7, s_) * d / 2 * scale
            out.append(bm.verts.new((x, y, z)))
        return out

    tip = bm.verts.new((0, 0, -h / 2))
    pav = ring(.62, -h * .3, .5)
    g0 = ring(1.0, -h * .06)
    g1 = ring(1.0, h * .08)
    crown = ring(.8, h * .32, .5)
    table = ring(.5, h / 2)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new((tip, pav[j], pav[i]))
        bm.faces.new((pav[i], pav[j], g0[j], g0[i]))
        bm.faces.new((g0[i], g0[j], g1[j], g1[i]))
        bm.faces.new((g1[i], g1[j], crown[j], crown[i]))
        bm.faces.new((crown[i], crown[j], table[j], table[i]))
    bm.faces.new(table)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bmesh(name, bm, mat, loc=loc, smooth_angle=18)
    return ob


def superellipse(w, d, n=28, e=3.2):
    pts = []
    for i in range(n):
        a = TAU * i / n
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c) ** (2 / e), c) * w / 2
        y = math.copysign(abs(s) ** (2 / e), s) * d / 2
        pts.append((x, y))
    return pts


gem = empty('NoteGem', loc=(0, -6, 0))
g = cut_gem('note gem', .92, .62, .46, 12, gem_body, (0, -6, 0))
set_parent(g, gem)
bake_ao([g], rays=24, distance=.3, strength=.25)
roots.append(gem)


def star(points=5, r_out=.5, r_in=.27):
    pts = []
    for i in range(points * 2):
        a = math.pi / 2 + math.pi * i / points
        r = r_out if i % 2 == 0 else r_in
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts


# The gold gem stands upright, facing the player (-Y), so it reads as a star down the road.
gold_root = empty('GoldGem', loc=(2, -6, 0))
sg = gem_mesh('gold gem', star(5, .5, .27), .3, .62, gem_gold, (2, -6, 0), bevel=.035, segments=2)
sg.rotation_euler = (math.radians(90), 0, 0)
set_parent(sg, gold_root)
bake_ao([sg], rays=32, distance=.3, strength=.3)
roots.append(gold_root)

cap = empty('HoldCap', loc=(4, -6, 0))
c = cyl('hold cap', .35, .2, (4, -6, 0), gem_body, verts=20, bevel=.06, segments=2)
set_parent(c, cap)
roots.append(cap)

hold = empty('HoldBody', loc=(6, -6, 0))
# One metre along Y with flat ends so the runtime can stretch it to any tail length.
hb = profile_bar('hold body', rounded_profile([(-.25, -.09), (.25, -.09), (.25, .09), (-.25, .09)], .08), gem_body,
                 x0=-.5, width=1.0)
hb.rotation_euler = (0, 0, math.radians(90))
hb.location = (6, -6, 0)
apply_transform(hb)
set_parent(hb, hold)
roots.append(hold)

# ------------------------------------------------------------------ Road dressing
curb_paint = toy('Curb Paint', '#ffffff', 'gloss')
curb = empty('CurbBlock', loc=(8, -6, 0))
cb = extrude('curb', rounded_rect(.6, 1.0, .1, y0=.5, seg=1), .35, curb_paint, bevel=.06, segments=2,
             loc=(8, -6, .175), plane='XY')
set_parent(cb, curb)
bake_ao([cb], rays=24, distance=.3, strength=.3, ground=0)
roots.append(curb)

arch_paint = toy('Arch Paint', 'royal', 'gloss')
arch_trim = toy('Arch Trim', 'gold', 'metal')
bulb = toy('Arch Bulb Glow', '#fff1b8', 'gloss', emit=6.0)
arch = empty('BarArch', loc=(0, -16, 0))
aparts = []
for side in (-1, 1):
    x = 4.5 * side
    # Metronome pillar: a tapered, bevelled pyramid with a gold faceplate and a pendulum.
    aparts.append(box(f'arch pillar {side}', (1.5, 1.2, 4.4), (x, -16, 2.2), arch_paint, bevel=.2, segments=4,
                      taper=(.55, .6)))
    aparts.append(box(f'arch plinth {side}', (1.9, 1.6, .5), (x, -16, .25), arch_trim, bevel=.12))
    aparts.append(box(f'arch face {side}', (.62, .08, 2.6), (x, -16.52, 2.2), arch_trim, bevel=.03,
                      taper=(.6, 1)))
    aparts.append(sphere(f'arch knob {side}', .32, (x, -16, 4.62), arch_trim, seg=20, rings=10))
for side in (-1, 1):
    x = 4.5 * side
    pend = empty(f'BarArch_Pendulum{"L" if side < 0 else "R"}', loc=(x, -16.6, 1.0))
    set_parent(pend, arch)
    rod_ob = rod(f'arch rod {side}', (x, -16.6, 1.0), (x, -16.6, 3.5), .05, arch_trim, verts=10)
    weight = box(f'arch weight {side}', (.32, .14, .36), (x, -16.6, 2.75), arch_paint, bevel=.06)
    for p in (rod_ob, weight):
        set_parent(p, pend)
    bake_ao([rod_ob, weight], rays=16, distance=.2, strength=.2)
# The beam: a chunky arc from pillar top to pillar top, dotted with bulbs.
pts = []
for i in range(25):
    t = i / 24
    ang = math.pi * t
    pts.append((-4.5 * math.cos(ang), -16, 4.4 + 1.25 * math.sin(ang)))
aparts.append(tube('arch beam', pts, .32, arch_paint, verts=14))
aparts.append(tube('arch beam trim', [(x, y - .3, z) for x, y, z in pts], .1, arch_trim, verts=8))
for i in range(1, 12):
    t = i / 12
    ang = math.pi * t
    aparts.append(sphere(f'arch bulb {i}', .17, (-4.5 * math.cos(ang), -16.36, 4.4 + 1.25 * math.sin(ang)), bulb,
                         seg=14, rings=8))
for p in aparts:
    set_parent(p, arch)
finish(arch, aparts, ground=0, strength=.5)
roots.append(arch)

lamp_metal = toy('Lamp Metal', 'navy', 'gloss')
lamp_glow = toy('Lamp Glow', '#ffe08a', 'gloss', emit=7.0)
lamp = empty('RoadLamp', loc=(12, -6, 0))
lparts = [cyl('lamp base', .38, .3, (12, -6, .15), lamp_metal, verts=24, bevel=.08)]
lparts.append(cyl('lamp base trim', .3, .12, (12, -6, .34), toy('Lamp Trim', 'gold', 'metal'), verts=24, bevel=.04))
lparts.append(cyl('lamp pole', .09, 2.5, (12, -6, 1.6), lamp_metal, verts=14, r2=.07))
# A clef-like curl: the pole hooks over and spirals, holding the glowing globe.
curl = []
for i in range(40):
    t = i / 39
    ang = math.pi * 1.6 * t
    r = .55 * (1 - .45 * t)
    curl.append((12 + r * math.sin(ang) * 1.0, -6, 2.85 + r * (1 - math.cos(ang)) * .9 - .0))
lparts.append(tube('lamp curl', curl, .075, lamp_metal, verts=10, radius_fn=lambda t: 1 - .35 * t))
lparts.append(rod('lamp hanger', (12 + .55, -6, 3.2), (12 + .55, -6, 2.9), .03, lamp_metal, verts=8))
lparts.append(sphere('lamp globe', .26, (12 + .55, -6, 2.66), lamp_glow, seg=20, rings=12))
lparts.append(cyl('lamp cap', .17, .12, (12 + .55, -6, 2.93), toy('Lamp Trim', 'gold', 'metal'), verts=20, r2=.08,
                  bevel=.03))
for p in lparts:
    set_parent(p, lamp)
finish(lamp, lparts, ground=0, strength=.45)
roots.append(lamp)

# Reset root placement: runtime clones by name and positions each copy itself.
bpy.context.view_layer.update()
info = export('stage-kit', roots)
print('STAGE KIT', info['bytes'], 'bytes', info['tris'], 'tris')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'encore', 'stage-kit.blend'), compress=True)
