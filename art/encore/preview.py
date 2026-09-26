"""Contact-sheet renderer for reviewing exported GLBs under the shared lighting.

    blender -b --factory-startup --python art/encore/preview.py -- \
        --glb public/models/world-kit.glb --out artifacts/previews/world.png \
        [--nodes Tree_Pine,House_Cottage] [--cols 5] [--size 1800x1100] [--night] [--samples 48]

Every top-level glTF node is laid out in a labelled grid, viewed 3/4 from the
front (-Y in Blender is the asset's front), lit by a warm key, cool fill and rim.
The Standard view transform keeps the vivid palette honest (AgX desaturates it).
"""
import bpy, sys, os, math, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--glb', action='append', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--nodes', default='')
ap.add_argument('--cols', type=int, default=0)
ap.add_argument('--size', default='1800x1100')
ap.add_argument('--night', action='store_true')
ap.add_argument('--samples', type=int, default=48)
ap.add_argument('--labels', type=int, default=1)
ap.add_argument('--elev', type=float, default=24)
ap.add_argument('--azim', type=float, default=-32)
ap.add_argument('--normalize', action='store_true', help='scale each root to the same display size')
args = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
wanted = [n for n in args.nodes.split(',') if n]

roots = []
for path in args.glb:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    new = [o for o in bpy.data.objects if o not in before]
    roots += [o for o in new if o.parent is None]
if wanted:
    keep = [o for o in roots if o.name.split('.')[0] in wanted]
    order = {n: i for i, n in enumerate(wanted)}
    keep.sort(key=lambda o: order.get(o.name.split('.')[0], 99))
    for o in roots:
        if o not in keep:
            for d in [o] + list(o.children_recursive):
                bpy.data.objects.remove(d, do_unlink=True)
    roots = keep

bpy.context.view_layer.update()


def bounds(root):
    pts = []
    for o in [root] + list(root.children_recursive):
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    if not pts:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


if args.normalize:
    for r in roots:
        a, b = bounds(r)
        k = 2.0 / max(b.x - a.x, b.y - a.y, b.z - a.z, 1e-3)
        r.scale = (r.scale.x * k, r.scale.y * k, r.scale.z * k)
    bpy.context.view_layer.update()

# Lay out the roots in a grid on the XY plane, each sitting on z=0.
cols = args.cols or max(1, math.ceil(math.sqrt(len(roots) * 1.6)))
cells = [bounds(r) for r in roots]
cell = max([max(hi.x - lo.x, hi.y - lo.y) for lo, hi in cells] + [1.0]) * 1.25
for i, (r, (lo, hi)) in enumerate(zip(roots, cells)):
    cx, cy = (i % cols) * cell, -(i // cols) * cell
    center = (lo + hi) / 2
    r.location += Vector((cx - center.x, cy - center.y, -lo.z))
    if args.labels:
        bpy.ops.object.text_add(location=(cx - cell * .42, cy - cell * .46, 0.01))
        t = bpy.context.object
        t.data.body = r.name.split('.')[0]
        t.data.size = cell * .07
        m = bpy.data.materials.new('label')
        m.diffuse_color = (0.05, 0.05, 0.08, 1)
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (0.03, 0.03, 0.06, 1)
        t.data.materials.append(m)
bpy.context.view_layer.update()

lo = Vector((1e9, 1e9, 1e9)); hi = -lo
for r in roots:
    a, b = bounds(r)
    lo = Vector((min(lo.x, a.x), min(lo.y, a.y), min(lo.z, a.z)))
    hi = Vector((max(hi.x, b.x), max(hi.y, b.y), max(hi.z, b.z)))
center = (lo + hi) / 2
span = max(hi.x - lo.x, hi.y - lo.y, (hi.z - lo.z) * 1.6, 1.0)

# Ground
bpy.ops.mesh.primitive_plane_add(size=span * 8, location=(center.x, center.y, 0))
g = bpy.context.object
gm = bpy.data.materials.new('ground')
gm.use_nodes = True
gb = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
gb.inputs['Base Color'].default_value = (0.02, 0.025, 0.06, 1) if args.night else (0.3, 0.33, 0.4, 1)
gb.inputs['Roughness'].default_value = .9
g.data.materials.append(gm)

# Camera
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
el, az = math.radians(args.elev), math.radians(args.azim)
w, h = map(int, args.size.split('x'))
aspect = w / h
scene.render.resolution_x, scene.render.resolution_y = w, h
d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
target = center + Vector((0, 0, (hi.z - lo.z) * .15))
cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
# Fit: shrink/grow the distance until every prop's bounding box just fills the frame.
from bpy_extras.object_utils import world_to_camera_view
corners = []
for r in roots:
    a, b = bounds(r)
    corners += [Vector((x, y, z)) for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]
lo_d, hi_d = 0.1, span * 20
for _ in range(40):
    dist = (lo_d + hi_d) / 2
    cam.location = target + d * dist
    bpy.context.view_layer.update()
    ok = all(.03 <= c.x <= .97 and .03 <= c.y <= .97 and c.z > 0
             for c in (world_to_camera_view(scene, cam, p) for p in corners))
    lo_d, hi_d = (lo_d, dist) if ok else (dist, hi_d)
dist = hi_d
cam.location = target + d * dist
cam.data.clip_end = dist * 10


def light(name, kind, energy, color, rot, size=1.0):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == 'SUN':
        ld.angle = math.radians(size)
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.rotation_euler = [math.radians(v) for v in rot]
    return ob


if args.night:
    light('key', 'SUN', 1.2, (0.62, 0.72, 1.0), (52, 0, -35), 6)
    light('rim', 'SUN', 1.4, (0.45, 0.6, 1.0), (60, 0, 150), 4)
    world_col, world_str = (0.01, 0.02, 0.06), 0.6
else:
    light('key', 'SUN', 4.2, (1.0, 0.9, 0.78), (48, 0, -38), 4)
    light('fill', 'SUN', 1.1, (0.62, 0.78, 1.0), (62, 0, 125), 12)
    light('rim', 'SUN', 2.0, (1.0, 0.95, 0.9), (70, 0, 175), 3)
    world_col, world_str = (0.55, 0.7, 0.95), 0.75

world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (*world_col, 1)
bg.inputs['Strength'].default_value = world_str

scene.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            if any(d.type == backend for d in prefs.devices):
                for dev in prefs.devices:
                    dev.use = dev.type == backend
                scene.cycles.device = 'GPU'
                break
        except Exception:
            continue
except Exception:
    pass
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = w, h
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'PNG'
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
scene.render.filepath = os.path.abspath(args.out)
bpy.ops.render.render(write_still=True)
print('PREVIEW', args.out, len(roots), 'roots')
