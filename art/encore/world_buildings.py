"""Buildings: cottage, canal house, round house, glasshouse, circus tent, pier segment and sailboat.

Fronts face -Y. Windows use `Window Glow` (emissive, dimmed by the runtime in daytime)."""
import bpy, bmesh, math, random
from mathutils import Vector
from aaa_kit import TAU, sphere, capsule, from_bmesh, shade, empty
from world_lib import (box, cyl, rod, torus, tube, extrude, M, blob, clumps, lathe_fn, loft, paint, place, window, door, round_window, gable_roof,
                       cone_roof, ring_band, disc_shape, outline_star, outline_flower, frond, finish, smoothstep,
                       lerp)

HALF_PI = math.pi / 2


def slope_board(prefix, a, b, y, thick=0.12, depth=0.14, mat='Trim White'):
    """A barge board from point a=(x,z) to b=(x,z) on the plane y."""
    ln = math.hypot(b[0] - a[0], b[1] - a[1])
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    return box(prefix, (ln, depth, thick), ((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2), M(mat), bevel=0.03,
               segments=1, rot=(0, -ang, 0))


def wall_lamp(prefix, loc, face=0.0):
    objs = [box(f'{prefix} arm', (0.06, 0.3, 0.06), (0, -0.15, 0.05), M('Paint Navy'), bevel=0.02, segments=1),
            box(f'{prefix} lamp', (0.2, 0.2, 0.26), (0, -0.32, -0.08), M('Window Glow'), bevel=0.04, segments=1),
            cyl(f'{prefix} cap', 0.16, 0.08, (0, -0.32, 0.09), M('Paint Navy'), verts=8, r2=0.05),
            box(f'{prefix} base', (0.16, 0.16, 0.05), (0, -0.32, -0.23), M('Paint Navy'), bevel=0.02, segments=1)]
    return place(objs, loc, rz=face)


def potted_shrub(prefix, loc, r=0.32, pot='Terracotta', leaf='Foliage', flowers=None, seed=0):
    x, y, z = loc
    objs = [lathe_fn(f'{prefix} pot', [(0.0, z), (r * 0.7, z), (r * 0.95, z + r * 0.9), (r * 1.05, z + r * 1.0),
                                       (r * 1.05, z + r * 1.15), (r * 0.9, z + r * 1.15), (0.0, z + r * 1.0)],
                     pot, seg=12, smooth_angle=40)]
    objs[0].location = (x, y, 0)
    objs.append(blob(f'{prefix} shrub', [(x, y, z + r * 1.6, r * 0.85), (x + r * 0.4, y, z + r * 1.4, r * 0.55),
                                         (x - r * 0.35, y + 0.05, z + r * 1.45, r * 0.55)], [leaf], k=0.12, sub=2,
                     seed=seed, bump=0.02, dec=0.4))
    if flowers:
        for i in range(4):
            a = TAU * i / 4 + seed
            objs.append(sphere(f'{prefix} bloom', r * 0.2, (x + math.cos(a) * r * 0.6, y + math.sin(a) * r * 0.6 - 0.05,
                                                             z + r * 1.9 - (i % 2) * r * 0.3), M(flowers[i % len(flowers)]),
                               seg=8, rings=4))
    return objs


# ------------------------------------------------------------------ House_Cottage

def house_cottage():
    root = empty('House_Cottage')
    W, D = 5.6, 4.4
    fy = -D / 2
    parts = [box('hc plinth', (W + 0.4, D + 0.4, 0.45), (0, 0, 0.225), M('Stone'), bevel=0.1, segments=2),
             box('hc walls', (W, D, 3.0), (0, 0, 1.95), M('Wall Butter'), bevel=0.1, segments=2),
             extrude('hc gable', [(-W / 2, 3.38), (W / 2, 3.38), (0, 5.45)], D, M('Wall Butter'), bevel=0.04),
             box('hc band', (W + 0.12, D + 0.12, 0.2), (0, 0, 3.42), M('Wood'), bevel=0.05, segments=1)]
    for sx in (-1, 1):  # timber corner posts
        for sy in (-1, 1):
            parts.append(box('hc post', (0.2, 0.2, 3.0), (sx * (W / 2 - 0.04), sy * (D / 2 - 0.04), 1.95), M('Wood'),
                             bevel=0.05, segments=1))
    roof_len = D + 0.9
    parts += gable_roof('hc', W / 2, 3.38, 5.45, roof_len, 'Roof Red', overhang=0.55, rows=5, step=0.11, thk=0.2)
    slope = (5.45 - 3.38) / (W / 2)
    run = W / 2 + 0.55
    for yy in (-roof_len / 2 - 0.03, roof_len / 2 + 0.03):
        for sx in (-1, 1):
            parts.append(slope_board('hc barge', (sx * run, 5.45 - slope * run + 0.14), (0, 5.45 + 0.3), yy,
                                     thick=0.2, depth=0.12))
    # chimney
    parts += [box('hc chim', (0.66, 0.66, 2.0), (1.35, 0.9, 5.2), M('Stone'), bevel=0.06, segments=1),
              box('hc chimcap', (0.86, 0.86, 0.18), (1.35, 0.9, 6.25), M('Stone Deep'), bevel=0.05, segments=1),
              cyl('hc pot', 0.16, 0.36, (1.35, 0.9, 6.5), M('Terracotta'), verts=10, bevel=0.03)]
    # door, steps, lamp
    parts += place(door('hc door', 1.05, 2.1, paint='Paint Sky', step=False), (0, fy, 0.45))
    parts += [box('hc step1', (1.8, 0.5, 0.3), (0, fy - 0.45, 0.15), M('Stone'), bevel=0.05, segments=1),
              box('hc step2', (1.5, 0.4, 0.45), (0, fy - 0.2, 0.225), M('Stone'), bevel=0.05, segments=1)]
    parts += wall_lamp('hc lamp', (0.95, fy - 0.02, 2.55))
    # windows
    for sx in (-1, 1):
        parts += place(window('hc wf', 0.82, 1.02, shutters='Paint Sky',
                              flowers=['Petal Coral', 'Petal Sunshine', 'Blossom']), (sx * 1.72, fy, 2.05))
    parts += place(round_window('hc attic', 0.36), (0, fy, 4.3))
    for side in (-1, 1):
        for yy in (-0.95, 0.95):
            parts += place(window('hc ws', 0.78, 1.0, sill=False), (side * W / 2, yy, 2.05), rz=side * HALF_PI)
    parts += place(window('hc wb', 0.78, 1.0, cross=False, sill=False), (0, D / 2, 2.05), rz=math.pi)
    # shrubs by the door
    for sx in (-1, 1):
        parts.append(blob('hc bush', [(sx * 1.1, fy - 0.55, 0.32, 0.4), (sx * 1.45, fy - 0.45, 0.26, 0.3)], ['Foliage'],
                          k=0.12, sub=2, floor=0.0, bump=0.02, seed=sx, dec=0.5))
    return finish(root, parts, ao=0.9, strength=0.5, min_ao=0.45,
                  grads={'Wall Butter': (0.3, 5.5, (0.94, 0.92, 0.9), (1, 1, 1))})


# ------------------------------------------------------------------ House_Tall

def house_tall():
    root = empty('House_Tall')
    W, D, H = 4.2, 4.6, 8.0
    fy = -D / 2
    parts = [box('ht plinth', (W + 0.3, D + 0.3, 0.42), (0, 0, 0.21), M('Stone'), bevel=0.08, segments=2),
             box('ht walls', (W, D, H - 0.4), (0, 0, 0.4 + (H - 0.4) / 2), M('Wall Peach'), bevel=0.08, segments=2)]
    # stepped (Dutch) gable facade
    steps = [(-2.1, 7.9), (2.1, 7.9), (2.1, 8.85), (1.45, 8.85), (1.45, 9.8), (0.8, 9.8), (0.8, 10.75), (-0.8, 10.75),
             (-0.8, 9.8), (-1.45, 9.8), (-1.45, 8.85), (-2.1, 8.85)]
    parts.append(extrude('ht facade', steps, 0.5, M('Wall Peach'), bevel=0.05, loc=(0, fy + 0.2, 0)))
    for (x0, x1, z) in [(-2.1, -1.45, 8.85), (1.45, 2.1, 8.85), (-1.45, -0.8, 9.8), (0.8, 1.45, 9.8),
                        (-0.8, 0.8, 10.75)]:
        parts.append(box('ht coping', (x1 - x0 + 0.16, 0.66, 0.16), ((x0 + x1) / 2, fy + 0.2, z + 0.06),
                         M('Trim White'), bevel=0.04, segments=1))
    parts.append(cyl('ht crest', 0.55, 0.46, (0, fy + 0.2, 10.83), M('Wall Peach'), verts=16, rot=(HALF_PI, 0, 0),
                     bevel=0.05))
    parts.append(sphere('ht finial', 0.16, (0, fy + 0.2, 11.55), M('Gold Trim'), seg=10, rings=6))
    parts.append(extrude('ht attic', [(-2.1, 7.95), (2.1, 7.95), (0, 10.25)], D - 0.3, M('Wall Peach'), bevel=0.04,
                         loc=(0, 0.15, 0)))
    parts += gable_roof('htr', W / 2, 7.95, 10.25, D - 0.1, 'Roof Teal', overhang=0.4, rows=5, step=0.1, thk=0.18,
                        y=0.25)
    parts += [box('ht chim', (0.55, 0.55, 1.6), (-1.0, 1.4, 10.0), M('Wall Peach'), bevel=0.05, segments=1),
              box('ht chimcap', (0.72, 0.72, 0.16), (-1.0, 1.4, 10.85), M('Trim White'), bevel=0.04, segments=1)]
    # storey bands
    for z in (3.35, 5.75, 7.95):
        parts.append(box('ht band', (W + 0.14, D + 0.14, 0.16), (0, 0, z), M('Trim White'), bevel=0.04, segments=1))
    # ground floor: door + shop window + striped awning
    parts += place(door('ht door', 1.0, 2.2, paint='Paint Royal', step=False), (-1.0, fy, 0.42))
    parts.append(box('ht step', (1.6, 0.5, 0.42), (-1.0, fy - 0.25, 0.21), M('Stone'), bevel=0.05, segments=1))
    parts += place(window('ht shop', 1.3, 1.35, cross=False, flowers=['Petal Coral', 'Petal White', 'Petal Sunshine']),
                   (1.0, fy, 1.85))
    n = 7
    for i in range(n):
        x0 = -2.0 + 4.0 * i / n
        m = 'Fabric Red' if i % 2 == 0 else 'Fabric White'
        parts.append(box('ht awn', (4.0 / n + 0.01, 0.95, 0.08), (x0 + 2.0 / n, fy - 0.45, 3.0), M(m), bevel=0.02,
                         segments=1, rot=(-0.38, 0, 0)))

    seg_w = 4.0 / n
    outline = [(-2.0, 2.86), (2.0, 2.86)]
    for i in reversed(range(n)):
        xa = -2.0 + seg_w * (i + 1)
        for k in range(7):
            t = k / 6
            outline.append((xa - seg_w * t, 2.74 - 0.2 * math.sin(math.pi * t) ** 0.7))
    val = extrude('ht valance', outline, 0.06, M('Fabric Red'), bevel=0.0, loc=(0, fy - 0.93, 0))
    paint(val, [M('Fabric Red'), M('Fabric White')], lambda c, p: int((c.x + 2.0) / seg_w) % 2)
    parts.append(val)
    # balcony on floor 2
    parts.append(box('ht balc', (3.6, 0.85, 0.16), (0, fy - 0.42, 3.62), M('Trim White'), bevel=0.05, segments=1))
    for i in range(6):
        x = -1.7 + 3.4 * i / 5
        parts.append(cyl('ht baluster', 0.05, 0.62, (x, fy - 0.78, 4.0), M('Trim White'), verts=5))
    parts.append(box('ht rail', (3.6, 0.1, 0.1), (0, fy - 0.78, 4.33), M('Trim White'), bevel=0.03, segments=1))
    for i, x in enumerate((-1.2, 1.2)):
        parts += potted_shrub(f'ht bp{i}', (x, fy - 0.45, 3.7), r=0.22, flowers=['Petal Coral', 'Petal Sunshine'],
                              seed=i)
    for x in (-1.0, 1.0):
        parts += place(window('ht w2', 0.82, 1.35, sill=False, shutters='Roof Teal'), (x, fy, 4.6))
        parts += place(window('ht w3', 0.82, 1.3, flowers=['Blossom', 'Petal White']), (x, fy, 6.85))
    parts += place(window('ht wa', 0.7, 0.75, arch=True), (0, fy - 0.05, 8.95))
    parts += [box('ht hoist', (0.14, 0.9, 0.16), (0, fy - 0.35, 10.2), M('Wood Deep'), bevel=0.03, segments=1),
              torus('ht hook', 0.07, 0.025, (0, fy - 0.72, 10.03), M('Gold Trim'), maj=8, mn=4, rot=(0, HALF_PI, 0))]
    for side in (-1, 1):
        for z in (4.6, 6.85):
            parts += place(window('ht ws', 0.72, 1.2, sill=False, cross=False), (side * W / 2, 0.4, z),
                           rz=side * HALF_PI)
    return finish(root, parts, ao=0.9, strength=0.5, min_ao=0.45,
                  grads={'Wall Peach': (0.3, 11, (0.94, 0.92, 0.92), (1, 1, 1))})


# ------------------------------------------------------------------ House_Round

def house_round():
    root = empty('House_Round')
    R = 2.3
    parts = [lathe_fn('hr plinth', [(0.0, 0.0), (R + 0.3, 0.0), (R + 0.32, 0.3), (R + 0.22, 0.44), (0.0, 0.44)],
                      'Stone', seg=32, smooth_angle=40),
             lathe_fn('hr wall', [(0.0, 0.4), (R, 0.4), (R, 3.55), (R * 0.9, 3.7), (0.0, 3.7)], 'Wall Sky', seg=32,
                      smooth_angle=40),
             ring_band('hr band', R, 2.25, 0.2, 'Wood', seg=32, thick=0.09),
             ring_band('hr top', R, 3.45, 0.22, 'Trim White', seg=32, thick=0.1)]
    # scalloped tile rings on a gently flared cone roof
    parts.append(cone_roof('hr roof', R + 0.65, 3.35, 7.1, 'Roof Orange', rows=5, step=0.13, thk=0.2, seg=28,
                           curve=1.25, tip=0.1, mid=False,
                           fn=lambda th, i, r, z: (r * (1 + 0.025 * math.cos(14 * th + i * 1.6)), z)))
    parts += [cyl('hr spire', 0.1, 0.9, (0, 0, 7.5), M('Gold Trim'), verts=8, r2=0.06),
              sphere('hr ball', 0.22, (0, 0, 7.25), M('Gold Trim'), seg=10, rings=5),
              extrude('hr flag', [(0, 0), (0.75, 0.16), (0, 0.36)], 0.04, M('Fabric Red'), bevel=0.01,
                      loc=(0.05, 0, 7.55))]
    # chimney through the roof
    parts += [box('hr chim', (0.5, 0.5, 2.2), (1.25, 0.7, 5.3), M('Stone'), bevel=0.05, segments=1),
              box('hr chimcap', (0.68, 0.68, 0.16), (1.25, 0.7, 6.45), M('Stone Deep'), bevel=0.04, segments=1)]
    # door with a little canopy
    parts += place(door('hr door', 1.0, 2.05, paint='Paint Cherry', step=False), (0, -R + 0.02, 0.44))
    parts.append(box('hr step', (1.5, 0.55, 0.44), (0, -R - 0.2, 0.22), M('Stone'), bevel=0.05, segments=1))
    canopy = gable_roof('hrc', 0.7, 2.85, 3.3, 0.8, 'Roof Orange', overhang=0.12, rows=2, step=0.06, thk=0.1)
    parts += place(canopy, (0, -R - 0.25, 0))
    for sx in (-1, 1):
        parts.append(box('hr bracket', (0.08, 0.5, 0.08), (sx * 0.62, -R - 0.2, 2.72), M('Wood'), bevel=0.02,
                         segments=1, rot=(0.6, 0, 0)))
    parts += place(round_window('hr ow', 0.28), (0, -R - 0.02, 3.0))
    for a in (-0.78, 0.78, 2.2, -2.2):
        front = abs(a) < 1
        parts += place(window('hr w', 0.68, 0.95, arch=True, shutters='Roof Orange' if front else None,
                              flowers=['Petal Coral', 'Petal Sunshine', 'Petal White'] if front else None,
                              sill=front, cross=front),
                       (R * math.sin(a), -R * math.cos(a), 1.55), rz=a)
    parts += potted_shrub('hr pot1', (-1.15, -R - 0.55, 0.0), r=0.3, flowers=['Blossom', 'Petal White'], seed=1)
    parts += potted_shrub('hr pot2', (1.2, -R - 0.5, 0.0), r=0.26, flowers=['Petal Sunshine'], seed=2)
    return finish(root, parts, ao=0.9, strength=0.5, min_ao=0.45,
                  grads={'Wall Sky': (0.4, 3.7, (0.92, 0.92, 0.95), (1, 1, 1))})


# ------------------------------------------------------------------ Glasshouse

def glasshouse():
    random.seed(91)
    root = empty('Glasshouse')
    R, zb, zt = 4.2, 0.7, 3.9
    parts = [lathe_fn('gh plinth', [(0.0, 0.0), (R + 0.45, 0.0), (R + 0.45, 0.55), (R + 0.3, 0.72), (0.0, 0.72)],
                      'Stone', seg=36, smooth_angle=40),
             lathe_fn('gh drum', [(R, zb), (R, zt)], 'Glass Pane', seg=36, cap=False)]
    ribs = 12
    for i in range(ribs):
        a = TAU * i / ribs + TAU / ribs / 2
        parts.append(box('gh rib', (0.16, 0.16, zt - zb), (math.cos(a) * (R + 0.02), math.sin(a) * (R + 0.02),
                                                           (zb + zt) / 2), M('Trim White'), bevel=0.0,
                         rot=(0, 0, a)))
    for z, rr in ((zb + 0.05, 0.1), (2.35, 0.07)):
        parts.append(torus('gh ring', R + 0.03, rr, (0, 0, z), M('Trim White'), maj=30, mn=4))
    parts.append(ring_band('gh cornice', R, zt, 0.3, 'Trim White', seg=30, thick=0.18))
    # dome
    dome_h = 3.7
    prof = []
    for k in range(9):
        t = k / 8 * 0.86 * HALF_PI
        prof.append((R * math.cos(t), zt + dome_h * math.sin(t)))
    top_r, top_z = prof[-1]
    parts.append(lathe_fn('gh dome', prof, 'Glass Pane', seg=36, cap=False, smooth_angle=70))
    for i in range(12):
        a = TAU * i / 12 + TAU / 24
        pts = [(math.cos(a) * (r + 0.05), math.sin(a) * (r + 0.05), z) for r, z in prof[::2]] + \
              [(math.cos(a) * (top_r + 0.05), math.sin(a) * (top_r + 0.05), top_z)]
        parts.append(tube('gh drib', pts, 0.075, M('Trim White'), verts=4, caps=False))
    for k in (4,):
        r, z = prof[k]
        parts.append(torus('gh dring', r + 0.04, 0.06, (0, 0, z), M('Trim White'), maj=32, mn=4))
    # cupola lantern
    cz = top_z
    parts += [lathe_fn('gh cupbase', [(0.0, cz - 0.1), (top_r + 0.2, cz - 0.1), (top_r + 0.2, cz + 0.12),
                                      (0.0, cz + 0.12)], 'Trim White', seg=20, smooth_angle=40),
              lathe_fn('gh cupglass', [(top_r * 0.8, cz + 0.1), (top_r * 0.8, cz + 0.9)], 'Window Glow', seg=16,
                       cap=False),
              cone_roof('gh cuproof', top_r + 0.25, cz + 0.88, cz + 1.75, 'Roof Teal', rows=3, step=0.07, thk=0.12,
                        seg=20, curve=0.8, tip=0.06),
              sphere('gh ball', 0.2, (0, 0, cz + 1.95), M('Gold Trim'), seg=10, rings=5),
              cyl('gh spike', 0.05, 0.6, (0, 0, cz + 2.3), M('Gold Trim'), verts=6, r2=0.01)]
    for i in range(6):
        a = TAU * i / 6
        parts.append(box('gh cuppost', (0.1, 0.1, 0.8), (math.cos(a) * top_r * 0.82, math.sin(a) * top_r * 0.82,
                                                         cz + 0.5), M('Trim White'), bevel=0.0, rot=(0, 0, a)))
    # front vestibule with a teal gable and double door
    vy = -R - 0.55
    vw, vd, vh = 2.6, 1.6, 2.9
    parts += [box('gh vglass', (vw - 0.1, vd, vh - 0.1), (0, vy + 0.25, zb + vh / 2 - 0.05), M('Glass Pane'),
                  bevel=0.02, segments=1),
              box('gh vplinth', (vw + 0.4, vd + 0.4, 0.72), (0, vy + 0.25, 0.36), M('Stone'), bevel=0.06, segments=1)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box('gh vpost', (0.18, 0.18, vh), (sx * vw / 2, vy + 0.25 + sy * vd / 2, zb + vh / 2),
                             M('Trim White'), bevel=0.0))
    parts.append(box('gh vbeam', (vw + 0.2, vd + 0.2, 0.2), (0, vy + 0.25, zb + vh), M('Trim White'), bevel=0.04,
                     segments=1))
    parts.append(extrude('gh vped', [(-vw / 2 - 0.1, zb + vh + 0.08), (vw / 2 + 0.1, zb + vh + 0.08),
                                     (0, zb + vh + 1.0)], vd + 0.3, M('Roof Teal'), bevel=0.05, loc=(0, vy + 0.25, 0)))
    parts += place(round_window('gh vrw', 0.22), (0, vy + 0.25 - vd / 2 - 0.16, zb + vh + 0.42))
    for sx in (-1, 1):
        parts.append(box('gh door', (0.7, 0.1, 2.0), (sx * 0.38, vy + 0.25 - vd / 2 - 0.02, zb + 1.0),
                         M('Trim White'), bevel=0.03, segments=1))
        parts.append(box('gh doorglass', (0.46, 0.08, 1.5), (sx * 0.38, vy + 0.25 - vd / 2 - 0.06, zb + 1.1),
                         M('Window Glow'), bevel=0.02, segments=1))
        parts.append(sphere('gh knob', 0.05, (sx * 0.1, vy + 0.25 - vd / 2 - 0.1, zb + 1.0), M('Gold Trim'), seg=8,
                            rings=4))
    parts.append(box('gh vstep', (1.8, 0.6, 0.36), (0, vy + 0.25 - vd / 2 - 0.4, 0.18), M('Stone'), bevel=0.05,
                     segments=1))
    # plants inside, visible through the glass
    parts += clumps('gh plant', [('Foliage', [(-2.0, 1.0, 1.4, 0.95), (-1.3, 1.8, 1.2, 0.75), (-2.4, 0.2, 1.1, 0.7)], 2),
                                 ('Foliage Deep', [(2.1, 0.8, 1.3, 0.9), (1.6, 1.8, 1.1, 0.7)], 2),
                                 ('Blossom', [(0.9, -1.8, 1.1, 0.6), (-1.1, -1.7, 1.05, 0.55)], 2)], k=0.2)
    top = Vector((0.2, 0.9, 4.2))
    parts.append(tube('gh palm', [(0.3, 1.0, 0.7), (0.25, 0.95, 2.4), top], 0.16, M('Palm Bark'), verts=8,
                      radius_fn=lambda t: 1 - 0.35 * t))
    for i in range(5):
        a = TAU * i / 5
        parts.append(frond('gh frond', top, (math.cos(a), math.sin(a), 0), 1.7, 0.7, 'Foliage', droop=0.5, lift=0.3,
                           segs=10, serr=0.45))
    for i in range(2):
        parts += potted_shrub(f'gh op{i}', ((-1, 1)[i] * 2.0, vy - 0.55, 0.0), r=0.34,
                              flowers=['Blossom', 'Petal White', 'Petal Coral'], seed=i + 3)
    return finish(root, parts, ao=1.0, strength=0.55, grads={})


# ------------------------------------------------------------------ Tent_Circus

def _stripe(n):
    def f(c, p):
        a = math.atan2(c.y, c.x) % TAU
        return int(a / TAU * n) % 2
    return f


def tent_circus():
    root = empty('Tent_Circus')
    R, zw = 4.4, 2.7
    wall = lathe_fn('tc wall', [(R, 0.0), (R * 1.02, zw * 0.5), (R, zw)], 'Fabric Red', seg=32, cap=False,
                    smooth_angle=60)
    paint(wall, [M('Fabric Red'), M('Fabric Yellow')], _stripe(16))
    prof = [(0.0, 7.4), (0.28, 7.2), (0.85, 6.3), (1.7, 5.1), (2.6, 4.1), (3.5, 3.35), (4.3, 2.85), (4.85, 2.62),
            (4.8, 2.52), (0.0, 2.7)]
    roof = lathe_fn('tc roof', prof, 'Fabric Red', seg=32, smooth_angle=55,
                    fn=lambda th, i, r, z: (r * (1 + (0.04 * math.cos(16 * th) if 3 <= i <= 7 else 0)), z))
    paint(roof, [M('Fabric Red'), M('Fabric White')], _stripe(16))
    parts = [wall, roof, lathe_fn('tc floor', [(0.0, 0.0), (R - 0.05, 0.0), (R - 0.05, 0.05), (0.0, 0.05)],
                                  'Tent Dark', seg=24)]
    # scalloped valance: one ring whose lower edge hangs in 24 rounded tongues, painted in alternating sectors
    nf, per = 24, 3

    def tongue(th, i, r, z):
        if i in (2, 3):
            u = ((th / TAU) * nf + 0.5 / per) % 1.0
            return r, 2.66 - 0.52 * math.sin(math.pi * u) ** 0.55
        return r, z
    val = lathe_fn('tc valance', [(4.83, 2.7), (4.92, 2.5), (4.9, 2.2), (4.83, 2.22), (4.8, 2.66)],
                   'Fabric Blue', seg=nf * per, fn=tongue, smooth_angle=70, cap=False)
    paint(val, [M('Fabric Blue'), M('Fabric Yellow')],
          lambda c, p: int(((math.atan2(c.y, c.x) % TAU) / TAU) * nf) % 2)
    parts.append(val)
    parts.append(torus('tc hem', 4.83, 0.07, (0, 0, 2.66), M('Gold Trim'), maj=32, mn=4))
    # pole, ball and pennant
    parts += [cyl('tc pole', 0.08, 1.3, (0, 0, 7.9), M('Gold Trim'), verts=8),
              sphere('tc ball', 0.2, (0, 0, 8.6), M('Gold Trim'), seg=10, rings=5),
              extrude('tc pennant', [(0, 0), (1.3, 0.22), (0, 0.5)], 0.05, M('Fabric Blue'), bevel=0.012,
                      loc=(0.06, 0, 7.95))]
    for i in range(4):
        a = TAU * i / 4 + TAU / 8
        x, y = math.cos(a) * 3.3, math.sin(a) * 3.3
        parts += [cyl('tc minipole', 0.05, 0.9, (x, y, 3.7), M('Gold Trim'), verts=6),
                  sphere('tc minib', 0.1, (x, y, 4.2), M('Gold Trim'), seg=8, rings=5),
                  extrude('tc minif', [(0, 0), (0.7, 0.13), (0, 0.3)], 0.04,
                          M(['Fabric Yellow', 'Fabric Blue', 'Fabric Green', 'Fabric Violet'][i]), bevel=0.01,
                          loc=(x + 0.04, y, 3.85))]
    # entrance portal: dark opening, gold arch, tied-back curtains, star sign
    fy = -R - 0.02
    parts += [box('tc opening', (1.7, 0.25, 1.6), (0, fy + 0.05, 0.8), M('Tent Dark'), bevel=0.03, segments=1),
              cyl('tc openarch', 0.85, 0.25, (0, fy + 0.05, 1.6), M('Tent Dark'), verts=16, rot=(HALF_PI, 0, 0)),
              torus('tc arch', 0.95, 0.09, (0, fy - 0.1, 1.6), M('Gold Trim'), maj=18, mn=6, rot=(HALF_PI, 0, 0),
                    arc=0.5)]
    for sx in (-1, 1):
        parts.append(cyl('tc jamb', 0.09, 1.6, (sx * 0.95, fy - 0.1, 0.8), M('Gold Trim'), verts=8))
        parts.append(extrude('tc curtain', [(0, 0), (sx * 0.55, 0), (sx * 0.2, 1.0), (sx * 0.9, 2.4), (0, 2.4)], 0.1,
                             M('Fabric Red'), bevel=0.03, loc=(sx * 0.9, fy - 0.2, 0.02)))
        parts.append(sphere('tc tie', 0.09, (sx * 1.2, fy - 0.26, 1.0), M('Gold Trim'), seg=8, rings=5))
    parts.append(disc_shape('tc star', outline_star(5, 0.55, 0.26), 0.14, 'Paint Sunshine', (0, fy - 0.2, 3.1),
                            (0, -1, 0.25), bevel=0.03))
    parts.append(torus('tc starring', 0.72, 0.05, (0, fy - 0.12, 3.1), M('Gold Trim'), maj=20, mn=4,
                       rot=(HALF_PI - 0.24, 0, 0)))
    return finish(root, parts, ao=1.0, strength=0.6,
                  grads={'Fabric Red': (0, 7.5, (0.8, 0.8, 0.86), (1, 1, 1)),
                         'Fabric White': (2.6, 7.5, (0.84, 0.84, 0.9), (1, 1, 1))})


# ------------------------------------------------------------------ Pier

def pier():
    """10 m straight segment along Y (tiles seamlessly at y=+-5). Origin at the water line (z=0);
    deck top at z=1.0, piles go 1.5 m below."""
    random.seed(95)
    root = empty('Pier')
    L, Wd, dz = 10.0, 3.3, 1.0
    parts = []
    n = 12
    pw = L / n
    for i in range(n):
        y = -L / 2 + pw * (i + 0.5)
        m = 'Wood Deep' if i % 4 == 1 else 'Wood'
        parts.append(box('pr plank', (Wd, pw - 0.06, 0.16), (random.uniform(-0.04, 0.04), y,
                                                              dz - 0.08 + random.uniform(-0.015, 0.015)), M(m),
                         bevel=0.035, segments=1, rot=(0, 0, random.uniform(-0.012, 0.012))))
    for sx in (-1, 1):
        parts.append(box('pr stringer', (0.26, L, 0.34), (sx * 1.2, 0, dz - 0.33), M('Wood Deep'), bevel=0.04,
                         segments=1))
    posts = (-3.75, -1.25, 1.25, 3.75)
    top = dz + 0.72
    for y in posts:
        for sx in (-1, 1):
            x = sx * (Wd / 2 + 0.12)
            parts.append(cyl('pr post', 0.17, top + 1.5, (x, y, (top - 1.5) / 2), M('Wood'), verts=8, cap=False))
            parts.append(sphere('pr cap', 0.19, (x, y, top + 0.02), M('Wood Deep'), seg=8, rings=4))
        parts.append(rod('pr brace', (-(Wd / 2 + 0.05), y, dz - 0.4), ((Wd / 2 + 0.05), y, -0.3), 0.07,
                         M('Wood Deep'), verts=6))
    # sagging rope rail, split at the segment ends so neighbouring segments join up
    sag = 0.2
    spans = [(-5.0, -3.75, 0.5, 1.0)] + [(posts[i], posts[i + 1], 0.0, 1.0) for i in range(3)] + \
            [(3.75, 5.0, 0.0, 0.5)]
    for sx in (-1, 1):
        x = sx * (Wd / 2 + 0.12)
        for y0, y1, t0, t1 in spans:
            full = (y1 - y0) / (t1 - t0)
            ys = y0 - t0 * full
            pts = []
            for k in range(5):
                t = t0 + (t1 - t0) * k / 4
                pts.append((x, ys + full * t, top - 0.12 - sag * 4 * t * (1 - t)))
            parts.append(tube('pr rope', pts, 0.05, M('Rope'), verts=5, caps=False))
    # lifebuoy, lamp, crates and barrel
    bz = dz + 0.3
    buoy = torus('pr buoy', 0.36, 0.11, (Wd / 2 + 0.34, -1.25, bz), M('Paint Cherry'), maj=16, mn=8,
                 rot=(0, HALF_PI, 0))
    paint(buoy, [M('Paint Cherry'), M('Trim White')],
          lambda c, p: int(((math.atan2(c.z - bz, c.y + 1.25) % TAU) / TAU) * 8) % 2)
    parts.append(buoy)
    lx, ly = -(Wd / 2 + 0.12), 1.25
    glass = lathe_fn('pr lampglass', [(0.0, top + 1.72), (0.2, top + 1.74), (0.24, top + 1.95), (0.2, top + 2.18),
                                      (0.0, top + 2.2)], 'Lantern Glow', seg=10)
    glass.location = (lx, ly, 0)
    parts += [cyl('pr lamppole', 0.07, 1.7, (lx, ly, top + 0.85), M('Paint Navy'), verts=8), glass,
              cyl('pr lampcap', 0.28, 0.14, (lx, ly, top + 2.25), M('Paint Navy'), verts=10, r2=0.08)]
    barrel = lathe_fn('pr barrel', [(0.0, dz), (0.3, dz), (0.37, dz + 0.4), (0.3, dz + 0.8), (0.0, dz + 0.8)],
                      'Wood', seg=14, smooth_angle=40)
    barrel.location = (-0.3, 3.8, 0)
    parts += [box('pr crate', (0.8, 0.8, 0.7), (0.7, 3.4, dz + 0.35), M('Wood'), bevel=0.05, segments=1,
                  rot=(0, 0, 0.2)),
              box('pr crate2', (0.6, 0.6, 0.5), (0.75, 3.35, dz + 0.95), M('Wood Deep'), bevel=0.04, segments=1,
                  rot=(0, 0, -0.3)), barrel]
    for zz in (0.15, 0.65):
        parts.append(torus('pr hoop', 0.335, 0.03, (-0.3, 3.8, dz + zz), M('Paint Navy'), maj=14, mn=4))
    return finish(root, parts, ao=0.8, strength=0.6, ground=-0.2)


# ------------------------------------------------------------------ Boat_Sail

def _sail(name, a, b, c, bulge, rows=8, stripe=None):
    """Triangular sail a (tack) - b (head) - c (clew), billowed along X."""
    bm = bmesh.new()
    grid = []
    for i in range(rows + 1):
        s = i / rows
        row = []
        cnt = rows - i
        for j in range(cnt + 1):
            t = j / cnt if cnt > 0 else 0.0
            p = Vector(a).lerp(Vector(b), s)
            q = Vector(c).lerp(Vector(b), s)
            pt = p.lerp(q, t)
            pt.x += bulge * math.sin(math.pi * t) * (1 - s) ** 0.6
            row.append(bm.verts.new(pt))
        grid.append(row)
    for i in range(rows):
        r0, r1 = grid[i], grid[i + 1]
        for j in range(len(r1)):
            bm.faces.new((r0[j], r0[j + 1], r1[j]))
            if j + 1 < len(r1):
                bm.faces.new((r0[j + 1], r1[j + 1], r1[j]))
    if stripe:
        for zc in stripe:
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-4, plane_co=(0, 0, zc), plane_no=(0, 0, 1))
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    ob = from_bmesh(name, bm, M('Sail Cloth'), smooth_angle=80)
    if stripe:
        paint(ob, [M('Sail Cloth'), M('Fabric Red')], lambda cc, p: 1 if stripe[0] < cc.z < stripe[1] else 0)
    return ob


def boat_sail():
    """Small sailboat, bow toward -Y, origin at the water line."""
    root = empty('Boat_Sail')
    y0, y1 = -3.0, 2.6
    secs = []
    N = 16
    for k in range(N + 1):
        u = k / N
        y = lerp(y0, y1, u)
        w = max(0.04, 1.08 * math.sin(min(u * 1.55, 1) * HALF_PI) ** 0.85 * (1 - 0.1 * max(0, u - 0.7) / 0.3))
        d = max(0.05, 0.55 * math.sin(min(u * 1.35, 1) * HALF_PI))
        zd = 0.85 + 0.4 * (1 - u) ** 2.2
        ring = []
        for j in range(9):
            ph = -HALF_PI + math.pi * j / 8
            ring.append((w * math.sin(ph), y, zd - (zd + d) * math.cos(ph) ** 1.6))
        for j in (1, 2, 3):
            ring.append((w * (1 - j / 2), y, zd))
        secs.append(ring)
    hull = loft('bt hull', secs, 'Paint Cherry', smooth_angle=50)

    def hull_pick(c, p):
        if p.normal.z > 0.8:
            return 1
        if c.z < 0.12:
            return 2
        return 0
    paint(hull, [M('Paint Cherry'), M('Wood'), M('Trim White')], hull_pick)
    parts = [hull]
    right = [Vector(s_[8]) + Vector((0.02, 0, 0.03)) for s_ in secs]
    left = [Vector(s_[0]) + Vector((-0.02, 0, 0.03)) for s_ in reversed(secs)]
    parts.append(tube('bt rail', right[1:] + [Vector((0, y1 + 0.02, right[-1].z))] + left[:-1], 0.06,
                      M('Trim White'), verts=6))
    # cabin
    parts += [box('bt cabin', (1.2, 1.5, 0.75), (0, 0.9, 1.2), M('Paint Sunshine'), bevel=0.1, segments=2),
              box('bt cabroof', (1.45, 1.8, 0.14), (0, 0.9, 1.62), M('Roof Blue'), bevel=0.05, segments=1)]
    for sx in (-1, 1):
        for yy in (0.55, 1.25):
            parts += place([cyl('bt port', 0.13, 0.08, (0, 0, 0), M('Window Glow'), verts=12, rot=(HALF_PI, 0, 0)),
                            torus('bt portring', 0.15, 0.035, (0, -0.04, 0), M('Brass'), maj=12, mn=4,
                                  rot=(HALF_PI, 0, 0))], (sx * 0.6, yy, 1.22), rz=sx * HALF_PI)
    parts += place(round_window('bt fw', 0.16), (0, 0.15, 1.22))
    # mast, boom, sails, pennant
    my = -0.35
    parts += [cyl('bt mast', 0.08, 5.4, (0, my, 1.0 + 2.7), M('Trim White'), verts=10),
              sphere('bt masttop', 0.12, (0, my, 6.45), M('Gold Trim'), seg=10, rings=5),
              rod('bt boom', (0, my, 1.75), (0, 2.45, 1.75), 0.07, M('Wood'), verts=8)]
    parts.append(_sail('bt main', (0.0, my + 0.1, 1.85), (0.0, my + 0.08, 6.2), (0.0, 2.35, 1.85), 0.35,
                       stripe=(2.7, 3.2)))
    parts.append(_sail('bt jib', (0.0, my - 0.15, 1.6), (0.0, my - 0.1, 5.7), (0.0, -2.85, 1.35), 0.3, rows=6))
    parts.append(extrude('bt pennant', [(0, 0), (0, 0.22), (0.7, 0.1)], 0.04, M('Fabric Yellow'), bevel=0.01,
                         loc=(0, my + 0.05, 6.1), rot=(0, 0, -HALF_PI)))
    parts += [box('bt rudder', (0.1, 0.5, 0.9), (0, y1 + 0.1, 0.35), M('Wood Deep'), bevel=0.04, segments=1),
              torus('bt buoy', 0.24, 0.07, (0, 1.68, 1.2), M('Paint Cherry'), maj=12, mn=6, rot=(HALF_PI, 0, 0))]
    return finish(root, parts, ao=0.7, strength=0.6, ground=None)


BUILDERS = [
    ('House_Cottage', house_cottage), ('House_Tall', house_tall), ('House_Round', house_round),
    ('Glasshouse', glasshouse), ('Tent_Circus', tent_circus), ('Pier', pier), ('Boat_Sail', boat_sail),
]
