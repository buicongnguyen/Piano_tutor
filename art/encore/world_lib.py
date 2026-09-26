"""World-kit helpers for Stillnote Encore (shared by the world_*.py builder modules).

Adds the shapes the base toolkit lacks: SDF blob clusters (puffy foliage, clouds,
bushes), a lathe with per-vertex shaping, multi-material painting, lofts,
stepped (tiled) roofs, toy windows and doors, flowers and palm fronds, plus a
`finish()` step that joins parts by material, bakes AO and adds colour
gradients into COLOR_0.

Every material comes from `M(name)`, which wraps palette.toy() so the world kit
shares one toy-box palette with the stage and the characters.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler, noise
from aaa_kit import (TAU, sphere, capsule, lathe, blade, from_bmesh,
                     shade, empty, set_parent, join_by_material, bake_ao, decimate, apply_mods, link)
from aaa_kit import box as _kit_box, cyl as _kit_cyl, rod as _kit_rod, torus as _kit_torus, tube as _kit_tube
from aaa_kit import extrude as _kit_extrude


def extrude(name, outline, depth, material=None, bevel=0.01, segments=2, loc=(0, 0, 0), rot=(0, 0, 0),
            parent=None, plane='XZ'):
    """aaa_kit.extrude; small 1-segment-bevel plates (flags, pennants, stars) are smooth shaded so the 45-degree
    bevel faces share vertices. Large plates keep the kit's split shading so broad faces stay flat."""
    ob = _kit_extrude(name, outline, depth, material, bevel, segments, loc, rot, parent, plane)
    if bevel > 0 and segments == 1:
        us = [p[0] for p in outline]
        vs = [p[1] for p in outline]
        if max(max(us) - min(us), max(vs) - min(vs)) < 1.6:
            shade(ob, 50)
    return ob


# Low-segment primitives: the kit's fixed smooth angles hard-split every vertex of 4-5 sided tori, rods and
# tubes (faces 72-90 degrees apart). Re-shading them smooth keeps them round-looking and halves exported vertices.

def _side_angle(n):
    return min(85.0, max(38.0, 360.0 / n + 6.0))


def cyl(name, radius, depth, loc=(0, 0, 0), material=None, verts=24, r2=None, bevel=0., segments=2,
        rot=(0, 0, 0), parent=None, cap=True):
    ob = _kit_cyl(name, radius, depth, loc, material, verts, r2, bevel, segments, rot, parent, cap)
    if not cap:
        shade(ob, 100)
    elif verts <= 10 and bevel <= 0:
        shade(ob, _side_angle(verts))
    return ob


def rod(name, a, b, radius, material=None, verts=12, r2=None, bevel=0., parent=None, cap=True):
    ob = _kit_rod(name, a, b, radius, material, verts, r2, bevel, parent, cap)
    if not cap:
        shade(ob, 100)
    elif verts <= 10 and bevel <= 0:
        shade(ob, _side_angle(verts))
    return ob


def torus(name, R, r, loc=(0, 0, 0), material=None, maj=32, mn=12, rot=(0, 0, 0), parent=None, arc=1.0):
    ob = _kit_torus(name, R, r, loc, material, maj, mn, rot, parent, arc)
    if mn <= 5:
        shade(ob, 100)
    return ob


def tube(name, points, radius, material=None, verts=10, parent=None, caps=True, radius_fn=None, closed=False,
         squash=1.0):
    ob = _kit_tube(name, points, radius, material, verts, parent, caps, radius_fn, closed, squash)
    if verts <= 6:
        shade(ob, 100 if not caps else _side_angle(verts))
    return ob


def box(name, size, loc=(0, 0, 0), material=None, bevel=.03, segments=3, rot=(0, 0, 0), parent=None, taper=None,
        smooth=None):
    """aaa_kit.box, but 1-segment bevels are smooth shaded (soft toy edge, ~4x fewer exported vertices than the
    kit's 38-degree split, which hard-splits every 45-degree bevel face)."""
    ob = _kit_box(name, size, loc, material, bevel, segments, rot, parent, taper)
    if smooth is None:
        smooth = 60 if segments == 1 else None
    if smooth:
        shade(ob, smooth)
    return ob
from palette import P, toy

# ------------------------------------------------------------------ materials
# name -> (palette colour or hex, finish, extra toy() kwargs)
SPEC = {
    # nature (Foliage / Foliage Deep / Blossom are runtime-retintable names)
    'Foliage': ('leaf', 'satin', dict(double=True)),
    'Foliage Deep': ('leaf_deep', 'satin', {}),
    'Blossom': ('blossom', 'satin', {}),
    'Maple Leaf': ('maple', 'satin', {}),
    'Maple Leaf Deep': ('maple_deep', 'satin', {}),
    'Maple Leaf Gold': ('#ffb319', 'satin', {}),
    'Bark': ('bark', 'satin', {}),
    'Palm Bark': ('#c9884a', 'satin', {}),
    'Coconut': ('#7a3f1c', 'gloss', {}),
    'Snow': ('snow', 'satin', {}),
    'Island Top': ('grass', 'satin', {}),
    'Island Rock': ('rock', 'matte', {}),
    'Soil': ('soil', 'matte', {}),
    'Cloud': ('#ffffff', 'satin', {}),
    'Petal Coral': ('coral', 'satin', {}),
    'Petal Sunshine': ('sunshine', 'satin', {}),
    'Petal Violet': ('violet', 'satin', {}),
    'Petal White': ('ivory', 'satin', {}),
    'Petal Gold': ('#ffab12', 'satin', {}),
    'Flower Heart': ('tangerine', 'gloss', {}),
    'Seed Brown': ('bark_deep', 'satin', {}),
    # building paint
    'Wall Cream': ('wall_cream', 'satin', {}),
    'Wall Butter': ('#ffdf86', 'satin', {}),
    'Wall Peach': ('wall_peach', 'satin', {}),
    'Wall Mint': ('wall_mint', 'satin', {}),
    'Wall Sky': ('wall_sky', 'satin', {}),
    'Roof Red': ('roof_red', 'satin', {}),
    'Roof Blue': ('roof_blue', 'satin', {}),
    'Roof Teal': ('roof_teal', 'satin', {}),
    'Roof Orange': ('roof_orange', 'satin', {}),
    'Roof Purple': ('roof_purple', 'satin', {}),
    'Trim White': ('ivory', 'gloss', {}),
    'Wood': ('wood', 'satin', {}),
    'Wood Deep': ('wood_deep', 'satin', {}),
    'Stone': ('stone', 'matte', {}),
    'Stone Deep': ('stone_deep', 'matte', {}),
    'Gold Trim': ('gold', 'metal', {}),
    'Brass': ('brass', 'metal', {}),
    'Paint Cherry': ('cherry', 'gloss', {}),
    'Paint Coral': ('coral', 'gloss', {}),
    'Paint Royal': ('royal', 'gloss', {}),
    'Paint Sky': ('sky', 'gloss', {}),
    'Paint Sunshine': ('sunshine', 'gloss', {}),
    'Paint Lime': ('lime', 'gloss', {}),
    'Paint Violet': ('violet', 'gloss', {}),
    'Paint Navy': ('navy', 'gloss', {}),
    'Paint Mint': ('mint', 'gloss', {}),
    'Paint Tangerine': ('tangerine', 'gloss', {}),
    'Paint Berry': ('berry', 'gloss', {}),
    'Fabric Red': ('cherry', 'satin', {}),
    'Fabric White': ('ivory', 'satin', {}),
    'Fabric Yellow': ('sunshine', 'satin', {}),
    'Fabric Blue': ('sky', 'satin', {}),
    'Fabric Green': ('lime', 'satin', {}),
    'Fabric Violet': ('violet', 'satin', {}),
    'Fabric Pink': ('berry', 'satin', {}),
    'Fabric Orange': ('tangerine', 'satin', {}),
    'Tent Dark': ('#231a4a', 'matte', {}),
    'Water': ('water', 'glass', {}),
    'Foam': ('#e8fbff', 'satin', {}),
    'Water Spray': ('#9ff0ff', 'glass', {}),
    'Glass Pane': ('#aeeaff', 'glass', dict(alpha=.38, double=True)),
    'Sail Cloth': ('ivory', 'satin', dict(double=True)),
    'Terracotta': ('#e0662c', 'satin', {}),
    'Coal': ('ebony', 'gloss', {}),
    'Carrot': ('tangerine', 'gloss', {}),
    'Rope': ('#f4c57c', 'matte', {}),
    'Stillnote Crystal': ('#b7aed6', 'glass', {}),
    # glow: names contain Glow / Light (runtime finds and animates them)
    'Window Glow': ('#3d6fe0', 'glass', dict(emit=2.4, emit_color='window_glow')),
    'Beacon Light': ('#fff3c4', 'gloss', dict(emit=7.0, emit_color='#ffe28a')),
    'Lantern Glow': ('#ff5a24', 'satin', dict(emit=2.4, emit_color='#ff7a22')),
    'Neon Glow': ('neon_pink', 'gloss', dict(emit=4.0)),
    'Neon Glow Cyan': ('neon_cyan', 'gloss', dict(emit=4.0)),
    'Xmas Light Glow': ('#ffd45a', 'gloss', dict(emit=4.5)),
    'Star Glow': ('#ffd02a', 'gloss', dict(emit=3.0, emit_color='#ffcf4a')),
    'Ferris Bulb Glow': ('#fff0a0', 'gloss', dict(emit=4.5, emit_color='#ffe070')),
}


def M(name):
    col, fin, kw = SPEC[name]
    return toy(name, col, fin, **kw)


def is_glow(ob):
    return ob.type == 'MESH' and any(m and ('Glow' in m.name or 'Light' in m.name) for m in ob.data.materials)


# ------------------------------------------------------------------ math

def smin(a, b, k):
    if k <= 0:
        return min(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(x):
    return max(0.0, min(1.0, x))


def smoothstep(a, b, x):
    t = clamp01((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def _sd(p, c, r):
    q = p - c
    if not isinstance(r, (tuple, list)):
        return q.length - r
    k0 = Vector((q.x / r[0], q.y / r[1], q.z / r[2])).length
    k1 = Vector((q.x / r[0] ** 2, q.y / r[1] ** 2, q.z / r[2] ** 2)).length
    if k1 < 1e-9:
        return -min(r)
    return k0 * (k0 - 1) / k1


# ------------------------------------------------------------------ transforms

def place(objs, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, scale=1.0):
    """Transform already-built world-space parts as a group."""
    bpy.context.view_layer.update()
    mtx = Matrix.Translation(loc) @ Euler((rx, ry, rz), 'XYZ').to_matrix().to_4x4() @ Matrix.Scale(scale, 4)
    for o in objs:
        o.matrix_world = mtx @ o.matrix_world
    bpy.context.view_layer.update()
    return objs


def paint(ob, mats, fn):
    """Assign materials per face: fn(world_centre, polygon) -> index into mats."""
    bpy.context.view_layer.update()
    me = ob.data
    me.materials.clear()
    for m in mats:
        me.materials.append(m)
    mw = ob.matrix_world
    for p in me.polygons:
        p.material_index = fn(mw @ p.center, p)
    return ob


def flat(ob):
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


# ------------------------------------------------------------------ shapes

def blob(name, lobes, mats, k=0.3, sub=3, center=None, stretch=None, bump=0.0, bump_freq=1.3, seed=0,
         floor=None, lobe_mat=None, dec=None):
    """Smooth-union cluster of spheres/ellipsoids, sphere-traced from `center` onto an icosphere.

    lobes: [(x, y, z, r)] or [(x, y, z, (rx, ry, rz))]. mats: material names. lobe_mat: per-lobe
    index into mats (colour clumps). floor: flatten everything below this z. dec: decimate ratio.
    """
    L = [(Vector(l[:3]), l[3]) for l in lobes]
    c = Vector(center) if center else sum((l[0] for l in L), Vector()) / len(L)

    def sdf(p):
        d = 1e9
        for lc, r in L:
            d = smin(d, _sd(p, lc, r), k)
        return d

    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub + 1, radius=1.0)  # 4.5: n=3 -> 320 faces
    rmax = max((lc - c).length + (max(r) if isinstance(r, (tuple, list)) else r) for lc, r in L)
    tmax = rmax * 1.25 + k
    off = Vector((seed * 1.7, seed * 3.1, seed * 5.3))
    for v in bm.verts:
        u = v.co.normalized()
        if stretch:
            u = Vector((u.x * stretch[0], u.y * stretch[1], u.z * stretch[2])).normalized()
        t = tmax
        for _ in range(120):
            s = sdf(c + u * t)
            if s < 1e-3:
                break
            t -= max(s * 0.85, 2e-3)
            if t <= 0:
                t = 0
                break
        p = c + u * t
        if bump:
            p = p + u * noise.noise(p * bump_freq + off) * bump
        if floor is not None and p.z < floor:
            p.z = floor + (p.z - floor) * 0.04
        v.co = p
    ob = from_bmesh(name, bm, M(mats[0]), smooth_angle=85)
    if dec:
        decimate(ob, dec)
        shade(ob, 85)
    if lobe_mat and len(mats) > 1:
        def pick(pc, poly):
            best, bi = 1e9, 0
            for i, (lc, r) in enumerate(L):
                d = _sd(pc, lc, r)
                if d < best:
                    best, bi = d, i
            return lobe_mat[bi]
        paint(ob, [M(m) for m in mats], pick)
    ob_sdf[ob.name] = (sdf, c)
    return ob


ob_sdf = {}


def clumps(prefix, groups, k=0.2, sub=3, bump=0.04, seed=0, floor=None, stretch=None, dec=None):
    """Several blobs (one per material group) that intersect with clean creases: [(material, lobes, sub?)]."""
    out = []
    for i, g in enumerate(groups):
        mat, lobes = g[0], g[1]
        s_ = g[2] if len(g) > 2 else sub
        out.append(blob(f'{prefix} clump', lobes, [mat], k=k, sub=s_, bump=bump, seed=seed + i, floor=floor,
                        stretch=stretch, dec=dec))
    return out


def chunk_rock(name, loc, size, seed, npts=18, bevel=0.1, segments=2, flat_bottom=0.35, material='Island Rock',
               smooth=32):
    """Chunky faceted boulder: convex hull of jittered ellipsoid points with bevelled edges."""
    rng = random.Random(seed)
    bm = bmesh.new()
    for i in range(npts):
        z = -1 + 2 * (i + rng.random() * 0.8) / npts
        a = i * 2.39996 + rng.random() * 0.5
        r = math.sqrt(max(0.0, 1 - z * z))
        rad = rng.uniform(0.82, 1.06)
        bm.verts.new((r * math.cos(a) * size[0] * rad, r * math.sin(a) * size[1] * rad, z * size[2] * rad))
    ret = bmesh.ops.convex_hull(bm, input=list(bm.verts))
    junk = [g for g in ret['geom_interior'] + ret['geom_unused'] if isinstance(g, bmesh.types.BMVert)]
    if junk:
        bmesh.ops.delete(bm, geom=junk, context='VERTS')
    fz = -flat_bottom * size[2]
    for v in bm.verts:
        if v.co.z < fz:
            v.co.z = fz
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=size[2] * 0.02)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(4), verts=list(bm.verts), edges=list(bm.edges))
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, offset_type='OFFSET', segments=segments, profile=0.5,
                    affect='EDGES', clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bmesh(name, bm, M(material), loc=(loc[0], loc[1], loc[2] - fz - 0.05),
                      smooth_angle=smooth if segments > 1 else 50)


def cap(name, ob, select, material, thickness=0.08, offset=0.01):
    """Duplicate the faces select(world_centre, poly) of ob into a solidified cap (moss, snow)."""
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.transform(mw)
    bm.normal_update()
    keep = [f for f in bm.faces if select(f.calc_center_median(), f)]
    drop = [f for f in bm.faces if f not in set(keep)]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    for v in bm.verts:
        v.co += v.normal * offset
    new = from_bmesh(name, bm, M(material), smooth_angle=60)
    mod = new.modifiers.new('Solidify', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_rim = True
    mod.use_even_offset = True
    apply_mods(new)
    shade(new, 60)
    return new


def surface_point(ob_name, direction):
    """Point on a blob surface along direction from its centre (for decorating)."""
    sdf, c = ob_sdf[ob_name]
    u = Vector(direction).normalized()
    t = 20.0
    for _ in range(200):
        s = sdf(c + u * t)
        if s < 1e-3:
            break
        t -= max(s * 0.85, 2e-3)
    p = c + u * t
    eps = 1e-3
    n = Vector((sdf(p + Vector((eps, 0, 0))) - sdf(p - Vector((eps, 0, 0))),
                sdf(p + Vector((0, eps, 0))) - sdf(p - Vector((0, eps, 0))),
                sdf(p + Vector((0, 0, eps))) - sdf(p - Vector((0, 0, eps))))).normalized()
    return p, n


def lathe_fn(name, profile, material, seg=32, fn=None, smooth_angle=50, cap=True):
    """Lathe with per-vertex shaping fn(theta, ring_index, r, z) -> (r, z)."""
    bm = bmesh.new()
    rings = []
    for i, (r, z) in enumerate(profile):
        if r <= 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
            continue
        ring = []
        for j in range(seg):
            th = TAU * j / seg
            rr, zz = fn(th, i, r, z) if fn else (r, z)
            ring.append(bm.verts.new((rr * math.cos(th), rr * math.sin(th), zz)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for j in range(seg):
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[(j + 1) % seg]))
            elif len(b) == 1:
                bm.faces.new((a[j], b[0], a[(j + 1) % seg]))
            else:
                bm.faces.new((a[j], b[j], b[(j + 1) % seg], a[(j + 1) % seg]))
    if cap:
        for ring in (rings[0], rings[-1]):
            if len(ring) > 1:
                bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bmesh(name, bm, M(material) if isinstance(material, str) else material,
                      smooth_angle=smooth_angle)


def loft(name, sections, material, cap=True, smooth_angle=50):
    """Bridge closed cross-sections (lists of equal length) in order."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in s] for s in sections]
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], b[i], b[j], a[j]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bmesh(name, bm, M(material) if isinstance(material, str) else material,
                      smooth_angle=smooth_angle)


def outline_flower(n, R, inner=0.45, pts=6, fat=0.55, phase=0.0):
    out = []
    total = n * pts
    for i in range(total):
        th = TAU * i / total + phase
        petal = abs(math.cos(n * (th - phase) / 2)) ** fat
        rr = R * (inner + (1 - inner) * petal)
        out.append((rr * math.cos(th), rr * math.sin(th)))
    return out


def outline_star(n, R, r, phase=math.pi / 2):
    out = []
    for i in range(n * 2):
        th = phase + math.pi * i / n
        rr = R if i % 2 == 0 else r
        out.append((rr * math.cos(th), rr * math.sin(th)))
    return out


def disc_shape(name, outline, depth, material, loc, normal=(0, -1, 0), spin=0.0, bevel=0.012, segments=1):
    """Extrude a 2D outline as a thin plate and turn its face toward `normal`."""
    ob = extrude(name, outline, depth, M(material), bevel=bevel, segments=segments, plane='XY')
    if bevel <= 0:
        shade(ob, 40)
    q = Vector(normal).normalized().to_track_quat('Z', 'Y')
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = q @ Euler((0, 0, spin)).to_quaternion()
    ob.location = loc
    return ob


def frond(name, root, direction, length, width, material, droop=0.45, lift=0.25, segs=14, serr=0.5,
          fold=0.18):
    """Serrated palm frond: zig-zag leaflet edges along a drooping rib (double-sided material)."""
    d = Vector(direction)
    d.z = 0
    d.normalize()
    side = d.cross(Vector((0, 0, 1))).normalized()
    bm = bmesh.new()
    rows = []
    for i in range(segs + 1):
        t = i / segs
        w = width * math.sin(math.pi * min(1.0, t * 1.05 + 0.06)) ** 0.7
        if i % 2 == 1:
            w *= serr
        ctr = Vector(root) + d * (length * t) + Vector((0, 0, lift * length * t - droop * length * t * t))
        up = Vector((0, 0, 1))
        rows.append([bm.verts.new(ctr - side * w / 2 - up * fold * w), bm.verts.new(ctr + up * fold * w * .35),
                     bm.verts.new(ctr + side * w / 2 - up * fold * w)])
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], b[0], b[1], a[1]))
        bm.faces.new((a[1], b[1], b[2], a[2]))
    return from_bmesh(name, bm, M(material), smooth_angle=80)


def roof_side(name, run, rise, length, material, rows=5, step=0.1, thk=0.16, bevel=0.035, segments=1):
    """One side of a gable roof with overlapping tile rows (sawtooth profile) extruded along Y.
    Local frame: eave at x=0,z=0 rising to the ridge at (run, rise)."""
    L = math.hypot(run, rise)
    u = Vector((run / L, rise / L))
    n = Vector((-rise / L, run / L))
    pts = [Vector((0, 0)), u * 0 + n * (thk + step)]
    for i in range(1, rows):
        s = L * i / rows
        pts.append(u * s + n * thk)
        pts.append(u * s + n * (thk + step))
    pts.append(u * L + n * thk)
    pts.append(u * L)
    outline = [(p.x, p.y) for p in pts]
    ob = extrude(name, outline, length, M(material), bevel=bevel, segments=segments, plane='XZ')
    return shade(ob, 50)


def gable_roof(prefix, half_w, eave_z, ridge_z, length, material, overhang=0.4, rows=5, step=0.1, thk=0.16,
               y=0.0, ridge_mat=None):
    """Two tiled roof sides meeting at a ridge along Y, plus a round ridge cap."""
    run = half_w + overhang
    slope = (ridge_z - eave_z) / half_w
    rise = slope * run
    z0 = ridge_z - rise
    out = []
    for sgn in (-1, 1):
        o = roof_side(f'{prefix} roof', run, rise, length, material, rows, step, thk)
        if sgn < 0:
            o.location = (-run, y, z0)
        else:
            o.rotation_euler = (0, 0, math.pi)
            o.location = (run, y, z0)
        out.append(o)
    cap = cyl(f'{prefix} ridge', thk * 0.95, length + 0.1, (0, y, ridge_z + thk * 0.75), M(ridge_mat or material),
              verts=12, bevel=0.04, rot=(math.pi / 2, 0, 0))
    out.append(cap)
    return out


def cone_roof(name, r_eave, z_eave, z_apex, material, rows=5, step=0.1, thk=0.16, seg=32, curve=1.0, fn=None,
              tip=0.0, mid=None):
    """Conical roof with overlapping tile rows (sawtooth lathe). curve>1 flares the eaves (pagoda/tent),
    curve<1 bulges it (dome-like). tip>0 leaves a flat top of that radius for a finial."""
    H = z_apex - z_eave

    def P(s):
        return Vector((tip + (r_eave - tip) * (1 - s) ** curve, z_eave + H * s))

    def N(s):
        a, b = P(max(s - 0.01, 0)), P(min(s + 0.01, 1))
        d = (b - a).normalized()
        return Vector((d.y, -d.x))

    prof = [(0.0, z_apex + thk)]
    if tip > 0:
        prof.append((tip, z_apex + thk))
    for i in reversed(range(rows)):
        s_lo, s_hi = i / rows, (i + 1) / rows
        if i < rows - 1:
            p = P(s_hi) + N(s_hi) * thk
            prof.append((p.x, p.y))
        if (curve != 1.0) if mid is None else mid:
            sm = (s_lo + s_hi) / 2
            p = P(sm) + N(sm) * (thk + step * 0.5)
            prof.append((p.x, p.y))
        p = P(s_lo) + N(s_lo) * (thk + step)
        prof.append((p.x, p.y))
    e = P(0)
    prof.append((e.x + 0.01, e.y - 0.02))
    prof.append((e.x * 0.86, e.y + 0.01))
    prof.append((0.0, e.y + 0.02))
    return lathe_fn(name, prof, material, seg=seg, fn=fn, smooth_angle=35)


def ring_band(name, r, z, h, material, seg=32, thick=0.08):
    """A chunky rounded band around a round wall."""
    prof = [(r - 0.02, z - h / 2), (r + thick * 0.7, z - h / 2), (r + thick, z - h / 4), (r + thick, z + h / 4),
            (r + thick * 0.7, z + h / 2), (r - 0.02, z + h / 2)]
    return lathe_fn(name, prof, material, seg=seg, smooth_angle=60, cap=False)


# ------------------------------------------------------------------ building details

def frame_ring(name, wo, ho, wi, hi, depth, material, y0=0.0, zc=0.0):
    """Rectangular picture frame (outer wo x ho, hole wi x hi) facing -Y, back face open against the wall at y0.
    One 40-vertex mesh instead of four bevelled boxes."""
    bm = bmesh.new()
    yf, yb = y0 - depth, y0
    O = [(-wo / 2, -ho / 2), (wo / 2, -ho / 2), (wo / 2, ho / 2), (-wo / 2, ho / 2)]
    I = [(-wi / 2, -hi / 2), (wi / 2, -hi / 2), (wi / 2, hi / 2), (-wi / 2, hi / 2)]
    of = [bm.verts.new((x, yf, z + zc)) for x, z in O]
    ob_ = [bm.verts.new((x, yb, z + zc)) for x, z in O]
    inf = [bm.verts.new((x, yf, z + zc)) for x, z in I]
    inb = [bm.verts.new((x, yb, z + zc)) for x, z in I]
    for k in range(4):
        k2 = (k + 1) % 4
        bm.faces.new((of[k], of[k2], inf[k2], inf[k]))
        bm.faces.new((ob_[k], ob_[k2], of[k2], of[k]))
        bm.faces.new((inf[k], inf[k2], inb[k2], inb[k]))
    return from_bmesh(name, bm, M(material), smooth_angle=30)


def quad(name, w, h, material, loc=(0, 0, 0), rz=0.0):
    """Single front-facing (-Y) quad, e.g. a window pane (4 vertices)."""
    bm = bmesh.new()
    v = [bm.verts.new((x, 0, z)) for x, z in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
    bm.faces.new(v)
    return from_bmesh(name, bm, M(material), loc=loc, rot=(0, 0, rz), smooth_angle=30)


def disc_y(name, r, material, loc=(0, 0, 0), verts=12):
    """Flat disc facing -Y (n-gon), e.g. a round pane."""
    bm = bmesh.new()
    vs = [bm.verts.new((r * math.cos(-TAU * i / verts), 0, r * math.sin(-TAU * i / verts))) for i in range(verts)]
    f = bm.faces.new(vs)
    bm.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    return from_bmesh(name, bm, M(material), loc=loc, smooth_angle=30)


def window(prefix, w, h, shutters=None, flowers=None, arch=False, cross=True, frame='Trim White', sill=True,
           box_mat='Wood'):
    """Toy window centred at the origin on a wall plane y=0 facing -Y (build then place())."""
    t, d = 0.13, 0.18
    objs = [quad(f'{prefix} glass', w + 0.02, h + 0.02, 'Window Glow', loc=(0, -0.02, 0))]
    if arch:
        objs.append(frame_ring(f'{prefix} frame', w + 2 * t, h + t, w, h, d, frame, zc=-t / 2))
        objs.append(disc_y(f'{prefix} ag', w / 2 + 0.01, 'Window Glow', loc=(0, -0.02, h / 2), verts=12))
        objs.append(torus(f'{prefix} af', w / 2 + t / 2, t * 0.6, (0, -d / 2, h / 2), M(frame), maj=12, mn=4,
                          rot=(math.pi / 2, 0, 0), arc=0.5))
    else:
        objs.append(frame_ring(f'{prefix} frame', w + 2 * t, h + 2 * t, w, h, d, frame))
    if cross:
        objs.append(box(f'{prefix} mv', (0.07, 0.08, h), (0, -0.07, 0), M(frame), bevel=0.0))
        objs.append(box(f'{prefix} mh', (w, 0.08, 0.07), (0, -0.07, 0.05 * h), M(frame), bevel=0.0))
    if sill:
        objs.append(box(f'{prefix} sill', (w + 0.42, 0.32, 0.1), (0, -0.14, -h / 2 - t - 0.03), M(frame),
                        bevel=0.03, segments=1))
    if shutters:
        sw = w * 0.52
        for sx in (-1, 1):
            objs.append(box(f'{prefix} sh', (sw, 0.08, h + 0.1), (sx * (w / 2 + t + sw / 2 + 0.03), -0.03, 0),
                            M(shutters), bevel=0.025, segments=1))
    if flowers:
        bz = -h / 2 - t - 0.27
        objs.append(box(f'{prefix} fbox', (w + 0.3, 0.32, 0.3), (0, -0.2, bz), M(box_mat), bevel=0.0))
        objs.append(sphere(f'{prefix} leaves', ((w + 0.24) / 2, 0.19, 0.15), (0, -0.2, bz + 0.16), M('Foliage'),
                           seg=8, rings=4))
        n = max(3, int(w / 0.25))
        for i in range(n):
            fx = -w / 2 + 0.05 + (w - 0.1) * i / max(n - 1, 1)
            objs.append(sphere(f'{prefix} bud', 0.1, (fx, -0.32 + (i % 2) * 0.06, bz + 0.3 + (i % 2) * 0.05),
                               M(flowers[i % len(flowers)]), seg=6, rings=3))
    return objs


def door(prefix, w, h, paint='Paint Cherry', frame='Trim White', knob='Gold Trim', porthole=True, arch=True,
         step=True):
    """Arched toy door centred at x=0, bottom at z=0, on wall plane y=0 facing -Y."""
    objs = []
    body_h = h - w / 2 if arch else h
    objs.append(box(f'{prefix} slab', (w, 0.14, body_h), (0, -0.03, body_h / 2), M(paint), bevel=0.03, segments=1))
    if arch:
        objs.append(cyl(f'{prefix} top', w / 2, 0.14, (0, -0.03, body_h), M(paint), verts=12,
                        rot=(math.pi / 2, 0, 0)))
        objs.append(torus(f'{prefix} arch', w / 2 + 0.07, 0.085, (0, -0.08, body_h), M(frame), maj=12, mn=4,
                          rot=(math.pi / 2, 0, 0), arc=0.5))
    else:
        objs.append(box(f'{prefix} lintel', (w + 0.3, 0.2, 0.14), (0, -0.07, h + 0.07), M(frame), bevel=0.03,
                        segments=1))
    for sx in (-1, 1):
        objs.append(box(f'{prefix} jamb', (0.14, 0.2, body_h), (sx * (w / 2 + 0.07), -0.08, body_h / 2), M(frame),
                        bevel=0.03, segments=1))
    objs.append(sphere(f'{prefix} knob', 0.075, (w * 0.3, -0.13, body_h * 0.48), M(knob), seg=8, rings=4))
    if porthole:
        objs.append(disc_y(f'{prefix} ph', w * 0.2, 'Window Glow', loc=(0, -0.105, body_h * 0.84), verts=10))
        objs.append(torus(f'{prefix} phr', w * 0.2 + 0.03, 0.035, (0, -0.11, body_h * 0.84), M('Gold Trim'),
                          maj=10, mn=4, rot=(math.pi / 2, 0, 0)))
    if step:
        objs.append(box(f'{prefix} step', (w + 0.7, 0.6, 0.18), (0, -0.3, 0.09), M('Stone'), bevel=0.04,
                        segments=1))
    return objs


def round_window(prefix, r, frame='Trim White'):
    """Round attic/porthole window at the origin facing -Y."""
    return [disc_y(f'{prefix} g', r + 0.02, 'Window Glow', loc=(0, -0.01, 0), verts=14),
            torus(f'{prefix} f', r + 0.06, 0.08, (0, -0.06, 0), M(frame), maj=14, mn=4, rot=(math.pi / 2, 0, 0)),
            box(f'{prefix} x1', (2 * r, 0.08, 0.06), (0, -0.05, 0), M(frame), bevel=0.0),
            box(f'{prefix} x2', (0.06, 0.08, 2 * r), (0, -0.05, 0), M(frame), bevel=0.0)]


def petal_disc(name, n, R, material, loc, normal=(0, -1, 0), inner=0.4, pts=3, fat=0.6, thick=0.05, cup=0.0,
               spin=0.0):
    """Smooth lens-shaped petal ring (one shared-vertex mesh): n rounded petals, optional cupping."""
    seg = n * pts

    def fn(th, i, r, z):
        petal = abs(math.cos(n * (th - spin) / 2)) ** fat
        f = inner + (1 - inner) * petal
        return r * f, z + cup * (r / R) ** 2 * f
    prof = [(0.0, thick * 0.6), (R * 0.6, thick * 0.4), (R, 0.0), (0.0, -thick * 0.5)]
    ob = lathe_fn(name, prof, material, seg=seg, fn=fn, smooth_angle=89, cap=False)
    q = Vector(normal).normalized().to_track_quat('Z', 'Y')
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = q
    ob.location = loc
    return ob


def flower(prefix, loc, normal, R, petal, heart='Flower Heart', n=5, depth=0.05, stem_to=None, stem_mat='Foliage',
           pts=3, bevel=0.0):
    """Toy flower head (smooth petal disc + domed heart), optional stem down to stem_to."""
    nv = Vector(normal).normalized()
    objs = [petal_disc(f'{prefix} petals', n, R, petal, loc, nv, inner=0.35, pts=pts, thick=depth, cup=R * 0.12,
                       spin=random.random() * TAU)]
    objs.append(sphere(f'{prefix} heart', (R * 0.36, R * 0.36, R * 0.22), Vector(loc) + nv * depth * 0.5, M(heart),
                       seg=8, rings=4, rot=nv.to_track_quat('Z', 'Y').to_euler()))
    if stem_to is not None:
        a = Vector(stem_to)
        b = Vector(loc) - nv * depth
        mid = (a + b) / 2 + Vector((0, 0, 0.05))
        objs.append(tube(f'{prefix} stem', [a, (a + mid) / 2, mid, b], R * 0.12, M(stem_mat), verts=5))
    return objs


def note_shape(prefix, loc, size, material, facing=0.0, flag_mat=None, flat_shade=False):
    """Chunky eighth note (head, stem, curled flag) in the XZ plane facing -Y; loc = centre of the head.
    size = overall height. Returns world-space parts."""
    h = size
    hr = h * 0.2
    objs = [sphere(f'{prefix} head', (hr * 1.3, hr * 0.62, hr), (0, 0, 0), M(material), seg=12, rings=6,
                   rot=(0, -0.45, 0))]
    sx = hr * 1.05
    objs.append(box(f'{prefix} stem', (h * 0.07, h * 0.08, h * 0.8), (sx, 0, h * 0.4), M(material), bevel=h * 0.02,
                    segments=1))
    flag = [(0, 0), (h * 0.09, -h * 0.02), (h * 0.3, -h * 0.16), (h * 0.36, -h * 0.34), (h * 0.3, -h * 0.5),
            (h * 0.24, -h * 0.42), (h * 0.26, -h * 0.3), (h * 0.12, -h * 0.2), (0, -h * 0.18)]
    objs.append(extrude(f'{prefix} flag', [(sx + u - h * 0.03, h * 0.8 + v) for u, v in flag], h * 0.07,
                        M(flag_mat or material), bevel=h * 0.015, segments=1))
    shade(objs[-1], 50)
    if flat_shade:
        for o in objs:
            flat(o)
    return place(objs, loc, rz=facing)


# ------------------------------------------------------------------ finishing

def gradient(ob, z0, z1, lo=(0.8, 0.82, 0.9), hi=(1.0, 1.0, 1.0), power=1.0):
    """Multiply a vertical colour gradient into the baked COLOR_0 (kept <= 1)."""
    me = ob.data
    attr = me.color_attributes.get('Color')
    if attr is None:
        return ob
    mw = ob.matrix_world
    zs = [(mw @ v.co).z for v in me.vertices]
    for li, loop in enumerate(me.loops):
        t = clamp01((zs[loop.vertex_index] - z0) / (z1 - z0)) ** power
        c = attr.data[li].color
        f = [lerp(lo[i], hi[i], t) for i in range(3)]
        attr.data[li].color = (c[0] * f[0], c[1] * f[1], c[2] * f[2], 1.0)
    return ob


def finish(root, parts, pivots=(), ground=0.0, ao=0.6, strength=0.7, rays=40, grads=None, min_ao=0.3):
    """Parent, join per material (static and per pivot), bake AO and apply gradients.

    parts: static world-space meshes. pivots: [(pivot_empty, [meshes])]. grads: {material: (z0, z1, lo, hi)}.
    """
    parts = [o for o in parts if o is not None]
    for o in parts:
        set_parent(o, root)
    joined = join_by_material(parts, root.name) if parts else []
    for pv, obs in pivots:
        obs = [o for o in obs if o is not None]
        for o in obs:
            set_parent(o, pv)
        joined += join_by_material(obs, pv.name)
    bpy.context.view_layer.update()
    for o in joined:  # bake each mesh into its parent's frame: identity mesh nodes and tight bounding boxes
        pw = o.parent.matrix_world if o.parent else Matrix.Identity(4)
        o.data.transform(pw.inverted() @ o.matrix_world)
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    recv = [o for o in joined if not is_glow(o)]
    glows = [o for o in joined if is_glow(o)]
    if recv:
        bake_ao(recv, rays=rays, distance=ao, strength=strength, ground=ground, extra_occluders=glows,
                min_value=min_ao)
    for o in recv:
        for m in o.data.materials:
            if grads and m.name in grads:
                z0, z1, lo, hi = grads[m.name]
                gradient(o, z0, z1, lo, hi)
                break
    return root


def tri_count(root):
    n = 0
    for o in [root] + list(root.children_recursive):
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


def bounds(root):
    """World-space bounds from vertices (bound_box can be stale after joins)."""
    bpy.context.view_layer.update()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in [root] + list(root.children_recursive):
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            lo = Vector((min(lo.x, p.x), min(lo.y, p.y), min(lo.z, p.z)))
            hi = Vector((max(hi.x, p.x), max(hi.y, p.y), max(hi.z, p.z)))
    return lo, hi


def contour_cut(bm, level, warp=None):
    """Split a bmesh along the (optionally noise-warped) contour z=level so colour bands get clean edges.
    warp(x, y) -> dz is added before the cut and removed after."""
    if warp:
        for v in bm.verts:
            v.co.z += warp(v.co.x, v.co.y)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-4, plane_co=(0, 0, level), plane_no=(0, 0, 1))
    if warp:
        for v in bm.verts:
            v.co.z -= warp(v.co.x, v.co.y)
