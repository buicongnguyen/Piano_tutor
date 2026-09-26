"""Nature props: trees, bush, rock, flower patches, cloud, mountain and the floating island."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise
from aaa_kit import TAU, sphere, capsule, blade, from_bmesh, shade, empty, decimate
from world_lib import (box, cyl, rod, torus, tube, M, blob, clumps, chunk_rock, cap, surface_point, lathe_fn, paint, flower, frond, disc_shape,
                       outline_flower, finish, smoothstep, lerp, clamp01, bounds, place, smin, contour_cut, petal_disc)

LEAF_GRAD = (0.66, 0.76, 0.84), (1.0, 1.0, 0.9)


def _grad(z0, z1, lo=LEAF_GRAD[0], hi=LEAF_GRAD[1]):
    return (z0, z1, lo, hi)


def trunk(prefix, h, r0, r1, mat='Bark', seg=12, flare=1.7, toes=4, seed=0):
    prof = [(0.0, -0.05), (r0 * flare, -0.05), (r0 * flare * 0.9, 0.06), (r0 * 1.2, 0.24), (r0, 0.55),
            (lerp(r0, r1, 0.5), h * 0.55), (r1, h), (0.0, h + 0.05)]
    ob = lathe_fn(f'{prefix} trunk', prof, mat, seg=seg,
                  fn=lambda th, i, r, z: (r * (1 + 0.07 * math.sin(3 * th + z * 2.3 + seed)), z), smooth_angle=70)
    out = [ob]
    for k in range(toes):
        a = TAU * k / toes + 0.4 + seed
        out.append(capsule(f'{prefix} toe', (math.cos(a) * r0 * 0.5, math.sin(a) * r0 * 0.5, 0.3),
                           (math.cos(a) * r0 * 2.1, math.sin(a) * r0 * 2.1, 0.02), r0 * 0.42, M(mat), seg=8,
                           rings=3, r2=r0 * 0.22))
    return out


# ------------------------------------------------------------------ trees

def tree_round():
    random.seed(11)
    root = empty('Tree_Round')
    parts = trunk('trd', 2.5, 0.24, 0.17, seed=0.3)
    parts.append(tube('trd branch', [(0.02, 0, 1.7), (0.35, -0.05, 2.1), (0.62, -0.12, 2.4)], 0.09, M('Bark'),
                      verts=7, radius_fn=lambda t: 1 - 0.5 * t))
    parts += clumps('trd', [
        ('Foliage', [(0, 0, 2.95, 1.12), (0.74, 0.1, 2.66, 0.78), (0.14, -0.72, 2.7, 0.78), (0.36, -0.26, 3.55, 0.82),
                     (-0.44, -0.14, 3.48, 0.76), (0.32, 0.44, 3.42, 0.74)]),
        ('Foliage Deep', [(-0.78, 0.3, 2.62, 0.72), (-0.3, 0.74, 2.66, 0.7), (-0.66, -0.5, 2.48, 0.6),
                          (0.62, 0.58, 2.5, 0.55)], 2)], k=0.2, dec=0.55)
    return finish(root, parts, ao=0.8, grads={'Foliage': _grad(1.7, 4.3), 'Foliage Deep': _grad(1.7, 4.3)})


def _pine_fn(r_top, h, phase, lobes=7, amp=0.1, droop=0.14, extra=0.0):
    def fn(th, i, r, z):
        s = math.sin(lobes * th + phase)
        w = (r / r_top) ** 2
        return r * (1 + amp * s * w) + extra, z - droop * h * max(s, 0) * w
    return fn


def pine_tiers(prefix, tiers, mat='Foliage Deep', snow=False, seg=21):
    objs = []
    for t, (z0, h, r) in enumerate(tiers):
        prof = [(0.0, z0 + h + 0.02), (r * 0.07, z0 + h - 0.015), (r * 0.16, z0 + h * 0.93), (r * 0.45, z0 + h * 0.6),
                (r * 0.8, z0 + h * 0.25),
                (r * 0.99, z0 + h * 0.04), (r * 0.93, z0 - h * 0.1), (r * 0.55, z0 - h * 0.02), (0.0, z0 + h * 0.15)]
        phase = t * 1.3
        objs.append(lathe_fn(f'{prefix} tier', prof, mat, seg=seg, fn=_pine_fn(r, h, phase), smooth_angle=60))
        if snow:
            sp = [(0.0, z0 + h + 0.12), (r * 0.16, z0 + h * 0.96 + 0.1), (r * 0.46, z0 + h * 0.6 + 0.09),
                  (r * 0.76, z0 + h * 0.28 + 0.06), (r * 0.8, z0 + h * 0.19), (r * 0.7, z0 + h * 0.2),
                  (0.0, z0 + h * 0.7)]

            def sfn(th, i, rr, zz, _r=r, _h=h, _ph=phase):
                s = math.sin(7 * th + _ph)
                w = (rr / _r) ** 2
                drip = 0.0
                if i in (3, 4):
                    drip = 0.1 * _h * max(0, math.sin(14 * th + _ph * 2 + 0.6)) ** 3
                return rr * (1 + 0.1 * s * w), zz - 0.14 * _h * max(s, 0) * w - drip
            objs.append(lathe_fn(f'{prefix} snowcap', sp, 'Snow', seg=seg, fn=sfn, smooth_angle=70))
    return objs


def tree_pine():
    root = empty('Tree_Pine')
    parts = trunk('tpn', 1.4, 0.2, 0.15, seed=1.1, toes=3)
    tiers = [(0.85, 1.8, 1.62), (1.75, 1.62, 1.3), (2.62, 1.45, 1.0), (3.42, 1.3, 0.68)]
    parts += pine_tiers('tpn', tiers)
    return finish(root, parts, ao=0.9, grads={'Foliage Deep': _grad(0.6, 4.7)})


def tree_snowpine():
    root = empty('Tree_SnowPine')
    parts = trunk('tsp', 1.4, 0.2, 0.15, seed=2.1, toes=3)
    tiers = [(0.85, 1.8, 1.62), (1.75, 1.62, 1.3), (2.62, 1.45, 1.0), (3.42, 1.3, 0.68)]
    parts += pine_tiers('tsp', tiers, snow=True)
    parts.append(blob('tsp drift', [(0, 0, -0.05, (1.9, 1.7, 0.28)), (1.0, -0.7, -0.05, (0.8, 0.7, 0.26)),
                                    (-1.1, 0.5, -0.05, (0.75, 0.7, 0.22)), (0.4, 1.1, -0.05, (0.6, 0.5, 0.2))],
                      ['Snow'], k=0.3, sub=2, floor=0.0, bump=0.04, stretch=(2.0, 1.8, 0.4), center=(0, 0, 0.02),
                      dec=0.6))
    return finish(root, parts, ao=0.9, grads={'Foliage Deep': _grad(0.6, 4.7, (0.62, 0.72, 0.88), (0.95, 1.0, 1.0)),
                                              'Snow': _grad(0.0, 4.7, (0.84, 0.9, 1.0), (1, 1, 1))})


def tree_blossom():
    random.seed(21)
    root = empty('Tree_Blossom')
    parts = [tube('tbl trunk', [(0, 0, -0.05), (0.05, 0, 0.6), (0.12, 0.02, 1.3), (0.25, 0.05, 1.9), (0.3, 0.06, 2.3)],
                  0.26, M('Bark'), verts=10, radius_fn=lambda t: 1.25 - 0.7 * t if t > 0 else 1.5)]
    for a, b, c in [((0.22, 0.04, 1.7), (-0.5, 0.15, 2.3), (-1.1, 0.25, 2.8)),
                    ((0.28, 0.05, 1.95), (0.8, -0.1, 2.45), (1.2, -0.15, 2.85)),
                    ((0.3, 0.06, 2.2), (0.3, 0.5, 2.8), (0.2, 0.75, 3.1))]:
        parts.append(tube('tbl branch', [a, b, c], 0.12, M('Bark'), verts=7, radius_fn=lambda t: 1 - 0.55 * t))
    for k in range(4):
        ang = TAU * k / 4 + 0.3
        parts.append(capsule('tbl toe', (math.cos(ang) * 0.12, math.sin(ang) * 0.12, 0.3),
                             (math.cos(ang) * 0.55, math.sin(ang) * 0.55, 0.02), 0.12, M('Bark'), seg=8, rings=3,
                             r2=0.06))
    lobes = [(0.1, 0.1, 3.35, 1.25), (-1.25, 0.2, 3.0, 0.95), (1.3, -0.1, 3.05, 0.95), (0.4, 0.95, 3.1, 0.85),
             (-0.3, -0.9, 3.0, 0.85), (0.55, -0.45, 3.9, 0.82), (-0.6, 0.3, 3.85, 0.82), (1.0, 0.6, 3.5, 0.7),
             (-0.9, -0.5, 3.55, 0.7)]
    parts.append(blob('tbl canopy', lobes, ['Blossom'], k=0.22, sub=3, bump=0.05, stretch=(1.3, 1.3, 1.0), dec=0.6))
    for i in range(12):
        ang = random.random() * TAU
        rr = 0.7 + random.random() * 1.5
        parts.append(cyl('tbl petal', 0.09 + random.random() * 0.05, 0.03,
                         (math.cos(ang) * rr, math.sin(ang) * rr, 0.015), M('Blossom'), verts=6,
                         rot=(0, 0, random.random() * TAU)))
    return finish(root, parts, ao=0.8, grads={'Blossom': _grad(2.1, 4.6, (0.78, 0.72, 0.84), (1, 1, 1))})


def tree_maple():
    random.seed(31)
    root = empty('Tree_Maple')
    parts = trunk('tmp', 2.2, 0.26, 0.17, seed=2.4)
    for a, b, c in [((0, 0, 1.6), (-0.55, 0.1, 2.2), (-0.95, 0.15, 2.6)),
                    ((0, 0, 1.8), (0.6, -0.1, 2.35), (0.95, -0.12, 2.75))]:
        parts.append(tube('tmp branch', [a, b, c], 0.11, M('Bark'), verts=7, radius_fn=lambda t: 1 - 0.5 * t))
    parts += clumps('tmp', [
        ('Maple Leaf', [(0, 0, 3.1, 1.2), (1.0, -0.1, 2.85, 0.9), (0.45, 0.2, 3.9, 0.85), (-0.5, -0.3, 3.75, 0.78)]),
        ('Maple Leaf Deep', [(-1.02, 0.25, 2.78, 0.82), (-0.2, 0.9, 2.9, 0.76), (0.85, 0.65, 3.3, 0.6)], 2),
        ('Maple Leaf Gold', [(0.25, -0.88, 2.82, 0.76), (-0.85, -0.62, 3.25, 0.6), (0.1, -0.4, 4.3, 0.55)], 2)],
        k=0.2, bump=0.05, dec=0.6)
    for i in range(12):  # fallen leaves
        ang = random.random() * TAU
        rr = 0.6 + random.random() * 1.4
        m = ['Maple Leaf', 'Maple Leaf Deep', 'Maple Leaf Gold'][i % 3]
        parts.append(cyl('tmp leaf', 0.12 + random.random() * 0.05, 0.03, (math.cos(ang) * rr, math.sin(ang) * rr, 0.015),
                         M(m), verts=5, rot=(0, 0, random.random() * TAU)))
    g = _grad(1.7, 4.6, (0.74, 0.7, 0.78), (1, 1, 0.95))
    return finish(root, parts, ao=0.8, grads={'Maple Leaf': g, 'Maple Leaf Deep': g, 'Maple Leaf Gold': g})


def tree_palm():
    random.seed(41)
    root = empty('Tree_Palm')
    top = Vector((0.95, 0.1, 4.45))
    pts = []
    for i in range(25):
        t = i / 24
        pts.append(Vector((0.95 * t * t + 0.12 * math.sin(math.pi * t), 0.1 * t, 4.45 * t - 0.04)))

    def rfn(t):
        seg = (t * 8) % 1.0
        return (1.0 - 0.38 * t) * (0.86 + 0.16 * seg) * (1.25 if t < 0.03 else 1.0)
    parts = [tube('tpl trunk', pts, 0.27, M('Palm Bark'), verts=8, radius_fn=rfn)]
    parts.append(blob('tpl crown', [(top.x, top.y, top.z + 0.05, 0.36), (top.x + 0.1, top.y, top.z + 0.25, 0.26)],
                      ['Foliage Deep'], k=0.15, sub=2))
    n = 11
    for i in range(n):
        a = TAU * i / n + 0.2
        ln = 2.6 + 0.4 * math.sin(i * 2.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        parts.append(frond('tpl frond', top + Vector((0, 0, 0.15)) + d * 0.1, d, ln, 1.15, 'Foliage', droop=0.5,
                           lift=0.45 + 0.1 * (i % 2), segs=12, serr=0.45, fold=0.16))
    for i in range(3):
        a = TAU * i / 3 + 0.9
        parts.append(frond('tpl sprout', top + Vector((0, 0, 0.25)), Vector((math.cos(a), math.sin(a), 0)), 1.1, 0.55,
                           'Foliage', droop=0.1, lift=0.9, segs=8, serr=0.5, fold=0.12))
    for i in range(3):
        a = TAU * i / 3 + 0.4
        parts.append(sphere('tpl nut', 0.19, top + Vector((math.cos(a) * 0.25, math.sin(a) * 0.25, -0.2)), M('Coconut'),
                            seg=12, rings=7))
    return finish(root, parts, ao=0.8, grads={'Foliage': _grad(2.8, 5.2)})


# ------------------------------------------------------------------ ground cover

def bush():
    random.seed(51)
    root = empty('Bush')
    lobes = [(0, 0, 0.55, 0.62), (0.62, 0.1, 0.42, 0.5), (-0.6, 0.12, 0.44, 0.5), (0.18, -0.45, 0.4, 0.46),
             (-0.2, 0.5, 0.5, 0.46), (0.12, 0.06, 0.98, 0.42), (-0.35, -0.3, 0.72, 0.36)]
    b = blob('bsh body', [l for i, l in enumerate(lobes) if i not in (2, 4)], ['Foliage'], k=0.18, sub=3,
             floor=0.02, bump=0.03, stretch=(1.3, 1.2, 1.0))
    bname = b.name
    b2 = blob('bsh deep', [lobes[2], lobes[4], (-0.3, 0.2, 0.3, 0.45)], ['Foliage Deep'], k=0.18, sub=2, floor=0.02,
              bump=0.03, seed=3)
    parts = [b, b2]
    for i, d in enumerate([(0.3, -1, 0.6), (-0.6, -0.8, 0.5), (0.9, -0.3, 0.55), (-0.1, -0.6, 1.0), (0.5, 0.2, 1.0),
                           (-0.9, 0.2, 0.6)]):
        p, n = surface_point(bname, d)
        parts += flower('bsh fl', p + n * 0.02, n, 0.14, 'Blossom' if i % 2 == 0 else 'Petal White',
                        heart='Petal Sunshine', depth=0.04, pts=3)
    from aaa_kit import decimate as _dec
    _dec(b, 0.55)
    shade(b, 85)
    return finish(root, parts, ao=0.6, grads={'Foliage': _grad(0.0, 1.4), 'Foliage Deep': _grad(0.0, 1.4)})


def rock():
    root = empty('Rock')
    big = chunk_rock('rck big', (0, 0.1, 0), (1.35, 1.05, 1.05), 5, npts=18, bevel=0.14, segments=1)
    parts = [big,
             chunk_rock('rck mid', (1.35, -0.4, 0), (0.66, 0.58, 0.55), 7, npts=14, bevel=0.09, segments=1),
             chunk_rock('rck small', (-1.1, -0.55, 0), (0.45, 0.42, 0.36), 9, npts=12, bevel=0.07, segments=1),
             chunk_rock('rck pebble', (0.55, -1.05, 0), (0.24, 0.22, 0.17), 11, npts=10, bevel=0.05, segments=1)]
    paint(big, [M('Island Rock'), M('Foliage')], lambda c, p: 1 if (p.normal.z > 0.72 and c.z > 0.85) else 0)
    for i, (x, y) in enumerate([(-0.5, -0.95), (1.0, 0.45), (-1.3, 0.3)]):
        for j in range(3):
            a = TAU * j / 3 + i
            parts.append(blade('rck grass', (x, y, 0.0), (math.cos(a) * 0.5, math.sin(a) * 0.5, 1.0), 0.42, 0.13,
                               M('Foliage'), bend=0.3, segs=3))
    return finish(root, parts, ao=0.7, strength=0.8,
                  grads={'Island Rock': (0.0, 2.0, (0.74, 0.76, 0.88), (1, 1, 1))})


def boulder(name, loc, size, seed, sub=2, moss=0, smooth=34):
    return chunk_rock(name, loc, size, seed, npts=14, bevel=min(size) * 0.14)


def _mound(prefix, lobes, mat='Foliage Deep'):
    return blob(f'{prefix} mound', lobes, [mat], k=0.3, sub=2, floor=0.0, stretch=(1.6, 1.3, 0.45),
                center=(0, 0, 0.02), bump=0.03)


def flower_patch():
    random.seed(61)
    root = empty('Flower_Patch')
    parts = [_mound('flp', [(0, 0, 0, (1.0, 0.8, 0.32)), (0.85, 0.2, 0, (0.65, 0.55, 0.26)),
                            (-0.85, 0.15, 0, (0.7, 0.55, 0.28)), (0.2, -0.55, 0, (0.6, 0.45, 0.22))])]
    cols = ['Petal Coral', 'Petal Sunshine', 'Petal Violet', 'Petal White', 'Blossom']
    spots = [(-0.95, -0.2), (-0.5, 0.35), (-0.25, -0.45), (0.15, 0.2), (0.45, -0.35), (0.85, 0.15), (1.2, -0.25),
             (-1.3, 0.2)]
    for i, (x, y) in enumerate(spots):
        hgt = 0.55 + random.random() * 0.4
        nrm = Vector((random.uniform(-0.25, 0.25), -0.55, 1.0))
        head = Vector((x, y, hgt))
        parts += flower('flp fl', head, nrm, 0.25 + random.random() * 0.06, cols[i % len(cols)],
                        stem_to=(x + random.uniform(-.05, .05), y, 0.12), depth=0.06, pts=3)
        a = random.random() * TAU
        parts.append(blade('flp leaf', (x, y, 0.2), (math.cos(a), math.sin(a), 0.6), 0.34, 0.16, M('Foliage'),
                           bend=0.25, segs=4))
    return finish(root, parts, ao=0.5, grads={'Foliage Deep': _grad(0.0, 0.5, (0.7, 0.78, 0.85), (1, 1, 0.95))})


def sunflower(prefix, base, height, lean, face=(0, -1, 0.35)):
    objs = []
    nrm = Vector(face).normalized()
    head = Vector(base) + Vector((lean[0], lean[1], height))
    a = Vector(base)
    objs.append(tube(f'{prefix} stem', [a, a + Vector((lean[0] * 0.2, lean[1] * 0.2, height * 0.45)),
                                        a + Vector((lean[0] * 0.7, lean[1] * 0.7, height * 0.85)), head + nrm * -0.12],
                     0.055, M('Foliage'), verts=7))
    for side, hz in ((-1, 0.4), (1, 0.62)):
        objs.append(blade(f'{prefix} leaf', a + Vector((lean[0] * hz, lean[1] * hz, height * hz)), (side, -0.3, 0.35),
                          0.62, 0.34, M('Foliage'), bend=0.35, segs=6, fold=0.2))
    objs.append(petal_disc(f'{prefix} back', 12, 0.38, 'Foliage Deep', head - nrm * 0.1, nrm, inner=0.72, pts=2,
                           thick=0.14))
    objs.append(petal_disc(f'{prefix} petals2', 13, 0.7, 'Petal Gold', head - nrm * 0.04, nrm, inner=0.4, pts=3,
                           thick=0.05, cup=0.06, spin=0.12))
    objs.append(petal_disc(f'{prefix} petals', 13, 0.61, 'Petal Sunshine', head, nrm, inner=0.42, pts=3, thick=0.07,
                           cup=0.05, spin=0.36))
    q = nrm.to_track_quat('Z', 'Y').to_euler()
    objs.append(sphere(f'{prefix} seeds', (0.29, 0.29, 0.11), head + nrm * 0.045, M('Seed Brown'), seg=14, rings=5,
                       rot=q))
    objs.append(torus(f'{prefix} ring', 0.28, 0.04, head + nrm * 0.05, M('Flower Heart'), maj=14, mn=4, rot=q))
    return objs


def sunflower_patch():
    random.seed(71)
    root = empty('Sunflower_Patch')
    parts = [_mound('sfp', [(0, 0, 0, (1.0, 0.75, 0.3)), (0.8, 0.2, 0, (0.6, 0.5, 0.24)),
                            (-0.8, 0.15, 0, (0.65, 0.5, 0.26))])]
    parts += sunflower('sfa', (0.0, 0.1, 0.15), 2.05, (0.05, -0.1), (0.05, -1, 0.35))
    parts += sunflower('sfb', (-0.75, 0.0, 0.12), 1.55, (-0.15, -0.1), (-0.3, -1, 0.3))
    parts += sunflower('sfc', (0.75, -0.1, 0.12), 1.3, (0.15, -0.12), (0.3, -1, 0.45))
    for i in range(5):
        a = TAU * i / 5 + 0.3
        parts.append(blade('sfp tuft', (math.cos(a) * 0.9, math.sin(a) * 0.5, 0.15), (math.cos(a), math.sin(a), 1.2),
                           0.45, 0.18, M('Foliage'), bend=0.3, segs=4))
    return finish(root, parts, ao=0.55, grads={'Foliage Deep': _grad(0.0, 0.5, (0.7, 0.78, 0.85), (1, 1, 0.95))})


# ------------------------------------------------------------------ sky and terrain

def cloud_puff():
    root = empty('Cloud_Puff')
    lobes = [(0, 0, 0.35, 1.55), (-1.55, 0.1, -0.05, 1.22), (1.65, -0.1, 0.0, 1.28), (-2.75, 0, -0.45, 0.82),
             (2.85, 0.1, -0.4, 0.86), (0.6, 0.2, 1.25, 1.12), (-0.85, -0.1, 0.95, 1.02), (0.2, -0.85, -0.2, 1.05),
             (-0.3, 0.95, -0.15, 1.05), (1.7, 0.4, 0.8, 0.72)]
    b = blob('cld body', lobes, ['Cloud'], k=0.25, sub=4, floor=-0.95, stretch=(2.0, 1.0, 1.0), dec=0.3)
    lo, hi = bounds_obj(b)
    c = (lo + hi) / 2
    b.data.transform(Matrix.Translation(-c))
    return finish(root, [b], ground=None, ao=1.2, strength=0.55, min_ao=0.55,
                  grads={'Cloud': (-1.4, 1.6, (0.8, 0.86, 1.0), (1, 1, 1))})


def bounds_obj(ob):
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def smax(a, b, k):
    return -smin(-a, -b, k)


def mountain():
    """Stylised three-peak mountain: concave flanks, terraced rock bands, grass skirt (Island Top), snow cap."""
    root = empty('Mountain')
    R = 15.0
    NA, NR = 52, 20
    peaks = [((-1.6, 1.2), 23.5, 8.6), ((5.6, 2.2), 17.5, 6.6), ((-7.2, -2.6), 13.0, 5.8), ((2.4, -5.8), 9.5, 5.0),
             ((-3.8, 6.4), 8.0, 4.6)]

    def height(x, y):
        h = -1.0
        for (px, py), H, rad in peaks:
            d = math.hypot(x - px, y - py) / rad
            q = math.sqrt(d * d + 0.02) - math.sqrt(0.02)
            v = H * max(0.0, 1 - q) ** 1.25
            h = smax(h, v, 1.6)
        # broad foothills so the peaks rise out of one massif
        rr = math.hypot(x, y)
        h = smax(h, 6.5 * max(0.0, 1 - rr / 13.0) ** 1.6, 2.0)
        p = Vector((x * 0.12, y * 0.12, 0.5))
        rid = noise.ridged_multi_fractal(p, 1.0, 2.0, 2, 1.0, 2.0)
        h += (rid - 1.0) * 1.0 * smoothstep(2.0, 9.0, h) * (1 - smoothstep(15.0, 20.0, h))
        h += noise.noise(Vector((x * 0.25, y * 0.25, 7))) * 0.5 * smoothstep(0, 5, h)
        tstep = 2.4
        f = (h / tstep) % 1.0
        tq = math.floor(h / tstep) * tstep + tstep * smoothstep(0.6, 0.8, f)
        h = lerp(h, tq, 0.8 * smoothstep(4.0, 6.5, h) * (1 - smoothstep(13.5, 15.5, h)))
        edge = smoothstep(0.84 * R, R, rr)
        return h * (1 - edge) - 0.9 * edge

    bm = bmesh.new()
    rings = []
    center = bm.verts.new((0, 0, height(0, 0)))
    for i in range(1, NR + 1):
        rr = R * (i / NR) ** 1.2
        ring = []
        for j in range(NA):
            th = TAU * j / NA
            wob = 1 + 0.07 * noise.noise(Vector((math.cos(th) * 2, math.sin(th) * 2, 11)))
            x, y = rr * wob * math.cos(th), rr * wob * math.sin(th)
            ring.append(bm.verts.new((x, y, height(x, y))))
        rings.append(ring)
    for j in range(NA):
        bm.faces.new((center, rings[0][j], rings[0][(j + 1) % NA]))
    for a, b in zip(rings, rings[1:]):
        for j in range(NA):
            bm.faces.new((a[j], b[j], b[(j + 1) % NA], a[(j + 1) % NA]))
    SNOW, GRASS = 15.2, 5.0
    snow_warp = lambda x, y: 1.6 * noise.noise(Vector((x * .22, y * .22, 2)))
    grass_warp = lambda x, y: 1.4 * noise.noise(Vector((x * .2, y * .2, 5)))
    contour_cut(bm, SNOW, snow_warp)
    contour_cut(bm, GRASS, grass_warp)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bmesh('mtn body', bm, M('Island Rock'), smooth_angle=42)

    def is_snow(c):
        return c.z + snow_warp(c.x, c.y) > SNOW

    def pick(c, p):
        if is_snow(c):
            return 2
        if c.z + grass_warp(c.x, c.y) < GRASS:
            return 1
        return 0
    paint(ob, [M('Island Rock'), M('Island Top'), M('Snow')], pick)
    # a chunky snow cap sits proud of the rock; grass tufts cling to the wide terrace ledges
    parts = [ob, cap('mtn snowcap', ob, lambda c, f: is_snow(c), 'Snow', thickness=0.4, offset=0.02),
             cap('mtn ledges', ob, lambda c, f: 7.0 < c.z < 14.0 and f.normal.z > 0.9, 'Island Top',
                 thickness=0.25, offset=0.01)]
    return finish(root, parts, ao=4.0, strength=0.6, rays=32,
                  grads={'Island Rock': (-1, 24, (0.76, 0.76, 0.88), (1, 1, 1))})


def island_base():
    """Floating island chunk: flat grass top at z=0 with an icing-like rounded lip, soil band, stepped rock
    underside ~10 m deep with embedded boulders and a few crystals of colour."""
    root = empty('Island_Base')
    R = 11.0
    seg = 48

    def rn(th):
        return R * (1 + 0.035 * math.sin(3 * th + 0.5) + 0.025 * math.sin(7 * th + 1.3))

    prof = [(0.0, 0.0), (0.45, 0.0), (0.78, 0.0), (0.93, 0.0), (0.978, -0.07), (1.0, -0.28), (0.994, -0.5),
            (0.975, -0.68), (0.958, -0.74),  # grass lip (Island Top) ends at ring 8
            (0.952, -0.8), (0.948, -1.25), (0.935, -1.7),  # soil band
            (0.9, -1.8), (0.885, -2.9), (0.79, -3.1), (0.77, -4.3), (0.65, -4.55), (0.62, -5.8), (0.49, -6.05),
            (0.45, -7.1), (0.32, -7.35), (0.24, -8.6), (0.08, -9.8), (0.0, -10.05)]
    prof = [(f * R, z) for f, z in prof]

    def fn(th, i, r, z):
        rr = r * rn(th) / R
        zz = z
        if i in (7, 8):
            drip = max(0.0, math.sin(9 * th + 0.4)) ** 3 * 0.45 + max(0.0, math.sin(23 * th + 1.1)) ** 4 * 0.15
            zz -= drip
            rr -= drip * 0.12
        if i >= 12:
            p = Vector((math.cos(th) * 2.2, math.sin(th) * 2.2, z * 0.22))
            rr *= 1 + 0.1 * noise.noise(p) + 0.04 * noise.noise(p * 3)
            zz += 0.4 * noise.noise(p + Vector((4, 4, 4)))
        return rr, zz
    ob = lathe_fn('isl body', prof, 'Island Top', seg=seg, fn=fn, smooth_angle=40)
    lip = {}

    def pick(c, p):
        # faces from the lathe keep ring order: classify by height relative to the dripping lip
        if c.z > -0.5 or (c.z > -1.2 and p.normal.z > -0.2 and math.hypot(c.x, c.y) > 0.955 * R * 0.99
                           and c.z > -0.9):
            return 0
        if c.z > -1.75:
            return 1
        return 2
    paint(ob, [M('Island Top'), M('Soil'), M('Island Rock')], pick)
    parts = [ob]
    # embedded boulders on the ledges
    for k in range(9):
        th = TAU * k / 9 + 0.35
        lvl = k % 3
        z = [-2.6, -4.2, -5.9][lvl]
        f = [0.87, 0.75, 0.6][lvl]
        rr = rn(th) * f
        parts.append(chunk_rock('isl stone', (math.cos(th) * rr, math.sin(th) * rr, z - 0.3),
                                (1.1, 0.95, 0.8), 20 + k, npts=10, bevel=0.12, segments=1))
    # soil band pebbles/roots read as layered earth
    for k in range(8):
        th = TAU * k / 8 + 0.1
        rr = rn(th) * 0.955
        parts.append(capsule('isl root', (math.cos(th) * rr * 0.99, math.sin(th) * rr * 0.99, -1.0 - (k % 2) * 0.35),
                             (math.cos(th + 0.05) * rr * 1.005, math.sin(th + 0.05) * rr * 1.005,
                              -1.15 - (k % 2) * 0.35), 0.1, M('Wood Deep'), seg=6, rings=2))
    return finish(root, parts, ao=2.5, strength=0.65, rays=36, ground=None,
                  grads={'Island Rock': (-10, -1.5, (0.6, 0.6, 0.78), (1, 1, 1)),
                         'Soil': (-1.8, -0.7, (0.8, 0.74, 0.8), (1, 1, 1))})


BUILDERS = [
    ('Tree_Round', tree_round), ('Tree_Pine', tree_pine), ('Tree_Blossom', tree_blossom),
    ('Tree_Maple', tree_maple), ('Tree_Palm', tree_palm), ('Tree_SnowPine', tree_snowpine), ('Bush', bush),
    ('Rock', rock), ('Flower_Patch', flower_patch), ('Sunflower_Patch', sunflower_patch),
    ('Cloud_Puff', cloud_puff), ('Mountain', mountain), ('Island_Base', island_base),
]
