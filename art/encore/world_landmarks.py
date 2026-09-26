"""Landmarks: music-box Beacon, Windmill, FerrisWheel, Carillon_Tower, Tower_Neon, Tree_Xmas, Snowman, Fountain.

Animated parts sit under pivot empties with identity rest rotation (see CONTRACTS.md):
  Beacon_Spin (Z), Windmill_Blades (Y, blades face -Y), Ferris_Wheel (Y), Carillon_Bell (bell hinge).
The runtime spins Ferris_Wheel continuously without counter-rotating anything, so the gondolas are round
"bubble" cars whose look is invariant under the wheel's rotation (they never hang upside down).
"""
import bpy, bmesh, math, random
from mathutils import Vector
from aaa_kit import TAU, sphere, capsule, from_bmesh, shade, empty
from world_lib import (box, cyl, rod, torus, tube, extrude, M, blob, clumps, lathe_fn, loft, paint, place, window, door, round_window, gable_roof,
                       cone_roof, ring_band, disc_shape, outline_star, outline_flower, frond, finish, smoothstep,
                       lerp, note_shape, petal_disc, quad, disc_y, flat)
from world_nature import pine_tiers

HALF_PI = math.pi / 2


def _band_paint(ob, mats, edges):
    """Paint horizontal bands: edges = ascending z boundaries; band i gets mats[i % len(mats)]."""
    def pick(c, p):
        k = 0
        for e in edges:
            if c.z > e:
                k += 1
        return k % len(mats)
    return paint(ob, [M(m) for m in mats], pick)


# ------------------------------------------------------------------ Beacon

def beacon():
    """Music-box lighthouse ~14 m: lacquered music-box drum with a piano-key band and wind-up key, candy-banded
    tower, gallery, and a lamp room that spins (Beacon_Spin, about Z) around the glowing Beacon Light."""
    root = empty('Beacon')
    parts = []
    dz = 1.3
    drum = lathe_fn('bc drum', [(0.0, 0.0), (3.2, 0.0), (3.34, 0.08), (3.38, 0.2), (3.33, 0.3), (3.36, 0.4),
                                (3.36, 0.92), (3.33, 1.0), (3.38, 1.1), (3.34, 1.22), (3.18, dz), (0.0, dz)],
                    'Paint Cherry', seg=32, smooth_angle=50)

    def drum_pick(c, p):
        if 0.05 < c.z < 0.3 or 1.02 < c.z < 1.25:
            return 1
        if 0.4 < c.z < 0.92 and p.normal.z < 0.5:
            return 2
        return 0
    paint(drum, [M('Paint Cherry'), M('Gold Trim'), M('Trim White')], drum_pick)
    parts.append(drum)
    for i in range(16):
        a = TAU * (i + 0.5) / 16
        if i % 7 in (2, 6):
            continue  # piano grouping gaps (2 + 3 pattern)
        parts.append(box('bc blackkey', (0.24, 0.12, 0.3), (math.cos(a) * 3.4, math.sin(a) * 3.4, 0.76), M('Coal'),
                         bevel=0.0, rot=(0, 0, a + HALF_PI)))
    # wind-up key on the side
    parts += [rod('bc keyshaft', (3.3, 0, 0.7), (4.05, 0, 0.7), 0.1, M('Gold Trim'), verts=8),
              cyl('bc keyhub', 0.2, 0.2, (4.1, 0, 0.7), M('Gold Trim'), verts=10, rot=(0, HALF_PI, 0))]
    for sz in (-1, 1):
        parts.append(sphere('bc keylobe', (0.14, 0.34, 0.42), (4.14, sz * 0.46, 0.7), M('Gold Trim'), seg=12,
                            rings=6))
    # front steps up onto the drum
    for k in range(3):
        parts.append(box('bc step', (1.6 - k * 0.1, 0.5, (k + 1) * dz / 3), (0, -3.25 - (2 - k) * 0.45 + 0.2,
                                                                            (k + 1) * dz / 6), M('Stone'),
                         bevel=0.04, segments=1))
    # banded tower
    z0, z1, r0, r1 = dz, 10.0, 1.95, 1.3
    edges = [lerp(z0, z1, k / 5) for k in range(1, 5)]
    prof = [(r0, z0)] + [(lerp(r0, r1, (e - z0) / (z1 - z0)), e) for e in edges] + [(r1, z1)]
    tw = lathe_fn('bc tower', prof, 'Trim White', seg=32, cap=False, smooth_angle=40)
    _band_paint(tw, ['Paint Cherry', 'Trim White'], edges)
    parts.append(tw)
    for e in edges:
        rr = lerp(r0, r1, (e - z0) / (z1 - z0))
        parts.append(torus('bc bandgold', rr + 0.02, 0.07, (0, 0, e), M('Gold Trim'), maj=24, mn=4))
    parts += place(door('bc door', 0.95, 1.9, paint='Paint Royal', step=False), (0, -r0 + 0.05, dz))
    for k, (z, ang) in enumerate([(3.9, 0.0), (5.7, 0.5), (7.5, 0.0)]):
        rr = lerp(r0, r1, (z - z0) / (z1 - z0))
        parts += place(window(f'bc w{k}', 0.5, 0.72, arch=True, cross=False, sill=False),
                       (rr * math.sin(ang), -rr * math.cos(ang), z), rz=ang)
    # gallery
    gz = z1
    parts += [lathe_fn('bc corbel', [(r1 - 0.05, gz - 0.7), (r1 + 0.25, gz - 0.45), (2.15, gz - 0.12), (2.2, gz),
                                     (2.2, gz + 0.18), (0.0, gz + 0.18)], 'Trim White', seg=32, smooth_angle=45),
              torus('bc rail', 2.1, 0.06, (0, 0, gz + 0.95), M('Gold Trim'), maj=28, mn=4)]
    for i in range(10):
        a = TAU * i / 10
        parts.append(cyl('bc baluster', 0.05, 0.8, (math.cos(a) * 2.1, math.sin(a) * 2.1, gz + 0.56), M('Gold Trim'),
                         verts=5, cap=False))
    # spinning lamp room
    lz = gz + 0.18
    spin = empty('Beacon_Spin', (0, 0, lz), parent=root)
    sp = [lathe_fn('bc glass', [(1.05, lz), (1.05, lz + 1.55)], 'Glass Pane', seg=20, cap=False),
          lathe_fn('bc lampbase', [(0.0, lz), (1.2, lz), (1.2, lz + 0.22), (0.0, lz + 0.22)], 'Paint Navy', seg=20,
                   smooth_angle=40),
          sphere('bc core', 0.42, (0, 0, lz + 0.85), M('Beacon Light'), seg=14, rings=8)]
    for sx in (-1, 1):  # Fresnel lenses make the rotation readable
        sp.append(sphere('bc lens', (0.14, 0.55, 0.55), (sx * 0.55, 0, lz + 0.85), M('Beacon Light'), seg=12,
                         rings=6))
        sp.append(torus('bc lensring', 0.56, 0.05, (sx * 0.62, 0, lz + 0.85), M('Gold Trim'), maj=16, mn=4,
                        rot=(0, HALF_PI, 0)))
    for i in range(6):
        a = TAU * i / 6 + TAU / 12
        sp.append(box('bc mullion', (0.1, 0.1, 1.55), (math.cos(a) * 1.06, math.sin(a) * 1.06, lz + 0.78),
                      M('Trim White'), bevel=0.0, rot=(0, 0, a)))
    rz0 = lz + 1.55
    sp += [lathe_fn('bc dome', [(0.0, rz0 + 1.25), (0.35, rz0 + 1.18), (0.85, rz0 + 0.85), (1.22, rz0 + 0.35),
                                (1.36, rz0 + 0.05), (1.3, rz0 - 0.05), (0.0, rz0 - 0.05)], 'Paint Cherry', seg=24,
                    smooth_angle=50),
           torus('bc domering', 1.33, 0.07, (0, 0, rz0 + 0.02), M('Gold Trim'), maj=24, mn=4),
           sphere('bc ball', 0.22, (0, 0, rz0 + 1.35), M('Gold Trim'), seg=10, rings=5),
           cyl('bc spire', 0.05, 0.5, (0, 0, rz0 + 1.7), M('Gold Trim'), verts=6)]
    sp += note_shape('bc note', (-0.12, 0, rz0 + 2.25), 1.15, 'Gold Trim')
    return finish(root, parts, pivots=[(spin, sp)], ao=1.2, strength=0.6)


# ------------------------------------------------------------------ Windmill

def windmill():
    """Dawn Meadow windmill ~12 m: stone foot, cream tower with a wooden gallery, red cap; the sails turn about
    Blender Y (Windmill_Blades, front faces -Y)."""
    root = empty('Windmill')
    parts = [lathe_fn('wm plinth', [(0.0, 0.0), (2.75, 0.0), (2.75, 0.4), (2.6, 0.5), (0.0, 0.5)], 'Stone', seg=24,
                      smooth_angle=40)]
    tw = lathe_fn('wm tower', [(2.35, 0.5), (2.2, 2.3), (1.98, 4.6), (1.7, 7.0)], 'Wall Cream', seg=24, cap=False,
                  smooth_angle=40)
    _band_paint(tw, ['Stone', 'Wall Cream'], [2.3])
    parts.append(tw)
    parts.append(ring_band('wm band', 2.2, 2.35, 0.18, 'Wood', seg=24, thick=0.08))
    # gallery deck with railing
    gz = 3.3
    parts += [lathe_fn('wm deck', [(1.9, gz - 0.12), (3.05, gz - 0.12), (3.05, gz + 0.08), (1.9, gz + 0.08)], 'Wood',
                       seg=24, smooth_angle=40),
              torus('wm rail', 3.0, 0.05, (0, 0, gz + 0.85), M('Wood Deep'), maj=24, mn=4)]
    for i in range(10):
        a = TAU * i / 10
        parts.append(cyl('wm post', 0.05, 0.8, (math.cos(a) * 3.0, math.sin(a) * 3.0, gz + 0.48), M('Wood Deep'),
                         verts=5, cap=False))
        parts.append(rod('wm strut', (math.cos(a) * 2.05, math.sin(a) * 2.05, gz - 0.9),
                         (math.cos(a) * 2.9, math.sin(a) * 2.9, gz - 0.1), 0.05, M('Wood Deep'), verts=4, cap=False))
    parts += place(door('wm door', 0.95, 1.85, paint='Roof Red', step=False), (0, -2.3, 0.5))
    parts.append(box('wm step', (1.5, 0.5, 0.5), (0, -2.75, 0.25), M('Stone'), bevel=0.04, segments=1))
    for k, (z, a) in enumerate([(4.5, 0.0), (5.6, 1.1), (5.6, -1.1)]):
        rr = lerp(2.2, 1.7, (z - 2.3) / 4.7)
        parts += place(window(f'wm w{k}', 0.55, 0.75, arch=True, cross=False, shutters='Roof Red' if k == 0 else None,
                              flowers=['Petal Coral', 'Petal Sunshine'] if k == 0 else None, sill=k == 0),
                       (rr * math.sin(a), -rr * math.cos(a), z), rz=a)
    # cap
    parts += [ring_band('wm capring', 1.72, 7.02, 0.2, 'Wood', seg=24, thick=0.12),
              cone_roof('wm cap', 2.25, 7.0, 9.9, 'Roof Red', rows=4, step=0.12, thk=0.2, seg=24, curve=0.75,
                        tip=0.08, mid=False),
              sphere('wm ball', 0.2, (0, 0, 10.05), M('Gold Trim'), seg=10, rings=5),
              cyl('wm vane', 0.04, 0.8, (0, 0, 10.5), M('Gold Trim'), verts=5),
              extrude('wm vaneflag', [(0, 0), (0.6, 0.08), (0.6, 0.3), (0, 0.38)], 0.04, M('Gold Trim'), bevel=0.01,
                      loc=(0.03, 0, 10.45))]
    # fantail at the back
    parts.append(rod('wm tailbeam', (0, 1.7, 7.4), (0, 3.0, 5.6), 0.07, M('Wood Deep'), verts=5))
    # sails
    hz, hy = 7.55, -3.25  # sail plane sits in front of the gallery so the sweep never clips the railing
    pv = empty('Windmill_Blades', (0, hy, hz), parent=root)
    bl = [rod('wm axle', (0, -1.3, hz), (0, hy - 0.1, hz), 0.2, M('Wood Deep'), verts=10),
          cyl('wm hub', 0.42, 0.45, (0, hy - 0.25, hz), M('Wood Deep'), verts=12, rot=(HALF_PI, 0, 0), bevel=0.06),
          sphere('wm hubcap', (0.32, 0.25, 0.32), (0, hy - 0.5, hz), M('Gold Trim'), seg=12, rings=6)]
    L = 4.7
    for k in range(4):
        a = TAU * k / 4 + TAU / 8
        d = Vector((math.cos(a), 0, math.sin(a)))
        side = Vector((-math.sin(a), 0, math.cos(a)))
        o = Vector((0, hy - 0.32, hz))
        bl.append(box('wm spar', (L, 0.14, 0.16), o + d * (L / 2 + 0.2), M('Wood'), bevel=0.03, segments=1,
                      rot=(0, -a, 0)))
        w0, w1 = 0.25, 1.15
        cloth = 'Fabric White' if k % 2 == 0 else 'Fabric Red'
        ctr = o + d * (L * 0.58 + 0.2) + side * (w0 + w1) / 2 + Vector((0, -0.04, 0))
        bl.append(box('wm cloth', (L * 0.72, 0.05, w1 - w0), ctr, M(cloth), bevel=0.02, segments=1, rot=(0, -a, 0)))
        bl.append(box('wm rail', (L * 0.74, 0.08, 0.08), o + d * (L * 0.58 + 0.2) + side * (w1 + 0.03)
                      + Vector((0, -0.07, 0)), M('Wood'), bevel=0.0, rot=(0, -a, 0)))
        for t in (0.26, 0.5, 0.74, 0.96):
            bl.append(box('wm bar', (0.07, 0.07, w1 + 0.06), o + d * (L * t + 0.2) + side * (w1 / 2 + 0.02)
                          + Vector((0, -0.1, 0)), M('Wood'), bevel=0.0, rot=(0, -a, 0)))
    return finish(root, parts, pivots=[(pv, bl)], ao=1.0, strength=0.6,
                  grads={'Wall Cream': (0.5, 7.0, (0.9, 0.88, 0.9), (1, 1, 1))})


# ------------------------------------------------------------------ FerrisWheel

def ferris_wheel():
    """Carnival wheel ~13.5 m. Ferris_Wheel rotates about Y and carries eight bubble gondolas."""
    root = empty('FerrisWheel')
    C = Vector((0, 0, 7.2))  # bubble cars clear the platform all the way round (lowest point ~0.5 m)
    R = 5.0
    parts = [box('fw base', (8.6, 4.0, 0.3), (0, 0, 0.15), M('Stone'), bevel=0.08, segments=2),
             box('fw step', (2.4, 0.6, 0.18), (0, -2.25, 0.09), M('Stone'), bevel=0.04, segments=1)]
    for sy in (-1, 1):
        for sx in (-1, 1):
            parts.append(rod('fw leg', (sx * 3.5, sy * 1.25, 0.3), (sx * 0.25, sy * 0.72, C.z), 0.2, M('Paint Royal'),
                             verts=8))
            parts.append(sphere('fw foot', (0.4, 0.4, 0.2), (sx * 3.5, sy * 1.25, 0.36), M('Paint Royal'), seg=10,
                                rings=4))
        parts.append(rod('fw brace', (-2.4, sy * 1.07, 2.5), (2.4, sy * 1.07, 2.5), 0.1, M('Trim White'), verts=6))
    parts.append(rod('fw axle', (0, -1.0, C.z), (0, 1.0, C.z), 0.2, M('Gold Trim'), verts=10))
    # ticket booth
    parts += [box('fw booth', (1.2, 1.0, 1.5), (-3.2, -2.6, 0.75), M('Paint Sunshine'), bevel=0.06, segments=1),
              quad('fw boothwin', 0.8, 0.5, 'Window Glow', loc=(-3.2, -3.11, 1.05)),
              cone_roof('fw boothroof', 0.95, 1.5, 2.3, 'Roof Red', rows=2, step=0.06, thk=0.1, seg=12)]
    parts[-1].location = (-3.2, -2.6, 0)
    wheel = empty('Ferris_Wheel', tuple(C), parent=root)
    wp = []
    for sy in (-0.48, 0.48):
        wp.append(torus('fw rim', R, 0.14, C + Vector((0, sy, 0)), M('Paint Coral'), maj=40, mn=4,
                        rot=(HALF_PI, 0, 0)))
        wp.append(torus('fw inner', 3.0, 0.08, C + Vector((0, sy, 0)), M('Paint Coral'), maj=24, mn=4,
                        rot=(HALF_PI, 0, 0)))
    ns = 12
    for i in range(ns):
        a = TAU * i / ns
        d = Vector((math.cos(a), 0, math.sin(a)))
        for sy in (-0.48, 0.48):
            wp.append(rod('fw spoke', C + Vector((0, sy * 0.6, 0)) + d * 0.5, C + Vector((0, sy, 0)) + d * R, 0.055,
                          M('Trim White'), verts=4, cap=False))
        wp.append(rod('fw cross', C + d * R + Vector((0, -0.48, 0)), C + d * R + Vector((0, 0.48, 0)), 0.06,
                      M('Trim White'), verts=4, cap=False))
    for i in range(24):  # bulbs: front rim all round, back rim and inner ring every other
        a = TAU * (i + 0.5) / 24
        d = Vector((math.cos(a), 0, math.sin(a)))
        wp.append(sphere('fw bulb', 0.13, C + d * R + Vector((0, -0.64, 0)), M('Ferris Bulb Glow'), seg=5, rings=3))
        if i % 2 == 0:
            wp.append(sphere('fw bulbb', 0.13, C + d * R + Vector((0, 0.64, 0)), M('Ferris Bulb Glow'), seg=5,
                             rings=3))
        if i % 3 == 1:
            wp.append(sphere('fw bulbi', 0.1, C + d * 3.0 + Vector((0, -0.58, 0)), M('Ferris Bulb Glow'), seg=5,
                             rings=3))
    wp += [cyl('fw hub', 0.62, 1.3, C, M('Gold Trim'), verts=14, rot=(HALF_PI, 0, 0), bevel=0.08),
           disc_shape('fw star', outline_star(5, 0.55, 0.26), 0.1, 'Paint Sunshine', C + Vector((0, -0.72, 0)),
                      (0, -1, 0), bevel=0.02)]
    cars = ['Paint Sky', 'Paint Sunshine', 'Paint Lime', 'Paint Violet']
    for i in range(8):
        a = TAU * i / 8 + TAU / 16
        d = Vector((math.cos(a), 0, math.sin(a)))
        rim = C + d * R
        P = C + d * (R + 0.95)
        wp += [rod('fw strut', rim + Vector((0, -0.4, 0)), P - d * 0.5, 0.07, M('Trim White'), verts=5),
               rod('fw strut2', rim + Vector((0, 0.4, 0)), P - d * 0.5, 0.07, M('Trim White'), verts=5),
               sphere('fw car', 0.74, P, M(cars[i % 4]), seg=12, rings=7),
               torus('fw carband', 0.75, 0.07, P, M('Trim White'), maj=12, mn=4, rot=(HALF_PI, 0, 0)),
               disc_y('fw carwin', 0.42, 'Window Glow', loc=P + Vector((0, -0.66, 0)), verts=10),
               torus('fw carring', 0.44, 0.05, P + Vector((0, -0.64, 0)), M('Trim White'), maj=10, mn=4,
                     rot=(HALF_PI, 0, 0))]
        back = disc_y('fw carwinb', 0.42, 'Window Glow', verts=10)
        back.rotation_euler = (0, 0, math.pi)
        back.location = P + Vector((0, 0.66, 0))
        wp.append(back)
    pivots = [(wheel, wp)]
    return finish(root, parts, pivots=pivots, ao=1.0, strength=0.55)


# ------------------------------------------------------------------ Carillon_Tower

def carillon_tower():
    """The Hush's cloud-castle bell tower ~22 m (finale). Carillon_Bell is the bell's hinge at the yoke."""
    random.seed(121)
    root = empty('Carillon_Tower')
    parts = []
    parts.append(blob('ct cloud', [(0, 0, 0.5, 2.9), (2.9, 0.6, 0.35, 1.8), (-2.9, 0.4, 0.4, 1.9), (0.6, -2.8, 0.3, 1.7),
                                   (-1.0, 2.9, 0.3, 1.7), (2.2, -2.2, 0.2, 1.4), (-2.3, -2.0, 0.25, 1.5),
                                   (2.4, 2.3, 0.2, 1.4)], ['Cloud'], k=0.5, sub=3, floor=0.0, stretch=(1.6, 1.6, 0.8),
                      center=(0, 0, 0.6), dec=0.5))
    parts.append(lathe_fn('ct plinth', [(0.0, 0.0), (3.3, 0.0), (3.3, 2.5), (3.45, 2.6), (3.45, 2.85), (0.0, 2.85)],
                          'Stone', seg=32, smooth_angle=40))
    for i in range(10):
        a = TAU * (i + 0.5) / 10
        parts.append(box('ct merlon', (0.62, 0.42, 0.55), (math.cos(a) * 3.25, math.sin(a) * 3.25, 3.1), M('Stone'),
                         bevel=0.0, rot=(0, 0, a + HALF_PI)))
    parts += place(door('ct door', 1.2, 2.2, paint='Roof Blue', step=False), (0, -3.3, 0.0))
    # shaft
    z0, z1, R = 2.85, 13.0, 2.35
    parts.append(lathe_fn('ct shaft', [(R + 0.05, z0), (R, z1 - 0.3), (R + 0.1, z1)], 'Wall Cream', seg=32, cap=False,
                          smooth_angle=40))
    parts += [ring_band('ct band1', R, 7.0, 0.22, 'Gold Trim', seg=32, thick=0.08),
              ring_band('ct band2', R, z1 - 0.1, 0.36, 'Trim White', seg=32, thick=0.14)]
    for k, (z, a) in enumerate([(5.0, 0.0), (8.6, 0.0), (6.2, 1.25), (6.2, -1.25)]):
        parts += place(window(f'ct w{k}', 0.7, 1.2, arch=True, cross=False, sill=k < 2),
                       (R * math.sin(a), -R * math.cos(a), z), rz=a)
    for sx in (-1, 1):  # hanging banners
        parts.append(rod('ct bannerrod', (sx * 1.25 - 0.45, -R - 0.12, 10.1), (sx * 1.25 + 0.45, -R - 0.12, 10.1), 0.04,
                         M('Gold Trim'), verts=5))
        parts.append(extrude('ct banner', [(-0.4, 0), (0.4, 0), (0.4, -1.6), (0, -1.25), (-0.4, -1.6)], 0.05,
                             M('Fabric Pink'), bevel=0.012, segments=1, loc=(sx * 1.25, -R - 0.1, 10.08)))
    # clock
    cz = 11.2
    parts += [disc_y('ct clock', 0.95, 'Trim White', loc=(0, -R - 0.08, cz), verts=20),
              torus('ct clockring', 1.0, 0.09, (0, -R - 0.1, cz), M('Gold Trim'), maj=20, mn=4,
                    rot=(HALF_PI, 0, 0)),
              box('ct hand1', (0.08, 0.05, 0.62), (0, -R - 0.12, cz + 0.28), M('Coal'), bevel=0.0),
              box('ct hand2', (0.46, 0.05, 0.08), (0.2, -R - 0.13, cz), M('Coal'), bevel=0.0)]
    for i in range(4):
        a = TAU * i / 4
        parts.append(sphere('ct tick', 0.08, (math.cos(a) * 0.75, -R - 0.12, cz + math.sin(a) * 0.75),
                            M('Gold Trim'), seg=6, rings=3))
    # corner turrets on the plinth
    for i in range(4):
        a = TAU * i / 4 + TAU / 8
        x, y = math.cos(a) * 3.0, math.sin(a) * 3.0
        t = lathe_fn('ct turret', [(0.0, 2.8), (0.62, 2.8), (0.62, 5.1), (0.72, 5.25), (0.0, 5.25)], 'Wall Cream',
                     seg=12, smooth_angle=40)
        t.location = (x, y, 0)
        r = lathe_fn('ct turretroof', [(0.0, 7.25), (0.12, 7.05), (0.5, 6.0), (0.8, 5.35), (0.9, 5.2), (0.62, 5.15),
                                       (0.0, 5.3)], 'Roof Blue', seg=12, smooth_angle=50)
        r.location = (x, y, 0)
        parts += [t, r, sphere('ct tball', 0.14, (x, y, 7.4), M('Gold Trim'), seg=8, rings=4),
                  quad('ct tslit', 0.22, 0.55, 'Window Glow', loc=(x * 0.8, y * 0.8 - 0.62 * 0.0, 4.2),
                       rz=math.atan2(y, x) + HALF_PI)]
        parts[-1].location = (x + math.cos(a) * 0.63, y + math.sin(a) * 0.63, 4.2)
    # open belfry: four pillars and arches around the swinging bell
    bz0, bz1 = z1 + 0.2, 17.0
    parts.append(lathe_fn('ct belfloor', [(0.0, z1), (2.55, z1), (2.55, bz0), (0.0, bz0)], 'Stone', seg=32,
                          smooth_angle=40))
    for i in range(4):
        a = TAU * i / 4 + TAU / 8
        x, y = math.cos(a) * 2.05, math.sin(a) * 2.05
        parts.append(cyl('ct pillar', 0.34, bz1 - bz0, (x, y, (bz0 + bz1) / 2 - 0.5), M('Wall Cream'), verts=8))
        m = a + TAU / 8
        mx, my = math.cos(m) * 2.05 * 0.72, math.sin(m) * 2.05 * 0.72
        parts.append(torus('ct arch', 1.45, 0.2, (mx, my, bz1 - 1.45), M('Wall Cream'), maj=12, mn=4,
                           rot=(HALF_PI, 0, m + HALF_PI), arc=0.5))
    parts += [lathe_fn('ct cornice', [(0.0, bz1 - 0.5), (2.6, bz1 - 0.5), (2.75, bz1 - 0.2), (2.75, bz1 + 0.15),
                                      (0.0, bz1 + 0.15)], 'Trim White', seg=32, smooth_angle=40),
              torus('ct cornicegold', 2.76, 0.07, (0, 0, bz1 - 0.08), M('Gold Trim'), maj=32, mn=4),
              cone_roof('ct roof', 3.1, bz1 + 0.12, 22.0, 'Roof Blue', rows=5, step=0.13, thk=0.2, seg=28, curve=1.35,
                        tip=0.08, mid=False),
              sphere('ct ball', 0.26, (0, 0, 22.2), M('Gold Trim'), seg=10, rings=5),
              cyl('ct spire', 0.06, 1.2, (0, 0, 22.9), M('Gold Trim'), verts=6),
              extrude('ct flag', [(0, 0), (1.3, -0.12), (1.1, 0.25), (1.35, 0.55), (0, 0.5)], 0.05, M('Fabric Pink'),
                      bevel=0.015, segments=1, loc=(0.06, 0, 23.0))]
    # the bell
    hinge = Vector((0, 0, bz1 - 0.75))
    bell = empty('Carillon_Bell', tuple(hinge), parent=root)
    bp = [box('ct yoke', (1.9, 0.3, 0.3), hinge, M('Wood Deep'), bevel=0.05, segments=1),
          lathe_fn('ct bell', [(0.0, hinge.z - 0.05), (0.35, hinge.z - 0.1), (0.55, hinge.z - 0.35),
                               (0.62, hinge.z - 0.8), (0.72, hinge.z - 1.2), (1.02, hinge.z - 1.55),
                               (1.08, hinge.z - 1.7), (0.92, hinge.z - 1.66), (0.6, hinge.z - 1.45), (0.0, hinge.z - 1.4)],
                   'Gold Trim', seg=20, smooth_angle=60),
          sphere('ct clapper', 0.2, (0, 0, hinge.z - 1.72), M('Brass'), seg=10, rings=5),
          torus('ct bellrib', 1.0, 0.05, (0, 0, hinge.z - 1.5), M('Brass'), maj=20, mn=4)]
    return finish(root, parts, pivots=[(bell, bp)], ao=1.3, strength=0.6,
                  grads={'Cloud': (0, 2.5, (0.82, 0.86, 1.0), (1, 1, 1)),
                         'Wall Cream': (2.8, 17, (0.9, 0.88, 0.9), (1, 1, 1))})


# ------------------------------------------------------------------ Tower_Neon

def tower_neon():
    """Neon Reef synth tower ~19 m: a navy plinth, a violet block wearing an equaliser sign, two violet drums
    ringed with pink/cyan neon, a neon note, and a saucer crown with a glowing antenna."""
    root = empty('Tower_Neon')
    parts = [box('tn plinth', (5.4, 5.4, 2.4), (0, 0, 1.2), M('Paint Navy'), bevel=0.16, segments=2),
             box('tn basetrim', (5.62, 5.62, 0.12), (0, 0, 2.28), M('Neon Glow Cyan'), bevel=0.0),
             box('tn door', (1.4, 0.1, 1.8), (0, -2.72, 0.9), M('Window Glow'), bevel=0.0),
             box('tn doorframe', (1.7, 0.14, 0.14), (0, -2.74, 1.86), M('Neon Glow'), bevel=0.0)]
    # block 1 with the equaliser sign
    z1 = 2.4
    parts += [box('tn block1', (4.3, 4.3, 4.8), (0, 0, z1 + 2.4), M('Paint Violet'), bevel=0.3, segments=2),
              box('tn cornice1', (4.6, 4.6, 0.3), (0, 0, z1 + 4.9), M('Paint Navy'), bevel=0.08, segments=1)]
    for sx in (-1, 1):
        for zz in (z1 + 1.4, z1 + 3.0):
            parts.append(box('tn wins', (0.06, 3.0, 0.36), (sx * 2.16, 0, zz), M('Window Glow'), bevel=0.0))
    heights = [0.8, 1.5, 2.3, 3.0, 2.1, 1.3, 2.6]
    for i, hh in enumerate(heights):
        parts.append(box('tn eq', (0.34, 0.12, hh), (-1.5 + 0.5 * i, -2.2, z1 + 0.8 + hh / 2),
                         M('Neon Glow Cyan' if i % 2 else 'Neon Glow'), bevel=0.03, segments=1))
    # two drums ringed with neon
    z2 = z1 + 5.05
    for k, (r, h) in enumerate(((1.95, 4.0), (1.45, 3.0))):
        zb = z2 if k == 0 else z2 + 4.2
        parts.append(lathe_fn(f'tn drum{k}', [(0.0, zb), (r - 0.1, zb), (r, zb + 0.12), (r, zb + h - 0.12),
                                              (r - 0.1, zb + h), (0.0, zb + h)], 'Paint Violet', seg=28,
                              smooth_angle=50))
        parts.append(lathe_fn(f'tn wband{k}', [(r + 0.02, zb + h * 0.42), (r + 0.02, zb + h * 0.62)], 'Window Glow',
                              seg=28, cap=False))
        for j, zz in enumerate((zb + 0.2, zb + h - 0.2)):
            parts.append(torus(f'tn ring{k}', r + 0.06, 0.08, (0, 0, zz), M('Neon Glow' if (j + k) % 2 else 'Neon Glow Cyan'),
                               maj=28, mn=4))
        parts.append(lathe_fn(f'tn collar{k}', [(0.0, zb + h), (r + 0.25, zb + h), (r + 0.25, zb + h + 0.2),
                                                (0.0, zb + h + 0.2)], 'Paint Navy', seg=28, smooth_angle=40))
    parts += note_shape('tn note', (0.25, -2.12, z2 + 1.3), 2.1, 'Neon Glow')
    # crown: saucer ring, antenna, beacon ball
    top = z2 + 4.2 + 3.2
    parts += [lathe_fn('tn saucer', [(0.0, top), (1.9, top + 0.1), (2.2, top + 0.35), (1.9, top + 0.55),
                                     (0.0, top + 0.6)], 'Paint Navy', seg=24, smooth_angle=50),
              torus('tn ring', 2.2, 0.1, (0, 0, top + 0.35), M('Neon Glow'), maj=24, mn=4),
              cyl('tn mast', 0.12, 3.0, (0, 0, top + 2.0), M('Paint Navy'), verts=8),
              torus('tn halo', 0.7, 0.07, (0, 0, top + 2.4), M('Neon Glow Cyan'), maj=16, mn=4),
              torus('tn halo2', 0.45, 0.06, (0, 0, top + 3.0), M('Neon Glow'), maj=12, mn=4),
              sphere('tn tip', 0.24, (0, 0, top + 3.6), M('Neon Glow Cyan'), seg=10, rings=5)]
    return finish(root, parts, ao=1.1, strength=0.6)


# ------------------------------------------------------------------ Tree_Xmas

def tree_xmas():
    random.seed(131)
    root = empty('Tree_Xmas')
    parts = [lathe_fn('tx tub', [(0.0, 0.0), (0.62, 0.0), (0.75, 0.7), (0.8, 0.78), (0.0, 0.78)], 'Paint Cherry', seg=16,
                      smooth_angle=40),
             ring_band('tx tubrim', 0.78, 0.72, 0.14, 'Gold Trim', seg=16, thick=0.05),
             cyl('tx trunk', 0.16, 0.8, (0, 0, 0.9), M('Bark'), verts=8)]
    tiers = [(1.0, 1.7, 1.55), (1.9, 1.5, 1.22), (2.75, 1.35, 0.92), (3.5, 1.2, 0.62)]
    parts += pine_tiers('tx', tiers)
    # spiral garland with light bulbs
    pts = []
    turns = 3.2
    n = 40
    for i in range(n + 1):
        t = i / n
        z = 1.25 + t * 3.1
        rr = lerp(1.42, 0.3, t) + 0.06
        a = TAU * turns * t
        pts.append(Vector((math.cos(a) * rr, math.sin(a) * rr, z - 0.08 * math.sin(a * 2))))
    parts.append(tube('tx garland', pts, 0.05, M('Gold Trim'), verts=4, caps=False))
    for i in range(2, n, 2):
        p = pts[i]
        parts.append(sphere('tx bulb', 0.1, p + Vector((0, 0, -0.1)), M('Xmas Light Glow'), seg=6, rings=3))
    cols = ['Paint Cherry', 'Paint Sky', 'Gold Trim', 'Paint Violet']
    for i in range(12):
        t = (i + 0.5) / 12
        z0, h, r = tiers[min(3, int(t * 4))]
        a = i * 2.4 + 0.3
        rr = r * 0.86
        parts.append(sphere('tx bauble', 0.14, (math.cos(a) * rr, math.sin(a) * rr, z0 + 0.12), M(cols[i % 4]), seg=8,
                            rings=4))
    parts.append(disc_shape('tx star', outline_star(5, 0.48, 0.21), 0.16, 'Star Glow', (0, -0.02, 4.95), (0, -1, 0),
                            bevel=0.03))
    parts.append(sphere('tx starball', 0.1, (0, 0, 4.62), M('Gold Trim'), seg=8, rings=4))
    for i, (x, y, s, m, rb) in enumerate([(-1.1, -0.9, 0.55, 'Paint Sky', 'Fabric Red'),
                                          (1.05, -0.8, 0.48, 'Paint Lime', 'Fabric Yellow'),
                                          (0.3, -1.25, 0.4, 'Paint Violet', 'Gold Trim')]):
        rot = (0, 0, 0.3 * (i - 1))
        g = [box('tx gift', (s, s, s * 0.85), (0, 0, s * 0.425), M(m), bevel=0.03, segments=1),
             box('tx ribbon1', (s + 0.02, 0.1, s * 0.85 + 0.02), (0, 0, s * 0.425), M(rb), bevel=0.0),
             box('tx ribbon2', (0.1, s + 0.02, s * 0.85 + 0.02), (0, 0, s * 0.425), M(rb), bevel=0.0),
             sphere('tx bow', (0.14, 0.08, 0.1), (-0.09, 0, s * 0.85 + 0.06), M(rb), seg=8, rings=4, rot=(0, 0.5, 0)),
             sphere('tx bow2', (0.14, 0.08, 0.1), (0.09, 0, s * 0.85 + 0.06), M(rb), seg=8, rings=4, rot=(0, -0.5, 0))]
        parts += place(g, (x, y, 0), rz=rot[2])
    return finish(root, parts, ao=0.8, strength=0.65,
                  grads={'Foliage Deep': (0.8, 5.0, (0.62, 0.72, 0.8), (0.95, 1, 0.92))})


# ------------------------------------------------------------------ Snowman

def snowman():
    root = empty('Snowman')
    parts = [blob('sm drift', [(0, 0, -0.05, (1.2, 1.05, 0.25)), (0.6, -0.4, -0.05, (0.6, 0.5, 0.2))], ['Snow'], k=0.3,
                  sub=2, floor=0.0, stretch=(1.6, 1.4, 0.4), center=(0, 0, 0.02), dec=0.5)]
    balls = [(0.0, 0.72, 0.78), (0.0, 1.78, 0.56), (0.0, 2.55, 0.42)]
    for i, (x, z, r) in enumerate(balls):
        parts.append(sphere('sm ball', (r, r * 0.97, r * 0.94), (x, 0, z), M('Snow'), seg=16, rings=9))
    hz, hr = balls[2][1], balls[2][2]
    for sx in (-1, 1):
        parts.append(sphere('sm eye', (0.065, 0.05, 0.08), (sx * 0.14, -hr * 0.9, hz + 0.1), M('Coal'), seg=8, rings=4))
    for i in range(5):
        a = math.pi * (0.25 + 0.5 * i / 4)
        parts.append(sphere('sm smile', 0.035, (math.cos(a) * 0.18, -hr * 0.88, hz - 0.08 - math.sin(a) * 0.08),
                            M('Coal'), seg=6, rings=3))
    parts.append(cyl('sm carrot', 0.075, 0.42, (0, -hr - 0.16, hz), M('Carrot'), verts=8, r2=0.01,
                     rot=(HALF_PI, 0, 0)))
    for k in range(3):
        z = balls[1][1] + 0.28 - k * 0.26
        parts.append(sphere('sm button', 0.06, (0, -math.sqrt(max(0.01, balls[1][2] ** 2 - (z - balls[1][1]) ** 2)) + 0.01,
                                                z), M('Coal'), seg=6, rings=3))
    # scarf and tail
    nz = (balls[1][1] + balls[1][2] + balls[2][1] - balls[2][2]) / 2 + 0.02
    parts += [torus('sm scarf', 0.36, 0.1, (0, 0, nz), M('Fabric Red'), maj=16, mn=6),
              box('sm tail', (0.24, 0.1, 0.62), (0.26, -0.32, nz - 0.3), M('Fabric Red'), bevel=0.04, segments=1,
                  rot=(0.15, 0.15, 0.3)),
              box('sm stripe', (0.26, 0.11, 0.07), (0.27, -0.33, nz - 0.45), M('Fabric White'), bevel=0.0,
                  rot=(0.15, 0.15, 0.3))]
    # knit hat with pompom
    tz = hz + hr * 0.62
    parts += [lathe_fn('sm hat', [(0.0, tz + 0.5), (0.2, tz + 0.46), (0.34, tz + 0.3), (0.4, tz + 0.08), (0.0, tz + 0.1)],
                       'Fabric Blue', seg=16, smooth_angle=60),
              torus('sm hatrim', 0.39, 0.08, (0, 0, tz + 0.08), M('Fabric White'), maj=16, mn=5),
              sphere('sm pompom', 0.14, (0.05, 0, tz + 0.6), M('Fabric White'), seg=10, rings=5)]
    # stick arms with twiggy fingers and mittens
    for sx in (-1, 1):
        a = Vector((sx * 0.45, 0, 1.95))
        b = Vector((sx * 1.05, -0.1, 2.35))
        parts.append(tube('sm arm', [a, (a + b) / 2 + Vector((0, 0, 0.04)), b], 0.04, M('Bark'), verts=5))
        parts.append(rod('sm twig', b - (b - a) * 0.25, b + Vector((sx * 0.08, 0, 0.22)), 0.025, M('Bark'), verts=4))
        parts.append(sphere('sm mitten', (0.12, 0.1, 0.12), b + Vector((sx * 0.05, 0, 0.02)), M('Fabric Red'), seg=8,
                            rings=4))
    return finish(root, parts, ao=0.6, strength=0.6,
                  grads={'Snow': (0, 3.0, (0.84, 0.9, 1.0), (1, 1, 1))})


# ------------------------------------------------------------------ Fountain

def fountain():
    root = empty('Fountain')
    parts = [lathe_fn('fn basin', [(0.0, 0.0), (2.55, 0.0), (2.62, 0.08), (2.62, 0.52), (2.72, 0.62), (2.72, 0.78),
                                   (2.55, 0.84), (2.36, 0.74), (2.32, 0.3), (0.0, 0.3)], 'Stone', seg=28, smooth_angle=45),
             ring_band('fn tiles', 2.62, 0.3, 0.26, 'Paint Sky', seg=28, thick=0.05),
             lathe_fn('fn pool', [(0.0, 0.58), (2.37, 0.58)], 'Water', seg=28),
             lathe_fn('fn column', [(0.0, 0.3), (0.5, 0.3), (0.42, 0.5), (0.3, 0.8), (0.34, 1.1), (0.26, 1.35),
                                    (0.0, 1.35)], 'Stone', seg=16, smooth_angle=50),
             lathe_fn('fn bowl', [(0.0, 1.3), (0.3, 1.3), (0.9, 1.45), (1.3, 1.7), (1.35, 1.82), (1.24, 1.84),
                                  (0.0, 1.66)], 'Stone', seg=24, smooth_angle=50),
             lathe_fn('fn bowlwater', [(0.0, 1.78), (1.25, 1.78)], 'Water', seg=24),
             lathe_fn('fn column2', [(0.0, 1.7), (0.22, 1.7), (0.16, 2.0), (0.2, 2.3), (0.0, 2.35)], 'Stone', seg=12,
                      smooth_angle=50),
             lathe_fn('fn cup', [(0.0, 2.3), (0.2, 2.3), (0.5, 2.42), (0.66, 2.62), (0.6, 2.66), (0.0, 2.55)],
                      'Stone', seg=16, smooth_angle=50),
             lathe_fn('fn cupwater', [(0.0, 2.6), (0.6, 2.6)], 'Water', seg=16)]
    # water: a plume from the top spout arcing into the bowl, jets from the rim spouts arcing into the pool
    parts += [lathe_fn('fn jet', [(0.0, 2.6), (0.1, 2.62), (0.08, 3.3), (0.13, 3.55), (0.0, 3.66)], 'Water Spray',
                       seg=10, smooth_angle=70),
              sphere('fn ball', 0.14, (0, 0, 3.72), M('Gold Trim'), seg=8, rings=4)]
    for i in range(8):
        a = TAU * i / 8
        d = Vector((math.cos(a), math.sin(a), 0))
        pts = [Vector((0, 0, 3.5)) + d * (0.95 * t) + Vector((0, 0, 0.35 * math.sin(math.pi * t * 0.9) - 1.75 * t * t))
               for t in [k / 7 for k in range(8)]]
        parts.append(tube('fn arc', pts, 0.06, M('Water Spray'), verts=5, radius_fn=lambda t: 1.0 - 0.35 * t))
    for i in range(4):  # little gold spouts on the basin rim, each shooting an arc into the pool
        a = TAU * i / 4 + TAU / 8
        d = Vector((math.cos(a), math.sin(a), 0))
        parts.append(sphere('fn spout', (0.16, 0.16, 0.12), d * 2.55 + Vector((0, 0, 0.86)), M('Gold Trim'), seg=8,
                            rings=4))
        pts = [d * (2.5 - 1.0 * t) + Vector((0, 0, 0.9 + 0.75 * math.sin(math.pi * t) - 0.35 * t)) for t in
               [k / 7 for k in range(8)]]
        parts.append(tube('fn rimjet', pts, 0.055, M('Water Spray'), verts=5, radius_fn=lambda t: 1.0 - 0.3 * t))
    parts += [torus('fn foam', 1.55, 0.09, (0, 0, 0.6), M('Foam'), maj=24, mn=4),
              torus('fn foam2', 0.95, 0.06, (0, 0, 1.8), M('Foam'), maj=16, mn=4)]
    return finish(root, parts, ao=0.8, strength=0.6)


BUILDERS = [
    ('Beacon', beacon), ('Windmill', windmill), ('FerrisWheel', ferris_wheel), ('Carillon_Tower', carillon_tower),
    ('Tower_Neon', tower_neon), ('Tree_Xmas', tree_xmas), ('Snowman', snowman), ('Fountain', fountain),
]
