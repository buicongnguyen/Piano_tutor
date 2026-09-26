"""Stillnote Encore character builders: Coda, the Hush and the Encore airship.

Shared by build_characters.py (neutral poses -> public/models/characters.glb) and
render_portraits.py (expression variants for the dialogue portraits and the key art).
Everything is procedural and deterministic. Blender is Z-up and every asset faces -Y.

Face features are projected onto a dense proxy of each head (ray casts along +Y), so
eyes, cheeks, mouths and brows sit on the curved surface at any size.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import aaa_kit as K
from palette import toy

TAU = math.tau


# ================================================================ materials

def mats():
    """All character materials (cached by name inside aaa_kit.MATS)."""
    return dict(
        # Coda
        coda=toy('Coda Gold', 'coda', 'gloss'),
        coda_deep=toy('Coda Amber', 'coda_deep', 'gloss'),
        flag=toy('Coda Flag', 'coda_flag', 'gloss'),
        wing=toy('Coda Wing', 'ivory', 'gloss'),
        # shared face kit
        eye=toy('Char Eye', 'eye', 'glass'),
        iris=toy('Char Iris', '#3a3fa8', 'glass'),
        shine=toy('Char Eye Shine', '#ffffff', 'glass'),
        cheek=toy('Char Blush', 'cheek', 'satin'),
        mouth=toy('Char Mouth', '#9c1b3f', 'gloss'),
        teeth=toy('Char Teeth', '#ffffff', 'gloss'),
        ink=toy('Char Ink', 'eye', 'satin'),
        # Hush
        hush=toy('Hush Cloud', 'hush', 'satin'),
        hush_deep=toy('Hush Shade', 'hush_deep', 'satin'),
        cap=toy('Hush Cap', 'hush_cap', 'satin'),
        cap2=toy('Hush Cap Stripe', 'navy', 'satin'),
        brim=toy('Hush Cap Trim', 'ivory', 'matte'),
        star=toy('Hush Star', 'sunshine', 'gloss'),
        tear=toy('Hush Tear', 'ice', 'glass'),
        # Encore ship
        lacquer=toy('Ship Lacquer', 'cherry', 'gloss'),
        trim=toy('Ship Gold Trim', 'gold', 'metal'),
        brass=toy('Ship Brass', 'brass', 'metal'),
        ivory=toy('Ship Ivory', 'ivory', 'gloss'),
        ebony=toy('Ship Ebony', 'ebony', 'gloss'),
        stripe=toy('Ship Sail Stripe', 'sunshine', 'gloss'),
        board=toy('Ship Soundboard', 'wood', 'satin'),
        cream=toy('Ship Balloon Cream', 'ivory', 'satin'),
        rope=toy('Ship Rope', 'sand', 'matte'),
        window=toy('Ship Window Glow', 'window_glow', 'gloss', emit=2.2),
        pen_sky=toy('Ship Pennant Sky', 'sky', 'satin', double=True),
        pen_lime=toy('Ship Pennant Lime', 'lime', 'satin', double=True),
        pen_violet=toy('Ship Pennant Violet', 'violet', 'satin', double=True),
        pen_orange=toy('Ship Pennant Tangerine', 'tangerine', 'satin', double=True),
    )


# ================================================================ generic helpers

def rot_about(point, angle, axis):
    p = Vector(point)
    return Matrix.Translation(p) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-p)


def bake_matrix(ob, W):
    """Apply a world-space matrix to an object's mesh (its transform is kept)."""
    bpy.context.view_layer.update()
    mw = ob.matrix_world.copy()
    ob.data.transform(mw.inverted() @ W @ mw)
    ob.data.update()
    return ob


def set_origin(ob, point):
    """Move an object's origin to a world point without moving its geometry."""
    bpy.context.view_layer.update()
    local = ob.matrix_world.inverted() @ Vector(point)
    ob.data.transform(Matrix.Translation(-local))
    ob.matrix_world = ob.matrix_world @ Matrix.Translation(local)
    return ob


def frame(n, roll=0.0, up=(0, 0, 1)):
    """3x3 basis whose -Y looks along the outward normal n and whose Z is as close to `up` as possible."""
    y = -Vector(n).normalized()
    u = Vector(up)
    z = (u - u.dot(y) * y)
    if z.length < 1e-5:
        z = Vector((0, 0, 1)) - Vector((0, 0, 1)).dot(y) * y
    z.normalize()
    x = y.cross(z)
    M = Matrix((x, y, z)).transposed()
    if roll:
        M = M @ Matrix.Rotation(roll, 3, 'Y')
    return M


def basis(u, v):
    """3x3 matrix mapping local X->u, Y->v, Z->u x v (u, v orthonormalised)."""
    u = Vector(u).normalized()
    v = Vector(v)
    v = (v - v.dot(u) * u).normalized()
    return Matrix((u, v, u.cross(v))).transposed()


def spline(points, n=6, closed=False):
    """Uniform Catmull-Rom through 2D or 3D points."""
    Pn = [Vector(p) for p in points]
    m = len(Pn)
    out = []
    segs = m if closed else m - 1
    for i in range(segs):
        p1, p2 = Pn[i % m], Pn[(i + 1) % m]
        p0 = Pn[(i - 1) % m] if (closed or i > 0) else p1 * 2 - p2
        p3 = Pn[(i + 2) % m] if (closed or i + 2 < m) else p2 * 2 - p1
        for k in range(n):
            t = k / n
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(Pn[-1].copy())
    return out


def area2(pts):
    return sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1])) / 2


def ccw(pts):
    pts = [Vector((p[0], p[1])) for p in pts]
    return pts if area2(pts) > 0 else list(reversed(pts))


def offset_poly(pts, d):
    """Offset a CCW polygon inward by d (negative grows it). Mitred, clamped at sharp corners."""
    n = len(pts)
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e1, e2 = (p1 - p0), (p2 - p1)
        if e1.length < 1e-9 or e2.length < 1e-9:
            out.append(p1.copy())
            continue
        e1.normalize(); e2.normalize()
        n1, n2 = Vector((-e1.y, e1.x)), Vector((-e2.y, e2.x))
        m = n1 + n2
        m = m.normalized() if m.length > 1e-6 else n1
        out.append(p1 + m * (d / max(m.dot(n1), 0.35)))
    return out


def clip_poly(pts, sd):
    """Sutherland-Hodgman clip: keep the part where sd(p) >= 0."""
    out = []
    n = len(pts)
    for i in range(n):
        a, b = Vector(pts[i]), Vector(pts[(i + 1) % n])
        da, db = sd(a), sd(b)
        if da >= 0:
            out.append(a)
        if (da >= 0) != (db >= 0):
            out.append(a + (b - a) * (da / (da - db)))
    return out


def resample(pts, step, closed=True):
    """Evenly respace a polyline so lofts and tubes get uniform detail."""
    P2 = [Vector(p) for p in pts] + ([Vector(pts[0])] if closed else [])
    L = [0.0]
    for a, b in zip(P2, P2[1:]):
        L.append(L[-1] + (b - a).length)
    total = L[-1]
    n = max(3, int(round(total / step)))
    out, j = [], 0
    for i in range(n if closed else n + 1):
        s = total * i / n
        while j < len(L) - 2 and L[j + 1] < s:
            j += 1
        seg = L[j + 1] - L[j]
        t = 0 if seg < 1e-9 else (s - L[j]) / seg
        out.append(P2[j].lerp(P2[j + 1], t))
    return out


def ellipse(rx, ry, n=20, cx=0.0, cy=0.0):
    return [(cx + rx * math.cos(TAU * i / n), cy + ry * math.sin(TAU * i / n)) for i in range(n)]


def star_outline(r_out, r_in, points=5, rot=90.0):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot) + math.pi * i / points
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def slab_profile(t, b, segs=3):
    """(inset, z) rings of a slab of thickness t with rounded rims of radius b, centred on z=0."""
    prof = []
    for k in range(segs + 1):
        a = math.pi / 2 * k / segs
        prof.append((b * (1 - math.sin(a)), b * (1 - math.cos(a)) - t / 2))
    for k in range(segs + 1):
        a = math.pi / 2 * k / segs
        prof.append((b * (1 - math.cos(a)), t / 2 - b * (1 - math.sin(a))))
    return prof


def loft(name, outline, profile, materials, cap_top_mat=None, cap_bottom_mat=None, parent=None,
         smooth_angle=50, caps=True):
    """Loft a CCW outline (XY) through (inset, z[, mat]) rings. Bands take the upper ring's material."""
    outline = ccw(outline)
    bm = bmesh.new()
    rings = []
    for pr in profile:
        inset, z = pr[0], pr[1]
        pts = offset_poly(outline, inset) if abs(inset) > 1e-9 else outline
        rings.append([bm.verts.new((p[0], p[1], z)) for p in pts])
    N = len(outline)
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        mi = profile[k + 1][2] if len(profile[k + 1]) > 2 else 0
        for i in range(N):
            f = bm.faces.new((a[i], a[(i + 1) % N], b[(i + 1) % N], b[i]))
            f.material_index = mi
    if caps:
        f = bm.faces.new(list(reversed(rings[0])))
        f.material_index = cap_bottom_mat if cap_bottom_mat is not None else (profile[0][2] if len(profile[0]) > 2 else 0)
        f = bm.faces.new(rings[-1])
        f.material_index = cap_top_mat if cap_top_mat is not None else (profile[-1][2] if len(profile[-1]) > 2 else 0)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = K.from_bmesh(name, bm, None, parent=None, smooth_angle=smooth_angle)
    for m in materials:
        ob.data.materials.append(m)
    if parent is not None:
        K.set_parent(ob, parent)
    return ob


def shape2d(name, outline, thickness, bevel, material, W=Matrix.Identity(4), segs=2, parent=None,
            bend=None, smooth_angle=50):
    """A rounded slab from a 2D outline (built in XY, thickness along Z), then placed by world matrix W.
    bend(x, y) -> z offset curves the slab before placement."""
    ob = loft(name, outline, [(i, z, 0) for i, z in slab_profile(thickness, bevel, segs)], [material],
              smooth_angle=smooth_angle)
    if bend:
        for v in ob.data.vertices:
            v.co.z += bend(v.co.x, v.co.y)
    ob.data.transform(W)
    ob.data.update()
    if parent is not None:
        K.set_parent(ob, parent)
    return ob


def assign_by(ob, mats_list, fn):
    """Give each polygon a material index from fn(polygon_center_local)."""
    me = ob.data
    for m in mats_list:
        if m.name not in [x.name for x in me.materials]:
            me.materials.append(m)
    names = [x.name for x in me.materials]
    for p in me.polygons:
        p.material_index = names.index(mats_list[fn(p.center)].name)
    return ob


def uv_sphere_bm(seg, rings):
    """Deterministic unit UV sphere. bmesh.ops.create_uvsphere welds its poles with a threaded merge, so its
    face winding (and therefore the exported index buffer and COLOR_0 order) varies from run to run."""
    bm = bmesh.new()
    top = bm.verts.new((0.0, 0.0, 1.0))
    rows = []
    for i in range(1, rings):
        phi = math.pi * i / rings
        z, r = math.cos(phi), math.sin(phi)
        rows.append([bm.verts.new((r * math.cos(TAU * j / seg), r * math.sin(TAU * j / seg), z)) for j in range(seg)])
    bot = bm.verts.new((0.0, 0.0, -1.0))
    for j in range(seg):
        k = (j + 1) % seg
        bm.faces.new((top, rows[0][j], rows[0][k]))
        for a, b in zip(rows, rows[1:]):
            bm.faces.new((a[j], b[j], b[k], a[k]))
        bm.faces.new((bot, rows[-1][k], rows[-1][j]))
    return bm


def ball(name, radius, loc=(0, 0, 0), material=None, seg=24, rings=12, rot=(0, 0, 0), parent=None):
    """Drop-in for aaa_kit.sphere built on uv_sphere_bm (deterministic)."""
    r = radius if isinstance(radius, (tuple, list)) else (radius,) * 3
    bm = uv_sphere_bm(seg, rings)
    for v in bm.verts:
        v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
    return K.from_bmesh(name, bm, material, loc=loc, rot=rot, parent=parent, smooth_angle=80)


def capsule(name, a, b, radius, material=None, seg=16, rings=8, parent=None, r2=None):
    """Drop-in for aaa_kit.capsule built on uv_sphere_bm (deterministic)."""
    d = Vector(b) - Vector(a)
    length, rot, mid = d.length, d.to_track_quat('Z', 'Y').to_euler(), (Vector(a) + Vector(b)) / 2
    rb = radius if r2 is None else r2
    bm = uv_sphere_bm(seg, rings * 2)
    for v in bm.verts:
        up = v.co.z >= 0
        rr = rb if up else radius
        v.co = Vector((v.co.x * rr, v.co.y * rr, v.co.z * rr + (length / 2 if up else -length / 2)))
    return K.from_bmesh(name, bm, material, loc=mid, rot=rot, parent=parent, smooth_angle=80)


def tris(objs):
    t = 0
    for o in objs:
        if o.type == 'MESH':
            t += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return t


# ================================================================ surface projection

class Surface:
    """Ray-cast projection onto a (dense) proxy mesh for placing face features."""

    def __init__(self, objs):
        bpy.context.view_layer.update()
        verts, polys = [], []
        for o in objs:
            mw = o.matrix_world
            base = len(verts)
            verts += [mw @ v.co for v in o.data.vertices]
            polys += [[base + i for i in p.vertices] for p in o.data.polygons]
        self.tree = BVHTree.FromPolygons(verts, polys)

    def cast(self, origin, direction):
        o, d = Vector(origin), Vector(direction).normalized()
        loc, nor, _, _ = self.tree.ray_cast(o, d)
        if loc is None:
            raise RuntimeError(f'no surface hit from {tuple(o)} along {tuple(d)}')
        if nor.dot(d) > 0:
            nor = -nor
        return loc, nor

    def front(self, x, z, r=0.0):
        loc, n = self.cast((x, -80, z), (0, 1, 0))
        if r:
            acc = n.copy()
            for dx, dz in ((r, 0), (-r, 0), (0, r), (0, -r)):
                acc += self.cast((x + dx, -80, z + dz), (0, 1, 0))[1]
            n = acc.normalized()
        return loc, n


class FrameSurface(Surface):
    """Projection along a local frame's +Y (e.g. an eye's own axis) instead of world +Y."""

    def __init__(self, objs, center, R):
        super().__init__(objs)
        self.c, self.R = Vector(center), R

    def front(self, x, z, r=0.0):
        o = self.c + self.R @ Vector((x - self.c.x, -10.0, z - self.c.z))
        return self.cast(o, self.R @ Vector((0, 1, 0)))


def patch(name, surf, outline, center, material, lift=0.0015, rise=0.003, wall=0.006, parent=None,
          rings=(1.0, 0.95, 0.8, 0.55, 0.3), smooth_angle=70):
    """A thin conformed decal (cheek, mouth, tongue...) projected onto the surface along +Y.
    outline: [(u, v)] around `center` (x, z). The rim sinks `wall` into the surface."""
    cx, cz = center
    outline = ccw(outline)
    cu = sum(p[0] for p in outline) / len(outline)
    cv = sum(p[1] for p in outline) / len(outline)
    bm = bmesh.new()

    def put(u, v, off):
        loc, n = surf.front(cx + u, cz + v)
        return bm.verts.new(loc + n * off)

    rows = [[put(u, v, -wall) for u, v in outline]]
    for k, s in enumerate(rings):
        off = lift + rise * (0.45 if k == 0 else (0.85 if k == 1 else 1.0))
        rows.append([put(cu + (u - cu) * s, cv + (v - cv) * s, off) for u, v in outline])
    centre = put(cu, cv, lift + rise)
    N = len(outline)
    for a, b in zip(rows, rows[1:]):
        for i in range(N):
            bm.faces.new((a[i], a[(i + 1) % N], b[(i + 1) % N], b[i]))
    for i in range(N):
        bm.faces.new((rows[-1][i], rows[-1][(i + 1) % N], centre))
    bm.normal_update()
    if sum(f.normal.y * f.calc_area() for f in bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return K.from_bmesh(name, bm, material, parent=parent, smooth_angle=smooth_angle)


def stroke(name, surf, pts_xz, radius, material, lift=0.0, taper=0.35, parent=None, verts=7, squash=0.55, n=2):
    """A brush stroke (brow, lash line, closed eye, line mouth) lying on the surface."""
    dense = spline([Vector((x, z)) for x, z in pts_xz], n=n) if len(pts_xz) > 2 else [Vector(p) for p in pts_xz]
    pts = []
    for p in dense:
        loc, nn = surf.front(p.x, p.y, r=radius)
        pts.append(loc + nn * (lift + radius * squash * 0.35))
    fn = (lambda t: taper + (1 - taper) * math.sin(math.pi * min(max(t, 0), 1)) ** 0.5)
    ob = K.tube(name, pts, radius, material, verts=verts, parent=None, radius_fn=fn, squash=squash)
    if parent is not None:
        K.set_parent(ob, parent)
    return ob


# ================================================================ eyes


class Eye:
    """An eye assembly under its blink pivot (identity rotation, origin at the eye centre)."""

    def __init__(self, pivot_name, parent, surf, x, z, rx, rz, rd, M, side, embed=0.4, look=(0.0, 0.0)):
        loc, n = surf.front(x, z, r=rx * 0.5)
        self.R = frame(n)
        self.c = loc - n * (rd * embed)
        self.rx, self.rz, self.rd, self.side, self.M = rx, rz, rd, side, M
        self.surf = surf
        self.pivot = K.empty(pivot_name, self.c, parent)
        self.name = pivot_name.replace('_', ' ')
        self.look = look

    def world(self, local):
        return self.c + self.R @ Vector(local)

    def on_front(self, u, v, lift=0.0):
        """Point on the eye's front surface at normalised (u, v)."""
        w = math.sqrt(max(0.0, 1 - u * u - v * v))
        n_local = Vector((u / self.rx, -w / self.rd, v / self.rz)).normalized()
        p_local = Vector((u * self.rx, -w * self.rd, v * self.rz))
        return self.world(p_local), (self.R @ n_local).normalized()

    def ball(self, iris=True, seg=20, rings=12, iris_size=(0.7, 0.5), iris_v=-0.4):
        M = self.M
        ball(self.name + ' Ball', (self.rx, self.rd, self.rz), self.c, M['eye'], seg=seg, rings=rings,
                 rot=self.R.to_euler(), parent=self.pivot)
        if iris:
            # A jewel-coloured lower iris decal, painted flush onto the glossy eye (clipped to the eye outline).
            proxy = ball('Eye Proxy', (self.rx, self.rd, self.rz), self.c, None, seg=64, rings=40,
                             rot=self.R.to_euler())
            es = FrameSurface([proxy], self.c, self.R)
            bpy.data.objects.remove(proxy, do_unlink=True)
            lu, lv = self.look
            cu, cv = lu * 0.3 * self.rx, (iris_v + lv * 0.3) * self.rz
            out = []
            for u, v in ellipse(iris_size[0] * self.rx, iris_size[1] * self.rz, 22, cu, cv):
                q = math.hypot(u / (0.9 * self.rx), v / (0.9 * self.rz))
                out.append((u / q, v / q) if q > 1 else (u, v))
            k = self.rx / 0.058
            patch(self.name + ' Iris', es, out, (self.c.x, self.c.z), M['iris'], lift=0.0006 * k, rise=0.0012 * k,
                  wall=0.002 * k, parent=self.pivot, rings=(1.0, 0.9, 0.55))
        return self

    def shine(self, big=(-0.36, 0.36, 0.30), small=(0.3, -0.42, 0.13)):
        """White catchlight beads: same side on both eyes (light from the viewer's upper left)."""
        M = self.M
        for tag, (u, v, s) in (('Shine', big), ('Sparkle', small)):
            if s <= 0:
                continue
            lu, lv = self.look
            p, nn = self.on_front(u + lu * 0.3, v + lv * 0.3)
            r = s * self.rx
            ball(f'{self.name} {tag}', (r, r * 0.55, r), p + nn * (r * 0.05), M['shine'], seg=10, rings=5,
                     rot=frame(nn).to_euler(), parent=self.pivot)
        return self

    def lid(self, cover, slope=0.0, lower=False, material=None, lash=0.0, lash_mat=None, grow=1.08,
            depth=1.28):
        """Eyelid shell: an ellipsoid a little bigger than the eye, cut by a (tilted) plane.
        cover 0..1 of the eye height; slope > 0 lifts the outer corner (determined), < 0 drops it (sad)."""
        if cover <= 0:
            return None
        rx, rz, rd = self.rx * grow, self.rz * grow, self.rd * depth
        bm = uv_sphere_bm(22, 14)
        for v in bm.verts:
            v.co = Vector((v.co.x * rx, v.co.y * rd, v.co.z * rz))
        sgn = -1 if lower else 1
        z0 = sgn * rz * (1 - 2 * cover)
        pn = Vector((-slope * self.side * sgn, 0, 1)).normalized() * sgn
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, z0),
                                     plane_no=pn, clear_inner=True)
        cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        cut_verts = sorted({v for e in cut for v in e.verts if v.co.y < -rd * 0.25}, key=lambda v: v.co.x)
        lash_pts = [v.co.copy() for v in cut_verts]
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        W = Matrix.Translation(self.c) @ self.R.to_4x4()
        bm.transform(W)
        tag = 'Lower Lid' if lower else 'Lid'
        ob = K.from_bmesh(f'{self.name} {tag}', bm, material or self.M['coda'], smooth_angle=60)
        K.set_parent(ob, self.pivot)
        if lash > 0 and len(lash_pts) > 2:
            pts = [W @ (p + Vector((0, -lash * 0.3, 0))) for p in lash_pts]
            pts = [pts[0]] + pts[1:-1:2] + [pts[-1]] if len(pts) > 8 else pts
            lob = K.tube(f'{self.name} {tag} Lash', spline(pts, n=2), lash, lash_mat or self.M['ink'], verts=6,
                         radius_fn=lambda t: 0.45 + 0.55 * math.sin(math.pi * t) ** 0.4, squash=0.7)
            K.set_parent(lob, self.pivot)
        return ob

    def closed(self, arch, radius, material=None, up=True):
        """Closed eye as a curved stroke: up=True draws a happy arch, False a sleepy smile-curve."""
        cx = self.c.x
        cz = self.c.z
        pts = []
        for i in range(9):
            t = -1 + 2 * i / 8
            z = cz + (arch * (1 - t * t) if up else -arch * (1 - t * t)) - (arch * 0.35 if up else -arch * 0.35)
            pts.append((cx + t * self.rx * 1.08, z))
        return stroke(f'{self.name} Closed', self.surf, pts, radius, material or self.M['ink'], taper=0.45,
                      parent=self.pivot, squash=0.6, lift=0.0)


def brow(name, surf, cx, cz, width, radius, lift_in, lift_out, arch, side, material, parent):
    """Tapered eyebrow stroke; its origin is its centre so a runtime could tilt it."""
    pts = []
    for i in range(7):
        t = -1 + 2 * i / 6
        inner_w = (1 - t * side) / 2
        z = cz + arch * (1 - t * t) + lift_in * inner_w + lift_out * (1 - inner_w)
        pts.append((cx + t * width / 2, z))
    ob = stroke(name, surf, pts, radius, material, taper=0.4, squash=0.6)
    set_origin(ob, surf.front(cx, cz)[0])
    K.set_parent(ob, parent)
    return ob


# ================================================================ mouths


def d_mouth(w, h, curve, n=12, skew=0.0):
    """Open 'D' smile: flat-ish top whose corners curl up, deep round bottom."""
    top, bot = [], []
    for i in range(n + 1):
        u = -w + 2 * w * i / n
        t = u / w
        top.append((u, curve * t * t + skew * t))
    for i in range(1, n):
        u = w - 2 * w * i / n
        t = u / w
        bot.append((u, curve * t * t + skew * t - h * (1 - t * t) ** 0.62))
    return top + bot


def mouth(kind, surf, cx, cz, scale, M, parent, prefix):
    """Mouth variants. scale = body size factor (Coda 1.0, the Hush ~6)."""
    s = scale
    made = []
    if kind in ('smile', 'grin', 'wide'):
        w, h, c = {'smile': (0.05, 0.042, 0.012), 'grin': (0.066, 0.062, 0.018),
                   'wide': (0.07, 0.04, 0.014)}[kind]
        out = [(u * s, v * s) for u, v in d_mouth(w, h, c)]
        made.append(patch(f'{prefix} Mouth', surf, out, (cx, cz), M['mouth'], lift=0.0008 * s, rise=0.0025 * s,
                          wall=0.006 * s, parent=parent))
        tongue = ellipse(w * 0.55 * s, h * 0.36 * s, 18, 0, -h * 0.66 * s)
        made.append(patch(f'{prefix} Tongue', surf, tongue, (cx, cz), M['cheek'], lift=0.0048 * s,
                          rise=0.0022 * s, wall=0.0015 * s, parent=parent))
        if kind == 'wide':
            band = clip_poly(out, lambda p: p.y - (c * (p.x / (w * s)) ** 2 * s - 0.013 * s))
            made.append(patch(f'{prefix} Teeth', surf, resample(band, 0.006 * s), (cx, cz), M['teeth'],
                              lift=0.0048 * s, rise=0.0012 * s, wall=0.0012 * s, parent=parent,
                              rings=(1.0, 0.85, 0.5)))
    elif kind in ('o', 'yawn'):
        rx, rz = {'o': (0.026, 0.034), 'yawn': (0.032, 0.04)}[kind]
        made.append(patch(f'{prefix} Mouth', surf, ellipse(rx * s, rz * s, 22), (cx, cz), M['mouth'],
                          lift=0.0008 * s, rise=0.0025 * s, wall=0.006 * s, parent=parent))
        made.append(patch(f'{prefix} Tongue', surf, ellipse(rx * 0.6 * s, rz * 0.34 * s, 16, 0, -rz * 0.55 * s),
                          (cx, cz), M['cheek'], lift=0.0048 * s, rise=0.0018 * s, wall=0.0015 * s, parent=parent))
    elif kind in ('smirk', 'soft', 'frown', 'small'):
        # Line mouths drawn as strokes: (half width, bend, skew, thickness)
        w, bend, skew, th = {'smirk': (0.045, 0.012, 0.008, 0.0075), 'soft': (0.04, 0.014, 0.0, 0.0065),
                             'frown': (0.032, -0.012, 0.0, 0.0065), 'small': (0.026, -0.004, 0.0, 0.006)}[kind]
        pts = []
        for i in range(9):
            t = -1 + 2 * i / 8
            pts.append((cx + t * w * s, cz + (bend * t * t + skew * t) * s))
        made.append(stroke(f'{prefix} Mouth', surf, pts, th * s, M['ink'], taper=0.55, parent=parent, squash=0.6))
    return made


# ================================================================ CODA

CODA = dict(R=0.285, zc=0.262, top=0.268, bot=0.232, p=2.3, sy=0.94)

CODA_EXPR = {
    #            mouth       upper lid (cover, slope)  lower lid  brows (in, out, arch)   eye scale  look
    'neutral': dict(mouth='smile', lid=None, low=None, brow=(0.004, 0.0, 0.007), eye=1.0, look=(0, 0)),
    'happy': dict(mouth='grin', lid=None, low=(0.2, 0.0), brow=(0.012, 0.004, 0.009), eye=1.0, look=(0, 0)),
    'wow': dict(mouth='o', lid=None, low=None, brow=(0.03, 0.022, 0.012), eye=1.13, look=(0, 0.06)),
    'determined': dict(mouth='wide', lid=(0.27, 0.2), low=(0.12, 0.0), brow=(-0.014, 0.006, 0.004), eye=1.0,
                       look=(0, 0)),
}


def coda_profile(n=26):
    R, zc, top, bot, p = CODA['R'], CODA['zc'], CODA['top'], CODA['bot'], CODA['p']
    prof = []
    for k in range(n + 1):
        phi = -math.pi / 2 + math.pi * k / n
        s, c = math.sin(phi), math.cos(phi)
        r = R * abs(c) ** (2 / p)
        z = zc + (top if s > 0 else bot) * math.copysign(abs(s) ** (2 / p), s)
        prof.append((0.0 if k in (0, n) else r, z))
    return prof


FACE = dict(eye_x=0.106, eye_z=0.278, mouth_z=0.182, cheek=(0.182, 0.192))


def build_coda(expr='neutral', ao=True):
    M = mats()
    E = CODA_EXPR[expr] if isinstance(expr, str) else expr
    root = K.empty('Coda')
    # Coda_Body sits on the root origin (the feet) with zero rest translation: squash-and-stretch and the
    # idle rock anchor at the ground, and a runtime may assign body.position directly for hops.
    body = K.empty('Coda_Body', (0, 0, 0), root)

    # Body: plump note head (superellipse lathe, a little shallower front to back).
    shell = K.lathe('Coda Body Shell', coda_profile(22), M['coda'], seg=36, smooth_angle=80)
    shell.data.transform(Matrix.Diagonal((1, CODA['sy'], 1, 1)))
    proxy = K.lathe('Coda Proxy', coda_profile(90), None, seg=160)
    proxy.data.transform(Matrix.Diagonal((1, CODA['sy'], 1, 1)))
    K.set_parent(shell, body)
    surf = Surface([proxy])

    # Eyes: big glossy ovals set low (baby-face proportions), jewel iris, twin catchlights, optional lids.
    es = E['eye']
    rx, rz, rd = 0.062 * es, 0.086 * es, 0.036 * es
    ez = FACE['eye_z']
    for side, tag in ((1, 'L'), (-1, 'R')):
        e = Eye(f'Coda_Eye{tag}', body, surf, side * FACE['eye_x'], ez, rx, rz, rd, M, side, look=E['look'])
        e.ball().shine()
        if E['lid']:
            e.lid(E['lid'][0], E['lid'][1], material=M['coda'], lash=0.0068, lash_mat=M['ink'])
        if E['low']:
            e.lid(E['low'][0], E['low'][1], lower=True, material=M['coda'])

    # Brows (kept as their own nodes: Coda_BrowL / Coda_BrowR).
    bi, bo, ba = E['brow']
    for side, tag in ((1, 'L'), (-1, 'R')):
        brow(f'Coda_Brow{tag}', surf, side * (FACE['eye_x'] + 0.004), ez + 0.086 + 0.036, 0.066, 0.011, bi, bo, ba,
             side, M['ink'], body)

    # Cheeks, mouth.
    cx, cz = FACE['cheek']
    for side, tag in ((1, 'L'), (-1, 'R')):
        patch(f'Coda Cheek {tag}', surf, ellipse(0.044, 0.027, 18), (side * cx, cz), M['cheek'],
              lift=0.001, rise=0.0035, parent=body, rings=(1.0, 0.94, 0.7, 0.35))
    mouth(E['mouth'], surf, 0.0, FACE['mouth_z'], 1.0, M, body, 'Coda')

    # Stem rising from the back of the head, capped with a bead; amber so it separates from the body.
    top = Vector((0.192, 0.13, 0.885))
    stem_pts = spline([(0.118, 0.1, 0.36), (0.16, 0.116, 0.56), (0.18, 0.124, 0.72), tuple(top)], n=4)
    stem = K.tube('Coda Stem', stem_pts, 0.041, M['coda_deep'], verts=12,
                  radius_fn=lambda t: 1.08 - 0.12 * t)
    K.set_parent(stem, body)

    # Flag: a chunky eighth-note flag swooping down and out to the right, round-tipped; it wags about
    # its base on the stem top.
    flag_piv = K.empty('Coda_Flag', top, body)
    flag_ctrl = [(-0.02, 0.035), (0.06, 0.03), (0.14, -0.005), (0.215, -0.07), (0.262, -0.16), (0.27, -0.255),
                 (0.245, -0.34), (0.2, -0.4), (0.158, -0.425), (0.14, -0.4), (0.158, -0.35), (0.175, -0.29),
                 (0.172, -0.225), (0.14, -0.17), (0.085, -0.135), (0.03, -0.12), (-0.02, -0.1)]
    flag_out = [(p.x * 0.95, p.y * 0.86) for p in spline(flag_ctrl, n=3, closed=True)]
    Wf = Matrix.Translation(top) @ basis((1, 0, 0), (0, 0, 1)).to_4x4()
    shape2d('Coda Flag Fin', flag_out, 0.062, 0.022, M['flag'], Wf, segs=2, parent=flag_piv,
            bend=lambda x, y: -0.35 * x * x)
    ball('Coda Stem Bead', 0.05, top + Vector((0, 0, 0.01)), M['coda_deep'], seg=16, rings=9,
             parent=flag_piv)

    # Stubby ivory wings: three rounded feather lobes, swept back and a little raised, hinged at the body side.
    wing_ctrl = [(0.0, 0.06), (0.06, 0.105), (0.13, 0.13), (0.19, 0.125), (0.225, 0.092), (0.215, 0.055),
                 (0.183, 0.045), (0.195, 0.012), (0.176, -0.022), (0.142, -0.022), (0.143, -0.052),
                 (0.112, -0.074), (0.07, -0.062), (0.03, -0.04), (0.0, -0.02)]
    wing_out = [(p.x, p.y) for p in spline(wing_ctrl, n=2, closed=True)]
    for side, tag in ((1, 'L'), (-1, 'R')):
        loc, n = surf.cast((side * 2, 0.06, 0.285), (-side, 0, 0))
        root_pt = loc - n * 0.03
        piv = K.empty(f'Coda_Wing{tag}', root_pt, body)
        sweep = math.radians(24)
        u = Vector((side * math.cos(sweep), math.sin(sweep), 0.22))
        W = Matrix.Translation(root_pt) @ basis(u, (0, 0, 1)).to_4x4()
        if side < 0:
            W = W @ Matrix.Diagonal((1, 1, -1, 1))
        w = shape2d(f'Coda Wing {tag}', wing_out, 0.042, 0.017, M['wing'], W, segs=2, parent=piv,
                    bend=lambda x, y: -0.5 * x * x)
        if side < 0:
            w.data.flip_normals()

    # Tiny amber feet.
    for side in (1, -1):
        ball('Coda Foot', (0.05, 0.064, 0.032), (side * 0.088, -0.07, 0.033), M['coda_deep'], seg=14, rings=8,
                 parent=body)

    bpy.data.objects.remove(proxy, do_unlink=True)
    finish(root, ao, distance=0.12, strength=0.7, keep=('Coda_Brow',), rays=64, blur=2)
    return root


# ================================================================ HUSH

HUSH_EXPR = {
    'neutral': dict(lid=(0.5, -0.14), eyes='open', mouth='small', brow=(0.05, -0.005, 0.02), tear=False),
    'sleepy': dict(lid=(0.72, -0.08), eyes='open', mouth='yawn', brow=(0.03, -0.01, 0.03), tear=False),
    'sad': dict(lid=(0.42, -0.42), eyes='open', mouth='frown', brow=(0.13, -0.035, 0.0), tear=True),
    'smile': dict(lid=None, eyes='happy', mouth='soft', brow=(0.06, 0.02, 0.05), tear=False),
}


HUSH_PUFFS = [  # (centre, radius) spheres, smooth-unioned into the cloud body (front is -Y)
    ((0.0, 0.1, 0.0), 1.75),                                   # face puff
    ((-1.5, 0.22, -0.1), 1.28), ((1.52, 0.22, -0.06), 1.3),   # cheeks of the cloud
    ((-2.34, 0.32, -0.46), 0.74), ((2.36, 0.32, -0.42), 0.74),  # outer puffs
    ((-0.9, 0.28, 1.12), 1.06), ((0.86, 0.34, 1.16), 1.08),   # top bumps
    ((0.0, 0.62, 1.52), 0.84),                                 # crown
    ((-0.95, 0.02, -1.12), 0.74), ((0.98, 0.02, -1.1), 0.74), ((0.0, -0.04, -1.24), 0.7),  # underside
    ((0.0, 0.95, 0.1), 1.45),                                  # back volume
]
HUSH_BLEND = 0.3


def _cube_dirs(cuts):
    """Equal-angle quad-sphere: returns (bmesh, unit directions per vertex)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    dirs = []
    for v in bm.verts:
        c = [max(-1.0, min(1.0, x)) for x in v.co]
        m = max(range(3), key=lambda i: abs(c[i]))
        w = [math.tan(x * math.pi / 4) if i != m else math.copysign(1.0, x) for i, x in enumerate(c)]
        dirs.append(Vector(w).normalized())
    return bm, dirs


def cloud_radii(dirs, puffs=None, k=None, origin=(0.0, 0.2, 0.0)):
    """Distance along each direction to the smooth union of sphere SDFs (vectorised bisection)."""
    import numpy as np
    puffs = puffs or HUSH_PUFFS
    k = k or HUSH_BLEND
    D = np.array([tuple(d) for d in dirs])
    O = np.array(origin)
    C = np.array([p[0] for p in puffs])
    R = np.array([p[1] for p in puffs])

    def f(t):
        pts = O + D * t[:, None]
        d = np.linalg.norm(pts[None, :, :] - C[:, None, :], axis=2) - R[:, None]
        res = d[0]
        for i in range(1, len(puffs)):
            h = np.clip(0.5 + 0.5 * (d[i] - res) / k, 0.0, 1.0)
            res = d[i] * (1 - h) + res * h - k * h * (1 - h)
        return res

    lo = np.zeros(len(D))
    hi = np.full(len(D), 8.0)
    for _ in range(36):
        mid = (lo + hi) / 2
        inside = f(mid) < 0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    return O, (lo + hi) / 2


def cloud_sphere(name, cuts, material=None):
    """Quad-sphere shrink-wrapped onto the smooth-unioned puffs: soft creases, even tessellation."""
    bm, dirs = _cube_dirs(cuts)
    O, t = cloud_radii(dirs)
    for v, d, r in zip(bm.verts, dirs, t):
        v.co = Vector(O) + d * float(r)
    return K.from_bmesh(name, bm, material, smooth_angle=89)


HUSH_FACE = dict(eye_x=1.06, eye_z=0.26, rx=0.52, rz=0.45, rd=0.21, cheek=(1.8, -0.22), mouth_z=-0.4)


def build_hush(expr='neutral', ao=True, cuts=15):
    M = mats()
    E = HUSH_EXPR[expr] if isinstance(expr, str) else expr
    F = HUSH_FACE
    root = K.empty('Hush')
    body = K.empty('Hush_Body', (0, 0, 0), root)

    # Soft scalloped cloud body; a dense copy is the projection proxy for the face.
    proxy = cloud_sphere('Hush Proxy', 56)
    shell = cloud_sphere('Hush Cloud Body', cuts, M['hush'])
    xs = [v.co for v in proxy.data.vertices]
    lo = Vector([min(p[i] for p in xs) for i in range(3)])
    hi = Vector([max(p[i] for p in xs) for i in range(3)])
    k = 6.0 / (hi.x - lo.x)
    T = Matrix.Diagonal((k, k, k, 1)) @ Matrix.Translation(-(lo + hi) / 2)
    proxy.data.transform(T)
    shell.data.transform(T)
    surf = Surface([proxy])
    K.set_parent(shell, body)

    # Big sleepy eyes (lids are part of the blink pivot so a blink squashes the whole eye).
    for side, tag in ((1, 'L'), (-1, 'R')):
        e = Eye(f'Hush_Eye{tag}', body, surf, side * F['eye_x'], F['eye_z'], F['rx'], F['rz'], F['rd'], M, side,
                embed=0.35)
        if E['eyes'] == 'open':
            e.ball(seg=20, rings=12, iris_size=(0.72, 0.52), iris_v=-0.38)
            e.shine(big=(-0.36, -0.32, 0.23), small=(0.36, -0.62, 0.1))
            if E['lid']:
                e.lid(E['lid'][0], E['lid'][1], material=M['hush'], lash=0.04, lash_mat=M['ink'], grow=1.07,
                      depth=1.16)
        else:
            e.closed(0.17, 0.068, up=True)
        if E.get('tear') and side == 1:
            p, nn = surf.front(F['eye_x'] + F['rx'] * 0.72, F['eye_z'] - F['rz'] * 1.05, r=0.05)
            tear_c = p + nn * 0.05
            ball('Hush Tear', (0.1, 0.07, 0.14), tear_c, M['tear'], seg=14, rings=8, rot=frame(nn).to_euler(),
                     parent=e.pivot)
            ball('Hush Tear Shine', 0.032, tear_c + nn * 0.05 + Vector((-0.03, 0, 0.045)), M['shine'], seg=8,
                     rings=5, parent=e.pivot)

    bi, bo, ba = E['brow']
    for side, tag in ((1, 'L'), (-1, 'R')):
        brow(f'Hush_Brow{tag}', surf, side * (F['eye_x'] + 0.03), F['eye_z'] + F['rz'] + 0.26, 0.56, 0.058,
             bi, bo, ba, side, M['hush_deep'], body)

    # Rosy cheeks and a small mouth.
    for side, tag in ((1, 'L'), (-1, 'R')):
        patch(f'Hush Cheek {tag}', surf, ellipse(0.4, 0.25, 18), (side * F['cheek'][0], F['cheek'][1]),
              M['cheek'], lift=0.004, rise=0.02, wall=0.03, parent=body, rings=(1.0, 0.94, 0.7, 0.35))
    mouth(E['mouth'], surf, 0.0, F['mouth_z'], 7.0, M, body, 'Hush')

    # Tiny cloud arms: little resting mitts at the lower front sides (own pivots at the shoulder).
    for side, tag in ((1, 'L'), (-1, 'R')):
        loc, n = surf.front(side * 2.12, -0.8)
        sh = loc - n * 0.28
        piv = K.empty(f'Hush_Arm{tag}', sh, body)
        d = Vector((side * 0.5, -0.62, -0.6)).normalized()
        capsule(f'Hush Arm {tag}', sh, sh + d * 0.5, 0.27, M['hush'], seg=12, rings=5, r2=0.33, parent=piv)

    # Floppy striped nightcap with a plush trim and a star pom-pom; pivot at the base for sway.
    top_loc, _ = surf.cast((0.6, 0.3, 10), (0, 0, -1))
    base = top_loc + Vector((0, 0, -0.14))
    cap_piv = K.empty('Hush_Cap', base, body)
    tilt = Vector((-0.1, 0.05, 1)).normalized()
    path = spline([base + Vector((0, 0, -0.3)), base + Vector((-0.05, 0.02, 0.45)),
                   base + Vector((-0.3, 0.0, 1.08)), base + Vector((-0.95, -0.08, 1.42)),
                   base + Vector((-1.7, -0.2, 1.22)), base + Vector((-2.2, -0.34, 0.6)),
                   base + Vector((-2.4, -0.45, -0.1))], n=5)
    per = 12
    cap = K.tube('Hush Cap Cone', path, 1.0, M['cap'], verts=per,
                 radius_fn=lambda t: 1.0 - 0.9 * t ** 0.8, caps=True)
    assign_by(cap, [M['cap'], M['cap2']], lambda c: 0)
    for i, poly in enumerate(cap.data.polygons):
        poly.material_index = 1 if ((i // per) // 4) % 2 == 1 else 0
    K.set_parent(cap, cap_piv)
    brim = K.torus('Hush Cap Trim', 0.98, 0.3, base + Vector((0, 0, 0.1)), M['brim'], maj=22, mn=8,
                   rot=Vector((0, 0, 1)).rotation_difference(tilt).to_euler())
    K.set_parent(brim, cap_piv)
    tip = path[-1]
    star_W = Matrix.Translation(tip + Vector((0.05, -0.1, -0.3))) @ basis((1, 0, 0), (0, 0, 1)).to_4x4() @ \
        Matrix.Rotation(math.radians(14), 4, 'Z')
    shape2d('Hush Cap Star', star_outline(0.55, 0.27, 5), 0.26, 0.08, M['star'], star_W, segs=2, parent=cap_piv)

    bpy.data.objects.remove(proxy, do_unlink=True)
    finish(root, ao, distance=0.9, strength=0.5, keep=('Hush_Brow', 'Hush_Arm'), rays=72, blur=4)
    if ao:
        # Sky-light falloff: the cloud's underbelly settles into a deeper lilac (multiplies the AO).
        for o in K.descendants([root]):
            if o.type == 'MESH' and o.data.materials and o.data.materials[0].name == 'Hush Cloud':
                mw = o.matrix_world
                attr = o.data.color_attributes.get('Color')
                for li, loop in enumerate(o.data.loops):
                    z = (mw @ o.data.vertices[loop.vertex_index].co).z
                    t = min(1.0, max(0.0, (z + 1.9) / 3.2))
                    g = 0.74 + 0.26 * (t * t * (3 - 2 * t))
                    c = attr.data[li].color
                    attr.data[li].color = (c[0] * g, c[1] * g, c[2] * g, 1.0)
    return root


# ================================================================ ENCORE SHIP

def grand_outline():
    """Top view of the grand-piano hull (CCW). Keyboard (stern) at +Y, curved tail = bow at -Y."""
    rc = 0.34
    corner = lambda cx, cy, a0, a1: [(cx + rc * math.cos(math.radians(a0 + (a1 - a0) * i / 5)),
                                       cy + rc * math.sin(math.radians(a0 + (a1 - a0) * i / 5))) for i in range(6)]
    y_st = 1.9
    pts = corner(1.25 - rc, y_st - rc, 0, 90)
    for i in range(1, 6):
        x = (1.25 - rc) - 2 * (1.25 - rc) * i / 6
        pts.append((x, y_st))
    pts += corner(-1.25 + rc, y_st - rc, 90, 180)
    curve = [(-1.25, y_st - rc), (-1.25, 1.1), (-1.2, 0.55), (-1.09, 0.0), (-0.99, -0.55), (-0.95, -1.1),
             (-0.97, -1.65), (-0.9, -2.2), (-0.66, -2.68), (-0.22, -2.98), (0.3, -2.98), (0.78, -2.72),
             (1.1, -2.25), (1.23, -1.6), (1.25, -0.9), (1.25, 0.0), (1.25, 0.9), (1.25, y_st - rc)]
    sm = spline(curve, n=5)
    pts += [(p.x, p.y) for p in sm[1:-1]]
    return resample(pts, 0.12)


SHIP_DY = 0.3        # shifts the ship so the hull-bottom centre sits on the origin
LID = dict(hinge_y=1.36, hinge_z=0.97, angle=66.0, scale=0.84)


def build_ship(ao=True):
    M = mats()
    root = K.empty('Encore_Ship')
    parts = []

    def keep(ob):
        parts.append(ob)
        return ob

    outline = grand_outline()
    hull_prof = [(0.34, 0.0, 0), (0.17, 0.055, 0), (0.06, 0.16, 0), (0.0, 0.33, 0), (0.0, 0.8, 0),
                 (0.018, 0.9, 0), (0.065, 0.948, 0), (0.125, 0.94, 0), (0.152, 0.87, 0), (0.162, 0.76, 0)]
    hull = keep(loft('Ship Hull', outline, hull_prof, [M['lacquer'], M['board']], cap_top_mat=1, smooth_angle=48))
    hull_surf = Surface([hull])

    # Gold trim lines around the rim and the lower hull.
    for z, off, r, nm, nv in ((0.845, -0.012, 0.034, 'Rim', 6), (0.3, -0.004, 0.026, 'Lower', 5)):
        ring = [Vector((p.x, p.y, z)) for p in resample(offset_poly(ccw(outline), off), 0.16)]
        keep(K.tube(f'Ship Trim {nm}', ring + [ring[0]], r, M['trim'], verts=nv, caps=False))

    # Soundboard deck details: gold harp-plate rim, two struts, brass strings fanning to the tail.
    inner = offset_poly(ccw(outline), 0.3)
    inner = clip_poly(inner, lambda p: 1.25 - p.y)
    plate = [Vector((p.x, p.y, 0.775)) for p in resample(inner, 0.17)]
    keep(K.tube('Ship Harp Plate', plate + [plate[0]], 0.05, M['trim'], verts=5, caps=False, squash=0.5))
    for a, b in (((0.95, 1.1), (-0.55, -2.3)), ((-0.8, 1.1), (0.55, -1.9))):
        keep(capsule('Ship Harp Strut', (a[0], a[1], 0.79), (b[0], b[1], 0.79), 0.05, M['trim'], seg=8, rings=3))
    for i in range(9):
        t = i / 8
        x0 = -0.72 + 1.5 * t
        a = Vector((x0, 1.05, 0.8))
        b = Vector((-0.45 + 1.1 * t, -1.8 - 0.8 * math.sin(math.pi * t) + 0.3 * t, 0.8))
        keep(K.rod('Ship String', a, b, 0.012, M['brass'], verts=5))
    for i in range(10):
        x = -0.8 + 1.6 * i / 9
        keep(K.cyl('Ship Tuning Pin', 0.03, 0.08, (x, 1.18, 0.81), M['trim'], verts=6))

    # Keyboard at the stern: keybed, cheek blocks, ivory and ebony keys, fallboard and music desk.
    keep(K.box('Ship Keybed', (2.5, 0.82, 0.34), (0, 2.12, 0.46), M['lacquer'], bevel=0.07, segments=2))
    for s in (1, -1):
        keep(K.box('Ship Key Cheek', (0.24, 0.86, 0.66), (s * 1.16, 2.13, 0.62), M['lacquer'], bevel=0.08,
                   segments=3))
        keep(ball('Ship Cheek Knob', 0.07, (s * 1.16, 2.5, 0.97), M['trim'], seg=12, rings=6))
    white = []
    n_w = 14
    span = 2.04
    kw = span / n_w
    for i in range(n_w):
        x = -span / 2 + kw * (i + 0.5)
        white.append(K.box('Ship White Key', (kw - 0.016, 0.52, 0.1), (x, 2.23, 0.68), M['ivory'], bevel=0.018,
                           segments=1))
    black = []
    for i in range(n_w - 1):
        if i % 7 in (2, 6):
            continue
        x = -span / 2 + kw * (i + 1)
        black.append(K.box('Ship Black Key', (kw * 0.56, 0.3, 0.1), (x, 2.1, 0.76), M['ebony'], bevel=0.02,
                           segments=1))
    keep(K.join(white, 'Ship White Keys'))
    keep(K.join(black, 'Ship Black Keys'))
    keep(K.box('Ship Fallboard', (2.08, 0.16, 0.4), (0, 1.86, 0.8), M['lacquer'], bevel=0.05, segments=2))
    keep(K.box('Ship Nameboard', (0.9, 0.03, 0.07), (0, 1.94, 0.86), M['trim'], bevel=0.012, segments=1))
    desk_W = rot_about((0, 1.62, 1.0), math.radians(14), 'X')
    desk = keep(K.box('Ship Music Desk', (1.34, 0.05, 0.5), (0, 1.62, 1.22), M['ebony'], bevel=0.02, segments=2))
    sheet = keep(K.box('Ship Sheet Music', (0.9, 0.02, 0.36), (0, 1.655, 1.24), M['ivory'], bevel=0.006,
                       segments=1))
    staff = []
    for i in range(5):
        staff.append(K.box('Ship Staff', (0.8, 0.012, 0.012), (0, 1.668, 1.16 + 0.04 * i), M['ebony'], bevel=0,
                           segments=1))
    for j, (x, z) in enumerate(((-0.25, 1.2), (-0.05, 1.26), (0.15, 1.22), (0.32, 1.3))):
        staff.append(ball('Ship Staff Note', (0.028, 0.012, 0.022), (x, 1.672, z), M['ebony'], seg=8, rings=4))
    st = keep(K.join(staff, 'Ship Staff Lines'))
    for ob in (desk, sheet, st):
        bake_matrix(ob, desk_W)

    # Turned legs with brass casters (landing gear).
    leg_prof = [(0.0, -0.62), (0.05, -0.6), (0.075, -0.55), (0.06, -0.5), (0.075, -0.45), (0.1, -0.38),
                (0.085, -0.25), (0.11, -0.12), (0.15, -0.04), (0.16, 0.06), (0.0, 0.07)]
    for x, y in ((0.82, 1.45), (-0.82, 1.45), (0.12, -2.25)):
        keep(K.lathe('Ship Leg', leg_prof, M['lacquer'], seg=12, loc=(x, y, 0.0), smooth_angle=60))
        keep(K.torus('Ship Leg Ring', 0.095, 0.022, (x, y, -0.38), M['trim'], maj=12, mn=5))
        keep(ball('Ship Caster', 0.075, (x, y, -0.66), M['brass'], seg=10, rings=6))

    # Portholes with warm glow (night readability).
    for side in (1, -1):
        for y in (-1.95, -1.2, -0.45):
            loc, n = hull_surf.cast((side * 5, y, 0.56), (-side, 0, 0))
            R = frame(n).to_euler()
            keep(K.torus('Ship Porthole Rim', 0.12, 0.035, loc + n * 0.01, M['trim'], maj=14, mn=5,
                         rot=(frame(n) @ Matrix.Rotation(math.pi / 2, 3, 'X')).to_euler()))
            keep(ball('Ship Porthole Glass', (0.1, 0.025, 0.1), loc + n * 0.004, M['window'], seg=12, rings=4,
                          rot=R))

    # Stub wings and brass propeller pods.
    pod_x, pod_y, pod_z = 1.82, 0.42, 0.5
    pod_prof = [(0.0, -0.72), (0.11, -0.7), (0.2, -0.62), (0.26, -0.46), (0.28, -0.25), (0.28, 0.35),
                (0.25, 0.56), (0.18, 0.72), (0.08, 0.8), (0.0, 0.82)]
    props = {}
    for side, tag in ((1, 'L'), (-1, 'R')):
        stub = [(0.0, -0.36), (0.0, 0.36), (0.9, 0.24), (0.9, -0.2)]
        W = Matrix.Translation((side * 0.95, pod_y + 0.05, pod_z)) @ Matrix.Diagonal((side, 1, 1, 1))
        wob = keep(shape2d(f'Ship Stub Wing {tag}', stub, 0.13, 0.05, M['lacquer'], W, segs=2))
        if side < 0:
            wob.data.flip_normals()
        pod = keep(K.lathe(f'Ship Pod {tag}', pod_prof, M['brass'], seg=18, loc=(side * pod_x, pod_y, pod_z),
                           rot=(-math.pi / 2, 0, 0), smooth_angle=60))
        for yy in (-0.3, 0.22):
            keep(K.torus('Ship Pod Ring', 0.285, 0.03, (side * pod_x, pod_y + yy, pod_z), M['trim'], maj=18, mn=5,
                         rot=(math.pi / 2, 0, 0)))
        keep(K.cyl('Ship Pod Band', 0.29, 0.26, (side * pod_x, pod_y - 0.04, pod_z), M['lacquer'], verts=18,
                   rot=(math.pi / 2, 0, 0), cap=False))
        for a in (90, 210, 330):
            d = Vector((math.cos(math.radians(a)), 0, math.sin(math.radians(a))))
            fin = [(0.0, -0.12), (0.0, 0.2), (0.24, 0.22), (0.22, 0.05)]
            Wf = Matrix.Translation(Vector((side * pod_x, pod_y + 0.5, pod_z)) + d * 0.15) @ \
                basis(d, (0, 1, 0)).to_4x4()
            keep(shape2d('Ship Pod Fin', fin, 0.05, 0.02, M['lacquer'], Wf, segs=1))
        hub = Vector((side * pod_x, pod_y - 0.82, pod_z))
        piv = K.empty(f'Ship_Prop{tag}', hub, root)
        props[tag] = piv
        K.lathe('Ship Spinner', [(0.0, -0.24), (0.07, -0.2), (0.13, -0.1), (0.15, 0.0), (0.14, 0.08), (0.0, 0.09)],
                M['lacquer'], seg=14, loc=hub, rot=(-math.pi / 2, 0, 0), parent=piv, smooth_angle=70)
        for a in (90, 210, 330):
            d = Vector((math.cos(math.radians(a)), 0, math.sin(math.radians(a))))
            tw = Matrix.Rotation(math.radians(24 * side), 3, d)
            ball('Ship Prop Blade', (0.3, 0.1, 0.03), hub + d * 0.36, M['ivory'], seg=12, rings=6,
                     rot=(tw @ basis(d, Vector((0, 1, 0)).cross(d))).to_euler(), parent=piv)
            ball('Ship Prop Tip', (0.09, 0.105, 0.034), hub + d * 0.6, M['lacquer'], seg=10, rings=5,
                     rot=(tw @ basis(d, Vector((0, 1, 0)).cross(d))).to_euler(), parent=piv)

    # Treble-clef figurehead at the bow.
    clef = [(-0.1, 0.06), (-0.05, -0.01), (0.02, 0.0), (0.05, 0.08), (0.045, 0.32), (0.03, 0.58), (0.04, 0.8),
            (0.09, 0.95), (0.14, 0.98), (0.15, 0.88), (0.09, 0.77), (-0.04, 0.65), (-0.13, 0.53), (-0.15, 0.41),
            (-0.1, 0.3), (0.0, 0.25), (0.1, 0.28), (0.15, 0.37), (0.12, 0.46), (0.04, 0.49), (-0.03, 0.44),
            (-0.03, 0.37), (0.03, 0.35)]
    bow = Vector((0.05, -2.93, 0.75))
    cpts = [bow + Vector((0, -u * 1.0, v * 1.05)) for u, v in clef]
    keep(K.tube('Ship Clef', spline(cpts, n=2), 0.042, M['trim'], verts=7,
                radius_fn=lambda t: 0.7 + 0.5 * math.sin(math.pi * min(1, t * 1.6)) ** 2))
    keep(ball('Ship Clef Dot', 0.07, cpts[0], M['trim'], seg=12, rings=8))

    # Lid sail: the grand-piano lid, raised about its back-edge hinge (X axis). Built flat, then raised.
    hy, hz, ang, sc = LID['hinge_y'], LID['hinge_z'], math.radians(LID['angle']), LID['scale']
    lid_flat = clip_poly(ccw(outline), lambda p: hy - p.y)
    lid_flat = [Vector((p.x * sc, hy + (p.y - hy) * sc)) for p in lid_flat]
    lid_flat = resample(lid_flat, 0.13)
    hinge = Vector((0, hy, hz))
    lid_piv = K.empty('Ship_Lid', hinge, root)
    raise_W = rot_about(hinge, -ang, 'X')
    L = hy - min(p.y for p in lid_flat)
    lid_parts = []
    lid_parts.append(shape2d('Ship Lid Sail', lid_flat, 0.075, 0.03, M['lacquer'],
                             Matrix.Translation((0, 0, hz + 0.04)), segs=1))
    rim = [Vector((p.x, p.y, hz + 0.04)) for p in offset_poly(ccw(lid_flat), 0.0)]
    lid_parts.append(K.tube('Ship Lid Rim', rim + [rim[0]], 0.045, M['trim'], verts=6, caps=False))
    for y0, y1, nm in ((hy - 0.56 * L, hy - 0.36 * L, 'Stripe'), (hy - 0.3 * L, hy - 0.25 * L, 'Pinstripe')):
        band = clip_poly(clip_poly(offset_poly(ccw(lid_flat), 0.07), lambda p: y1 - p.y), lambda p: p.y - y0)
        lid_parts.append(shape2d(f'Ship Lid {nm}', resample(band, 0.12), 0.1, 0.02, M['stripe'],
                                 Matrix.Translation((0, 0, hz + 0.04)), segs=1))
    tip2 = min(lid_flat, key=lambda p: p.y)
    tip = Vector((tip2.x, tip2.y, hz + 0.04))
    # Hinge barrel and the prop stick.
    lid_parts.append(K.cyl('Ship Lid Hinge', 0.05, 1.5, (0, hy, hz + 0.02), M['trim'], verts=12,
                           rot=(0, math.pi / 2, 0), bevel=0.015))
    for ob in lid_parts:
        bake_matrix(ob, raise_W)
        K.set_parent(ob, lid_piv)
    tip_w = raise_W @ tip
    mid_w = raise_W @ Vector((0.55, hy - 0.5 * L, hz))
    stick = K.rod('Ship Lid Prop', (0.55, mid_w.y - 0.95, 0.8), mid_w + Vector((0, -0.05, -0.02)), 0.035,
                  M['brass'], verts=8)
    K.set_parent(stick, lid_piv)
    # Masthead pennant on the sail tip.
    pole_top = tip_w + Vector((0, 0.1, 0.55))
    K.set_parent(K.rod('Ship Masthead Pole', tip_w + Vector((0, 0.03, -0.1)), pole_top, 0.025, M['trim'], verts=8),
                 lid_piv)
    K.set_parent(ball('Ship Masthead Ball', 0.06, pole_top, M['trim'], seg=12, rings=6), lid_piv)
    pen = [(0.0, 0.0), (0.0, -0.3), (0.7, -0.17), (0.52, -0.1), (0.72, -0.02)]
    Wp = Matrix.Translation(pole_top + Vector((0, 0, -0.05))) @ basis((0, 1, 0), (0, 0, 1)).to_4x4()
    K.set_parent(shape2d('Ship Masthead Pennant', pen, 0.025, 0.008, M['pen_sky'], Wp, segs=1,
                         bend=lambda x, y: 0.12 * math.sin(x * 6)), lid_piv)

    # Forestay with bunting (sail tip -> clef), backstays to the stern corners.
    bow_pt = bow + Vector((0, 0.05, 0.9))
    stay_pts = [tip_w.lerp(bow_pt, i / 16) + Vector((0, 0, -0.18 * math.sin(math.pi * i / 16))) for i in range(17)]
    K.set_parent(K.tube('Ship Forestay', stay_pts, 0.018, M['rope'], verts=5), lid_piv)
    pen_mats = [M['pen_sky'], M['pen_lime'], M['stripe'], M['pen_violet'], M['pen_orange'], M['lacquer']]
    for i in range(1, 15):
        t = i / 15
        a = stay_pts[0].lerp(stay_pts[-1], t) + Vector((0, 0, -0.18 * math.sin(math.pi * t)))
        dirv = (stay_pts[-1] - stay_pts[0]).normalized()
        tri_ = [(-0.13, 0.0), (0.13, 0.0), (0.0, -0.3)]
        Wt = Matrix.Translation(a) @ basis(dirv, (0, 0, 1)).to_4x4()
        K.set_parent(shape2d('Ship Bunting', tri_, 0.02, 0.006, pen_mats[i % len(pen_mats)], Wt, segs=1), lid_piv)
    for s in (1, -1):
        K.set_parent(K.rod('Ship Backstay', tip_w + Vector((0, 0.02, -0.05)), (s * 1.05, 1.62, 0.95), 0.016,
                           M['rope'], verts=5), lid_piv)

    # Small striped balloon envelope above, with fins and a tail pennant.
    bc = Vector((0.0, 1.62, tip_w.z + 0.85))
    # Ship_Balloon has zero rest translation (a runtime may assign position.y for a bob); the envelope
    # centre, for rolls and pitches, is the inner pivot Ship_Balloon_Envelope.
    bal_root = K.empty('Ship_Balloon', (0, 0, 0), root)
    bal_piv = K.empty('Ship_Balloon_Envelope', bc, bal_root)
    env_prof = [(0.0, -1.3), (0.28, -1.24), (0.55, -1.06), (0.72, -0.72), (0.78, -0.25), (0.76, 0.25), (0.66, 0.7),
                (0.46, 1.08), (0.22, 1.32), (0.0, 1.42)]
    env = K.lathe('Ship Balloon Envelope', env_prof, M['lacquer'], seg=24, loc=bc, rot=(-math.pi / 2, 0, 0),
                  smooth_angle=70)
    gore = [M['lacquer'], M['cream'], M['stripe'], M['cream']]
    assign_by(env, gore, lambda c: int(((math.atan2(c.y, c.x) + TAU) % TAU) / TAU * 12) % 4)
    K.set_parent(env, bal_piv)
    K.set_parent(ball('Ship Balloon Nose', 0.14, bc + Vector((0, -1.29, 0)), M['trim'], seg=10, rings=6), bal_piv)
    for a in (0, 90, 180, 270):
        d = Vector((math.cos(math.radians(a)), 0, math.sin(math.radians(a))))
        fin = [(0.0, -0.2), (0.0, 0.3), (0.42, 0.42), (0.4, 0.05)]
        Wf = Matrix.Translation(bc + Vector((0, 0.9, 0)) + d * 0.45) @ basis(d, (0, 1, 0)).to_4x4()
        K.set_parent(shape2d('Ship Balloon Fin', fin, 0.06, 0.025, M['trim'], Wf, segs=1), bal_piv)
    K.set_parent(K.torus('Ship Balloon Band', 0.77, 0.035, bc, M['trim'], maj=20, mn=5, rot=(math.pi / 2, 0, 0)),
                 bal_piv)
    # Gondola ring + ropes down to the sail tip and the stern cheeks.
    ring_c = bc + Vector((0, 0, -0.84))
    K.set_parent(K.torus('Ship Balloon Ring', 0.22, 0.03, ring_c, M['trim'], maj=12, mn=5), bal_piv)
    for p in ((0.55, 0.3), (-0.55, 0.3), (0.55, 1.75), (-0.55, 1.75)):
        K.set_parent(K.rod('Ship Balloon Rope', bc + Vector((p[0] * 0.9, p[1] - 1.05, -0.45)), ring_c, 0.014,
                           M['rope'], verts=5), bal_piv)
    for s in (1, -1):
        K.set_parent(K.rod('Ship Balloon Tether', ring_c, (s * 1.16, 2.45, 1.0), 0.016, M['rope'], verts=5), bal_piv)
    pen2 = [(0.0, 0.0), (0.0, -0.26), (0.62, -0.13)]
    Wp2 = Matrix.Translation(bc + Vector((0, 1.38, 0.08))) @ basis((0, 1, 0), (0, 0, 1)).to_4x4()
    K.set_parent(shape2d('Ship Balloon Pennant', pen2, 0.025, 0.008, M['pen_lime'], Wp2, segs=1,
                         bend=lambda x, y: 0.1 * math.sin(x * 7)), bal_piv)

    for ob in parts:
        K.set_parent(ob, root)
    # Shift everything so the hull-bottom centre is the root origin.
    for ch in list(root.children):
        for mv in (ch.children if ch.name == 'Ship_Balloon' else (ch,)):
            mv.location.y += SHIP_DY
    bpy.context.view_layer.update()
    finish(root, ao, distance=0.7, strength=0.6, keep=(), rays=48, blur=1)
    return root


# ================================================================ finishing


def smooth_ao(ob, iters=3):
    """Blur baked per-vertex AO over mesh edges so large smooth surfaces carry no sampling noise."""
    me = ob.data
    attr = me.color_attributes.get('Color')
    if attr is None:
        return
    n = len(me.vertices)
    val = [0.0] * n
    cnt = [0] * n
    for li, loop in enumerate(me.loops):
        val[loop.vertex_index] += attr.data[li].color[0]
        cnt[loop.vertex_index] += 1
    val = [v / c if c else 1.0 for v, c in zip(val, cnt)]
    nbr = [[] for _ in range(n)]
    for e in me.edges:
        a, b = e.vertices
        nbr[a].append(b)
        nbr[b].append(a)
    for _ in range(iters):
        val = [(val[i] + sum(val[j] for j in nbr[i])) / (1 + len(nbr[i])) if nbr[i] else val[i]
               for i in range(n)]
    for li, loop in enumerate(me.loops):
        a = val[loop.vertex_index]
        attr.data[li].color = (a, a, a, 1.0)


def finish(root, ao, distance, strength, keep=(), rays=40, blur=2):
    """Merge static meshes per pivot and material, then bake AO into COLOR_0."""
    bpy.context.view_layer.update()
    pivots = [root] + [o for o in K.descendants([root]) if o.type == 'EMPTY' and o is not root]
    for piv in pivots:
        kids = [o for o in piv.children if o.type == 'MESH' and not any(o.name.startswith(k) for k in keep)]
        groups = {}
        for o in kids:
            key = tuple(m.name for m in o.data.materials)
            groups.setdefault(key, []).append(o)
        for key, group in groups.items():
            if len(group) < 2:
                if group:
                    group[0].name = f'{piv.name} {key[0]}'
                continue
            K.join(group, f'{piv.name} {key[0]}')
    bpy.context.view_layer.update()
    meshes = [o for o in K.descendants([root]) if o.type == 'MESH']
    for o in meshes:
        o.data.name = o.name
    if ao:
        K.bake_ao(meshes, rays=rays, distance=distance, strength=strength, ground=None)
        for o in meshes:
            smooth_ao(o, blur)
    return root
