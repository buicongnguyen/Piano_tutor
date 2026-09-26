"""Festive and story props: paper lantern, lantern post, bunting, hot-air balloon and the Stillnote crystal."""
import bpy, bmesh, math, random
from mathutils import Vector
from aaa_kit import TAU, sphere, capsule, from_bmesh, shade, empty
from world_lib import (box, cyl, rod, torus, tube, extrude, M, blob, lathe_fn, paint, place, finish, lerp, note_shape,
                       chunk_rock, flat, cone_roof, disc_shape, outline_star)

HALF_PI = math.pi / 2


def lantern_parts(prefix, top, s=1.0, cap_mat='Paint Navy'):
    """Ribbed paper lantern hanging below `top` (the hook point). Returns world-space parts."""
    x, y, z = top
    L = []
    L.append(torus(f'{prefix} hook', 0.06 * s, 0.018 * s, (x, y, z - 0.06 * s), M('Gold Trim'), maj=8, mn=4,
                   rot=(HALF_PI, 0, 0)))
    L.append(cyl(f'{prefix} cord', 0.02 * s, 0.1 * s, (x, y, z - 0.16 * s), M(cap_mat), verts=5))
    top_z = z - 0.2 * s
    body_h = 0.72 * s
    R = 0.36 * s
    prof = [(0.0, top_z + 0.02 * s), (0.2 * s, top_z + 0.02 * s), (0.25 * s, top_z - 0.06 * s), (0.2 * s, top_z - 0.1 * s),
            (0.0, top_z - 0.1 * s)]
    c1 = lathe_fn(f'{prefix} capt', prof, cap_mat, seg=12, smooth_angle=45)
    c1.location = (x, y, 0)
    L.append(c1)
    rings = []
    for k in range(8):
        t = k / 7
        ang = math.pi * (0.1 + 0.8 * t)
        rings.append((R * math.sin(ang) / math.sin(math.pi * 0.5), top_z - 0.08 * s - body_h * t))
    body = lathe_fn(f'{prefix} body', rings, 'Lantern Glow', seg=16, cap=True, smooth_angle=70,
                    fn=lambda th, i, r, zz: (r * (1 - 0.06 * (0.5 + 0.5 * math.cos(8 * th))), zz))
    body.location = (x, y, 0)
    L.append(body)
    for zz, rr in ((top_z - 0.1 * s, 0.26 * s), (top_z - 0.08 * s - body_h, 0.2 * s)):
        L.append(torus(f'{prefix} ring', rr, 0.025 * s, (x, y, zz), M('Gold Trim'), maj=12, mn=4))
    bz = top_z - 0.08 * s - body_h
    c2 = lathe_fn(f'{prefix} capb', [(0.0, bz + 0.02 * s), (0.2 * s, bz + 0.02 * s), (0.18 * s, bz - 0.08 * s),
                                     (0.0, bz - 0.1 * s)], cap_mat, seg=12, smooth_angle=45)
    c2.location = (x, y, 0)
    L.append(c2)
    L.append(cyl(f'{prefix} tasselcord', 0.02 * s, 0.14 * s, (x, y, bz - 0.17 * s), M('Fabric Red'), verts=5))
    L.append(cyl(f'{prefix} tassel', 0.07 * s, 0.26 * s, (x, y, bz - 0.36 * s), M('Fabric Red'), verts=8,
                 r2=0.02 * s))
    return L


def lantern_paper():
    """Hanging paper lantern; origin at the top hook (the lantern hangs below z=0)."""
    root = empty('Lantern_Paper')
    return finish(root, lantern_parts('lp', (0, 0, 0)), ground=None, ao=0.3, strength=0.5)


def lantern_post():
    """Festival lantern post ~3.6 m: lacquered post, little pagoda cap, crossbar with two paper lanterns."""
    root = empty('Lantern_Post')
    parts = [lathe_fn('lpp base', [(0.0, 0.0), (0.42, 0.0), (0.42, 0.18), (0.32, 0.3), (0.0, 0.3)], 'Stone', seg=8,
                      smooth_angle=50),
             box('lpp post', (0.2, 0.2, 3.0), (0, 0, 1.75), M('Paint Cherry'), bevel=0.04, segments=1),
             box('lpp bar', (1.9, 0.16, 0.16), (0, 0, 2.95), M('Paint Cherry'), bevel=0.04, segments=1),
             box('lpp brace', (0.1, 0.1, 0.62), (0.28, 0, 2.66), M('Paint Cherry'), bevel=0.02, segments=1,
                 rot=(0, 0.75, 0)),
             box('lpp brace2', (0.1, 0.1, 0.62), (-0.28, 0, 2.66), M('Paint Cherry'), bevel=0.02, segments=1,
                 rot=(0, -0.75, 0))]
    for sx in (-1, 1):
        parts.append(sphere('lpp knob', 0.1, (sx * 0.98, 0, 2.95), M('Gold Trim'), seg=8, rings=4))
        parts += lantern_parts(f'lpp l{sx}', (sx * 0.78, 0, 2.87), s=0.9)
    roof = lathe_fn('lpp roof', [(0.0, 3.72), (0.08, 3.68), (0.3, 3.45), (0.52, 3.3), (0.62, 3.3), (0.5, 3.22),
                                  (0.0, 3.24)], 'Roof Teal', seg=4, smooth_angle=30,
                    fn=lambda th, i, r, z: (r, z + (0.07 if i == 4 else 0.0)))
    roof.rotation_euler = (0, 0, math.pi / 4)
    parts += [box('lpp head', (0.3, 0.3, 0.2), (0, 0, 3.2), M('Paint Cherry'), bevel=0.03, segments=1),
              roof, sphere('lpp finial', 0.09, (0, 0, 3.8), M('Gold Trim'), seg=8, rings=4)]
    return finish(root, parts, ao=0.5, strength=0.6)


def bunting():
    """A 6 m string of pennants between two posts at x=+-3 (origin centred between the post feet)."""
    root = empty('Bunting')
    parts = []
    for sx in (-1, 1):
        parts += [cyl('bt post', 0.08, 2.6, (sx * 3.0, 0, 1.3), M('Wood'), verts=8),
                  sphere('bt top', 0.13, (sx * 3.0, 0, 2.66), M('Gold Trim'), seg=8, rings=4),
                  lathe_fn('bt foot', [(0.0, 0.0), (0.22, 0.0), (0.16, 0.14), (0.0, 0.16)], 'Stone', seg=8,
                           smooth_angle=50)]
        parts[-1].location = (sx * 3.0, 0, 0)
    sag, zt = 0.5, 2.48
    pts = [Vector((-3.0 + 6.0 * k / 16, 0, zt - sag * 4 * (k / 16) * (1 - k / 16))) for k in range(17)]
    parts.append(tube('bt rope', pts, 0.025, M('Rope'), verts=4, caps=False))
    cols = ['Fabric Red', 'Fabric Yellow', 'Fabric Blue', 'Fabric Green', 'Fabric Violet', 'Fabric Orange']
    n = 11
    for i in range(n):
        t = (i + 0.5) / n
        x = -3.0 + 6.0 * t
        z = zt - sag * 4 * t * (1 - t)
        slope = -sag * 4 * (1 - 2 * t) / 6.0
        a = math.atan(slope)
        w, h = 0.46, 0.62
        flag = extrude('bt flag', [(-w / 2, 0), (w / 2, 0), (0, -h)], 0.03, M(cols[i % len(cols)]), bevel=0.0)
        flag.rotation_euler = (0.12 * math.sin(i * 1.7), -a, 0)
        flag.location = (x, 0, z - 0.02)
        parts.append(flag)
    return finish(root, parts, ao=0.4, strength=0.5)


def balloon_hot():
    """Hot-air balloon ~9 m; origin at the basket base. Pumpkin-lobed envelope with red/yellow gores."""
    root = empty('Balloon_Hot')
    parts = [box('hb basket', (1.3, 1.3, 0.95), (0, 0, 0.475), M('Wood'), bevel=0.1, segments=2),
             box('hb rim', (1.42, 1.42, 0.16), (0, 0, 0.95), M('Wood Deep'), bevel=0.06, segments=1),
             box('hb band', (1.34, 1.34, 0.1), (0, 0, 0.45), M('Wood Deep'), bevel=0.0),
             cyl('hb burner', 0.2, 0.3, (0, 0, 2.25), M('Brass'), verts=10),
             cyl('hb flame', 0.14, 0.4, (0, 0, 2.55), M('Lantern Glow'), verts=8, r2=0.02)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(rod('hb rope', (sx * 0.6, sy * 0.6, 0.98), (sx * 0.56, sy * 0.56, 2.85), 0.025, M('Rope'),
                             verts=4, cap=False))
    parts.append(rod('hb frame', (-0.56, 0, 2.1), (0.56, 0, 2.1), 0.035, M('Brass'), verts=5))
    gores = 12
    prof = [(0.55, 2.85), (0.75, 3.25), (1.55, 4.05), (2.45, 5.1), (2.95, 6.2), (2.95, 7.1), (2.45, 8.05),
            (1.5, 8.85), (0.5, 9.2), (0.0, 9.28)]

    def lobe(th, i, r, z):
        u = abs(math.cos(gores * th / 2))
        return r * (0.95 + 0.05 * u ** 0.5), z
    env = lathe_fn('hb envelope', prof, 'Fabric Red', seg=36, fn=lobe, cap=False, smooth_angle=60)

    def pick(c, p):
        if c.z > 8.5:
            return 2
        if 6.35 < c.z < 6.95:
            return 3
        a = (math.atan2(c.y, c.x) % TAU) / TAU
        return int(a * gores) % 2
    paint(env, [M('Fabric Red'), M('Fabric Yellow'), M('Fabric Blue'), M('Fabric White')], pick)
    parts += [env,
              lathe_fn('hb skirt', [(0.5, 2.7), (0.58, 2.7), (0.62, 3.0), (0.5, 3.0)], 'Fabric Blue', seg=12,
                       smooth_angle=50, cap=False),
              sphere('hb crown', (0.35, 0.35, 0.12), (0, 0, 9.3), M('Gold Trim'), seg=10, rings=4),
              cyl('hb pole', 0.03, 0.7, (0, 0, 9.65), M('Gold Trim'), verts=5),
              extrude('hb pennant', [(0, 0), (0.8, 0.12), (0, 0.3)], 0.03, M('Fabric Blue'), bevel=0.0,
                      loc=(0.03, 0, 9.7))]
    for i in range(6):  # a garland of little stars around the equator band
        a = TAU * i / 6 + 0.26
        parts.append(disc_shape('hb star', outline_star(5, 0.32, 0.14), 0.05, 'Paint Sunshine',
                                (math.cos(a) * 3.0, math.sin(a) * 3.0, 6.65), (math.cos(a), math.sin(a), 0),
                                bevel=0.0))
    return finish(root, parts, ao=0.9, strength=0.55,
                  grads={'Fabric Red': (2.8, 9.3, (0.8, 0.78, 0.86), (1, 1, 1)),
                         'Fabric Yellow': (2.8, 9.3, (0.8, 0.78, 0.86), (1, 1, 1))})


def crystal_stillnote():
    """A frozen grey-lilac music-note crystal cluster ~2 m: a faceted eighth note wrapped in hexagonal shards."""
    random.seed(151)
    root = empty('Crystal_Stillnote')
    parts = [chunk_rock('cs rock', (0, 0.05, 0), (0.95, 0.8, 0.32), 3, npts=12, bevel=0.06, segments=1),
             chunk_rock('cs rock2', (0.75, 0.35, 0), (0.45, 0.4, 0.22), 4, npts=10, bevel=0.05, segments=1)]
    note = note_shape('cs note', (-0.12, -0.05, 0.62), 1.75, 'Stillnote Crystal', facing=0.15)
    for o in note:
        flat(o)
    parts += note
    shards = [(0.55, -0.25, 0.9, 0.18, 0.5, 0.25), (-0.6, -0.2, 0.75, 0.15, -0.55, -0.1),
              (0.35, 0.45, 1.1, 0.2, 0.35, 0.6), (-0.45, 0.4, 0.65, 0.14, -0.45, 0.45),
              (0.8, 0.1, 0.55, 0.12, 0.7, 0.1), (-0.15, -0.55, 0.5, 0.12, -0.1, -0.6), (0.1, 0.55, 0.7, 0.13, 0.0, 0.5)]
    for i, (x, y, ln, r, tx, ty) in enumerate(shards):
        axis = Vector((tx * 0.9, ty * 0.9, 1.0)).normalized()
        base = Vector((x * 0.7, y * 0.7, 0.12))
        tip = base + axis * ln
        body = rod('cs shard', base, tip, r, M('Stillnote Crystal'), verts=6)
        point = rod('cs tip', tip, tip + axis * r * 1.6, r, M('Stillnote Crystal'), verts=6, r2=0.0)
        for o in (body, point):
            flat(o)
            o.rotation_euler.rotate_axis('Z', i * 0.4)
        parts += [body, point]
    return finish(root, parts, ao=0.5, strength=0.6)


BUILDERS = [
    ('Lantern_Paper', lantern_paper), ('Lantern_Post', lantern_post), ('Bunting', bunting),
    ('Balloon_Hot', balloon_hot), ('Crystal_Stillnote', crystal_stillnote),
]
