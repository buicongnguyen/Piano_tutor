"""Render the dialogue portraits and the key art for Stillnote Encore.

    BL=$(node scripts/blender.mjs --where)
    "$BL" -b --factory-startup --python art/encore/render_portraits.py [-- --only coda-happy,keyart] [--samples 160]

Outputs
    public/art/portraits/{coda-happy,coda-wow,coda-determined,hush-sleepy,hush-sad,hush-smile}.png
        512x512 RGBA, transparent film, head-and-shoulders 3/4 framing (character fills ~80%).
    public/art/keyart.jpg
        1600x900 JPEG: the Encore sailing a golden-hour sky over a vivid sea of floating islands,
        Coda flying alongside, clear sky top-centre for the logo.

Characters come from char_lib (the same builders as characters.glb); expressions are built here as
pose/feature variants (eyelids, brows, mouth shapes, pivot rotations). Cycles on the GPU (OptiX when
available), Standard view transform so the palette stays vivid, warm key + cool fill + rim lights.
"""
import sys, os, math, argparse, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
import aaa_kit as K
import char_lib as C
from palette import toy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--only', default='')
ap.add_argument('--samples', type=int, default=0)
ap.add_argument('--out', default='')
ap.add_argument('--scale', type=float, default=1.0)
args = ap.parse_args(argv)

ROOT = K.ROOT
PORTRAIT_DIR = os.path.join(ROOT, 'public', 'art', 'portraits')
KEYART_PATH = os.path.join(ROOT, 'public', 'art', 'keyart.jpg')


# ---------------------------------------------------------------- render plumbing

def use_gpu(scene):
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
                    print('GPU', backend)
                    return backend
            except Exception:
                continue
    except Exception:
        pass
    print('GPU unavailable, rendering on CPU')
    return 'CPU'


def setup_render(scene, w, h, samples, transparent):
    backend = use_gpu(scene)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = 'OPTIX' if backend == 'OPTIX' else 'OPENIMAGEDENOISE'
    except Exception:
        pass
    scene.cycles.max_bounces = 8
    scene.cycles.glossy_bounces = 4
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.sample_clamp_indirect = 8.0
    scene.render.resolution_x, scene.render.resolution_y = int(w * args.scale), int(h * args.scale)
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.render.dither_intensity = 0.0 if transparent else 1.0


def look_at(ob, target, roll=0.0):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if roll:
        ob.rotation_euler.rotate_axis('Z', roll)


def area(name, energy, color, loc, target, size, shape='DISK'):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.shape = shape
    ld.size = size
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    look_at(ob, target)
    return ob


def sun(name, energy, color, rot, angle=3.0):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.color = color
    ld.angle = math.radians(angle)
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = [math.radians(v) for v in rot]
    return ob


def world_color(color, strength):
    w = bpy.data.worlds.new('World')
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (*color, 1)
    bg.inputs['Strength'].default_value = strength
    return w


def mesh_points(root, names=None):
    bpy.context.view_layer.update()
    pts = []
    for o in K.descendants([root]):
        if o.type != 'MESH':
            continue
        if names and not any(n in o.name for n in names):
            continue
        mw = o.matrix_world
        pts += [mw @ v.co for i, v in enumerate(o.data.vertices) if i % 3 == 0]
    return pts


def fit_camera(cam, pts, direction, fill=0.8, lens=85.0, bias=(0.0, 0.0)):
    """Place cam along `direction` from the points' centre so their projection fills `fill` of the
    frame and is centred (bias shifts the framing in frame units)."""
    scene = bpy.context.scene
    cam.data.lens = lens
    cam.data.sensor_fit = 'AUTO'
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    target = (lo + hi) / 2
    fov = 2 * math.atan(36 / 2 / lens)
    dist = (hi - lo).length / 2 / math.tan(fov / 2)
    d = Vector(direction).normalized()
    aspect = scene.render.resolution_x / scene.render.resolution_y
    for _ in range(8):
        cam.location = target + d * dist
        look_at(cam, target)
        bpy.context.view_layer.update()
        ndc = [world_to_camera_view(scene, cam, p) for p in pts]
        xs, ys = [q.x for q in ndc], [q.y for q in ndc]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        span = max(max(xs) - min(xs), (max(ys) - min(ys)))
        # re-centre: shift the target by the NDC offset measured at the target's depth
        width = 2 * dist * math.tan(fov / 2)
        right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
        up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
        wx, wy = (width, width / aspect) if aspect >= 1 else (width * aspect, width)
        target += right * (cx - 0.5 - bias[0]) * wx + up * (cy - 0.5 - bias[1]) * wy
        dist *= span / fill
    cam.location = target + d * dist
    look_at(cam, target)
    return target, dist


def rot_pivot(root, name, deg):
    for o in K.descendants([root]):
        if o.name == name:
            o.rotation_euler = [math.radians(v) for v in deg]
            return o
    raise KeyError(name)


def save_png(path):
    scene = bpy.context.scene
    s = scene.render.image_settings
    s.file_format = 'PNG'
    s.color_mode = 'RGBA'
    s.color_depth = '8'
    s.compression = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('WROTE', path, os.path.getsize(path), 'bytes')


# ---------------------------------------------------------------- portraits

PORTRAITS = {
    # name: (character, expression, pivot poses, camera azimuth/elevation, extra)
    'coda-happy': ('coda', 'happy', {'Coda_Body': (0, -9, 0), 'Coda_WingL': (0, -24, 0), 'Coda_WingR': (0, 24, 0),
                                      'Coda_Flag': (0, -10, 0)}, (-24, 6)),
    'coda-wow': ('coda', 'wow', {'Coda_Body': (-8, 4, 0), 'Coda_WingL': (0, -46, 0), 'Coda_WingR': (0, 46, 0),
                                  'Coda_Flag': (0, -22, 0)}, (-20, 4)),
    'coda-determined': ('coda', 'determined', {'Coda_Body': (9, 4, 0), 'Coda_WingL': (0, 10, 0),
                                               'Coda_WingR': (0, -10, 0), 'Coda_Flag': (0, 6, 0)}, (-28, 8)),
    'hush-sleepy': ('hush', 'sleepy', {'Hush_Body': (0, 6, 0), 'Hush_Cap': (0, 5, 0)}, (-18, 4)),
    'hush-sad': ('hush', 'sad', {'Hush_Body': (4, -4, 0), 'Hush_Cap': (0, 8, 0), 'Hush_ArmL': (0, 20, 0),
                                 'Hush_ArmR': (0, -20, 0)}, (-20, 6)),
    'hush-smile': ('hush', 'smile', {'Hush_Body': (0, -5, 0), 'Hush_Cap': (0, -4, 0), 'Hush_ArmL': (0, -35, 0),
                                     'Hush_ArmR': (0, 35, 0)}, (-22, 5)),
}


def portrait(name, samples):
    who, expr, poses, (az, el) = PORTRAITS[name]
    scene = K.reset()
    setup_render(scene, 512, 512, samples, transparent=True)
    root = C.build_coda(expr, ao=False) if who == 'coda' else C.build_hush(expr, ao=False)
    for piv, deg in poses.items():
        rot_pivot(root, piv, deg)
    bpy.context.view_layer.update()
    s = 1.0 if who == 'coda' else 6.2
    azr, elr = math.radians(az), math.radians(el)
    direction = Vector((math.sin(azr) * math.cos(elr), -math.cos(azr) * math.cos(elr), math.sin(elr)))
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    pts = mesh_points(root)
    if who == 'hush':
        # head-and-shoulders: keep the face, the cap and the upper cloud; crop the underbelly a little
        pts = [p for p in pts if p.z > -1.2]
    else:
        # head-and-shoulders for a note: the round head fills the card, the flag tip may kiss the top edge
        pts = [p for p in pts if p.z < 0.95]
    target, dist = fit_camera(cam, pts, direction, fill=0.86 if who == 'coda' else 0.8,
                              lens=70 if who == 'coda' else 60,
                              bias=(0.0, -0.01))
    cam.data.clip_start = dist * 0.05
    cam.data.clip_end = dist * 20
    # Lights relative to the camera: warm key upper-left, cool fill right, warm-white rim behind.
    right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
    up = Vector((0, 0, 1))
    back = -direction
    area('Key', 130 * s * s, (1.0, 0.96, 0.9), target + (direction * 2.2 - right * 1.9 + up * 1.7) * s, target,
         1.6 * s)
    area('Fill', 48 * s * s, (0.62, 0.76, 1.0), target + (direction * 2.0 + right * 2.4 + up * 0.2) * s, target,
         2.2 * s)
    area('Rim', 150 * s * s, (1.0, 0.93, 0.82), target + (back * 2.2 + right * 1.4 + up * 1.6) * s, target,
         1.0 * s)
    area('Rim2', 70 * s * s, (0.7, 0.8, 1.0), target + (back * 2.0 - right * 1.8 + up * 0.8) * s, target,
         1.0 * s)
    world_color((0.55, 0.62, 0.8), 0.35)
    os.makedirs(PORTRAIT_DIR, exist_ok=True)
    save_png(args.out or os.path.join(PORTRAIT_DIR, name + '.png'))


# ---------------------------------------------------------------- key art scene


def mat_nodes(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    return m, nt, next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')


SUN_DIR = Vector((-0.17, 0.985, 0.045)).normalized()   # towards the low sun (visible, left of frame)


def sky_world():
    """Golden-hour gradient sky with a low sun disc and halo (all procedural)."""
    w = bpy.data.worlds.new('Golden Hour')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'B_SPLINE'
    stops = [(0.0, '#f0a24a'), (0.49, '#ffc664'), (0.5, '#ffd36c'), (0.515, '#ffc070'), (0.54, '#ffab7a'),
             (0.572, '#f7a1a4'), (0.605, '#b4aef0'), (0.645, '#62a3f6'), (0.75, '#3a80e8'), (1.0, '#2254c6')]
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*K.srgb(stops[0][1]), 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*K.srgb(stops[-1][1]), 1)
    for pos, col in stops[1:-1]:
        e = cr.elements.new(pos)
        e.color = (*K.srgb(col), 1)
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1.0
    mr.inputs['From Max'].default_value = 1.0
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])

    def dot_pow(power, gain, color, src):
        dot = nt.nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = tuple(SUN_DIR)
        nt.links.new(tc.outputs['Generated'], dot.inputs[0])
        mx = nt.nodes.new('ShaderNodeMath')
        mx.operation = 'MAXIMUM'
        mx.inputs[1].default_value = 0.0
        nt.links.new(dot.outputs['Value'], mx.inputs[0])
        pw = nt.nodes.new('ShaderNodeMath')
        pw.operation = 'POWER'
        pw.inputs[1].default_value = power
        nt.links.new(mx.outputs[0], pw.inputs[0])
        g = nt.nodes.new('ShaderNodeMath')
        g.operation = 'MULTIPLY'
        g.inputs[1].default_value = gain
        nt.links.new(pw.outputs[0], g.inputs[0])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'ADD'
        mix.clamp_result = False
        mix.inputs['B'].default_value = (*K.srgb(color), 1)
        nt.links.new(g.outputs[0], mix.inputs['Factor'])
        nt.links.new(src, mix.inputs['A'])
        return mix.outputs['Result']

    c = dot_pow(6.0, 0.45, '#ffb040', ramp.outputs['Color'])      # wide warm halo
    c = dot_pow(90.0, 0.5, '#ffd27a', c)                           # tight glow
    c = dot_pow(3000.0, 1.6, '#ffe2a0', c)                         # sun disc
    nt.links.new(c, bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs['Surface'])


def sea():
    bpy.ops.mesh.primitive_plane_add(size=8000, location=(0, 0, -16))
    ob = bpy.context.object
    ob.name = 'Sea'
    m, nt, b = mat_nodes('Sea')
    b.inputs['Base Color'].default_value = (*K.srgb('#0793e6'), 1)
    b.inputs['Roughness'].default_value = 0.14
    b.inputs['IOR'].default_value = 1.33
    try:
        b.inputs['Specular IOR Level'].default_value = 0.2
    except Exception:
        pass
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.22, 0.08, 0.22)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    wave = nt.nodes.new('ShaderNodeTexNoise')
    wave.inputs['Scale'].default_value = 1.4
    wave.inputs['Detail'].default_value = 5.0
    wave.inputs['Roughness'].default_value = 0.55
    nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.3
    bump.inputs['Distance'].default_value = 0.3
    nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    ob.data.materials.append(m)
    return ob


def cloud(name, center, size, seed, material, flat=0.7, n=10):
    """A puffy cumulus: the Hush's smooth-union cloud builder with random puffs and a flattish base."""
    rng = random.Random(seed)
    puffs = [((0.0, 0.0, 0.1), 1.0)]
    for i in range(n):
        a = rng.uniform(-math.pi, math.pi)
        x = math.cos(a) * rng.uniform(0.7, 1.6)
        y = math.sin(a) * rng.uniform(0.2, 0.6)
        z = rng.uniform(0.0, 0.6)
        puffs.append(((x, y, z), rng.uniform(0.5, 0.9)))
    puffs.append(((0.2, 0.0, 0.85), 0.7))
    bm, dirs = C._cube_dirs(12)
    O, t = C.cloud_radii(dirs, puffs=puffs, k=0.3, origin=(0, 0, 0.2))
    for v, d, r in zip(bm.verts, dirs, t):
        p = Vector(O) + d * float(r)
        if p.z < -0.25:
            p.z = -0.25 - (p.z + 0.25) * 0.15
        v.co = p
    ob = K.from_bmesh(name, bm, material, smooth_angle=89)
    ob.scale = (size, size * 0.75, size * flat)
    ob.location = center
    return ob


def island(name, center, radius, seed, M, trees=4, beacon=False, house=False):
    rng = random.Random(seed)
    c = Vector(center)
    # Grass top: a thick domed cap with a rounded lip; soil band; lumpy rock cone below.
    K.lathe(name + ' Top', [(0.0, 0.55), (radius * 0.55, 0.5), (radius * 0.9, 0.34), (radius * 1.02, 0.1),
                            (radius * 1.03, -0.2), (radius * 0.98, -0.35)], M['grass'], seg=40, loc=c,
            smooth_angle=50)
    K.lathe(name + ' Soil', [(radius * 0.99, -0.3), (radius * 1.0, -0.75), (radius * 0.9, -1.15)], M['soil'],
            seg=40, loc=c, smooth_angle=50)
    under = [(radius * 0.93, -1.0), (radius * 0.85, -radius * 0.3), (radius * 0.62, -radius * 0.58),
             (radius * 0.36, -radius * 0.86), (radius * 0.12, -radius * 1.08), (0.0, -radius * 1.14)]
    rock = K.lathe(name + ' Rock', under, M['rock'], seg=30, loc=c, smooth_angle=30)
    for v in rock.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        k = 1 + 0.1 * math.sin(a * 5 + seed) + 0.06 * math.sin(a * 11 + seed * 2)
        v.co.x *= k
        v.co.y *= k
    s = radius / 6
    for i in range(trees):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0.2, 0.72) * radius
        base = c + Vector((math.cos(a) * r, math.sin(a) * r, 0.35))
        h = rng.uniform(1.4, 2.2) * s
        K.cyl(name + ' Trunk', 0.16 * s, h, base + Vector((0, 0, h / 2)), M['bark'], verts=8)
        col = [M['leaf'], M['blossom'], M['leaf'], M['maple']][i % 4]
        C.ball(name + ' Crown', 1.0 * s, base + Vector((0, 0, h + 0.6 * s)), col, seg=18, rings=10)
    if house:
        base = c + Vector((-radius * 0.2, radius * 0.15, 0.4))
        K.box(name + ' House', (2.2 * s, 2.0 * s, 1.8 * s), base + Vector((0, 0, 0.9 * s)), M['wall'], bevel=0.2 * s)
        K.box(name + ' Roof', (2.6 * s, 2.3 * s, 1.1 * s), base + Vector((0, 0, 2.2 * s)), M['coral'], bevel=0.2 * s,
              taper=(0.15, 1.0))
        K.box(name + ' Window', (0.5 * s, 0.1 * s, 0.6 * s), base + Vector((0.4 * s, -1.0 * s, 1.0 * s)), M['glow'],
              bevel=0.05 * s)
    if beacon:
        base = c + Vector((radius * 0.28, -radius * 0.05, 0.4))
        hgt = radius * 1.25
        K.lathe(name + ' Tower', [(0.0, 0.0), (radius * 0.17, 0.0), (radius * 0.12, hgt), (0.0, hgt)], M['ivory'],
                seg=18, loc=base, smooth_angle=40)
        for f in (0.28, 0.6):
            K.torus(name + ' Band', radius * 0.16 - f * radius * 0.05, radius * 0.035,
                    base + Vector((0, 0, hgt * f)), M['coral'], maj=18, mn=6)
        C.ball(name + ' Lamp', radius * 0.14, base + Vector((0, 0, hgt + radius * 0.12)), M['glow'], seg=16,
                 rings=8)
        K.lathe(name + ' Roof', [(0.0, radius * 0.4), (radius * 0.22, 0.0), (0.0, 0.0)], M['coral'], seg=18,
                loc=base + Vector((0, 0, hgt + radius * 0.24)))


def music_note(name, loc, size, rot_z, M):
    """A little golden eighth note sparkling in Coda's wake."""
    loc = Vector(loc)
    R = Matrix.Rotation(rot_z, 3, 'Z')
    C.ball(name + ' Head', (0.17 * size, 0.1 * size, 0.13 * size), loc, M['gold'], seg=14, rings=8,
             rot=(R @ Matrix.Rotation(math.radians(-22), 3, 'Y')).to_euler())
    a = loc + R @ Vector((0.14 * size, 0, 0.03 * size))
    b = loc + R @ Vector((0.14 * size, 0, 0.66 * size))
    K.rod(name + ' Stem', a, b, 0.028 * size, M['gold'], verts=8)
    K.tube(name + ' Flag', [b + R @ Vector((x * size, 0, -z * size))
                            for x, z in ((0, 0), (0.1, 0.07), (0.18, 0.18), (0.16, 0.32))],
           0.035 * size, M['gold'], verts=8)


KEYART = dict(
    cam=((-0.9, -14.6, 3.9), (2.4, 0.0, 2.75), 30),
    ship=((0.0, 0.0, 0.0), (3, -7, 50)),
    coda=((4.1, -7.6, 2.7), (6, -12, -30), 1.7),
)


def keyart(samples):
    scene = K.reset()
    setup_render(scene, 1600, 900, samples, transparent=False)
    scene.cycles.max_bounces = 6
    sky_world()
    M = dict(
        grass=toy('KA Grass', 'grass', 'satin'), leaf=toy('KA Leaf', 'leaf', 'satin'),
        blossom=toy('KA Blossom', 'blossom', 'satin'), maple=toy('KA Maple', 'maple', 'satin'),
        bark=toy('KA Bark', 'bark', 'satin'), rock=toy('KA Rock', 'rock', 'matte'),
        soil=toy('KA Soil', 'soil', 'matte'), wall=toy('KA Wall', 'wall_cream', 'satin'),
        ivory=toy('KA Ivory', 'ivory', 'gloss'), coral=toy('KA Coral', 'coral', 'gloss'),
        glow=toy('KA Beacon Light', 'window_glow', 'gloss', emit=6.0),
        gold=toy('KA Note Gold', 'sunshine', 'metal'),
        cloud=toy('KA Cloud', '#fff4e6', 'matte'),
    )
    sea()

    # The Encore, banking gently as it sails to the right and toward us.
    ship = C.build_ship(ao=False)
    loc, rot = KEYART['ship']
    ship.location = loc
    ship.rotation_euler = [math.radians(v) for v in rot]
    rot_pivot(ship, 'Ship_PropL', (0, 30, 0))
    rot_pivot(ship, 'Ship_PropR', (0, -40, 0))

    # Coda flying alongside, nearer the camera, wings up and flag flicked.
    coda = C.build_coda('happy', ao=False)
    loc, rot, sc = KEYART['coda']
    coda.location = loc
    coda.rotation_euler = [math.radians(v) for v in rot]
    coda.scale = (sc, sc, sc)
    rot_pivot(coda, 'Coda_WingL', (0, -42, 0))
    rot_pivot(coda, 'Coda_WingR', (0, 42, 0))
    rot_pivot(coda, 'Coda_Flag', (0, -14, 0))
    cl = Vector(loc)
    for i, (dx, dy, dz, s, r) in enumerate(((-1.25, 1.1, -0.35, 0.5, 0.3), (-2.35, 2.3, -0.8, 0.4, -0.2),
                                             (-3.3, 3.5, -1.25, 0.32, 0.4), (-0.9, 0.7, 1.55, 0.34, -0.3))):
        music_note(f'Note {i}', cl + Vector((dx, dy, dz)), s, r, M)

    # Floating islands (one with a music-box beacon, one with a cottage) and cumulus clouds.
    island('Isle A', (-23, 70, 3.0), 8.0, 3, M, trees=4, beacon=True)
    island('Isle B', (36, 96, 7.0), 11.0, 5, M, trees=5, house=True)
    island('Isle C', (-64, 150, 12.0), 13.0, 8, M, trees=5)
    island('Isle D', (18, 185, 3.0), 8.0, 11, M, trees=3)
    island('Isle E', (15, 34, -6.5), 3.4, 13, M, trees=2)
    clouds = [((-10.5, 4, -8.5), 5.5, 1, 0.65), ((17, 19, -12.5), 5.2, 2, 0.6), ((-34, 62, -4), 7.5, 3, 0.7),
              ((52, 112, 1), 10.0, 4, 0.7), ((-100, 260, 6), 26.0, 6, 0.55), ((105, 290, 9), 30.0, 7, 0.55),
              ((5, 330, 2), 24.0, 9, 0.45), ((-40, 46, 21), 6.0, 10, 0.75),
              ((-22, 30, -12), 4.0, 14, 0.6)]
    for i, (c, s, seed, flat) in enumerate(clouds):
        cloud(f'Cloud {i}', c, s, seed, M['cloud'], flat=flat)

    # Lights: golden back-sun matching the visible sun, warm front key for faces, sky fill from the world.
    back = sun('Sun', 3.4, (1.0, 0.74, 0.42), (0, 0, 0), angle=3)
    back.rotation_euler = (-SUN_DIR).to_track_quat('-Z', 'Y').to_euler()
    back.visible_glossy = False     # the sea reflects the sky's sun glow, not a hot lamp highlight
    key_dir = Vector((-0.62, -0.62, 0.48)).normalized()
    key = sun('Key', 2.6, (1.0, 0.86, 0.68), (0, 0, 0), angle=6)
    key.rotation_euler = (-key_dir).to_track_quat('-Z', 'Y').to_euler()

    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    (cl_, tg, lens) = KEYART['cam']
    cam.data.lens = lens
    cam.data.clip_end = 6000
    cam.location = cl_
    look_at(cam, tg)

    # Compositor: fog glow on the sun, the beacon lamp and hot highlights.
    scene.use_nodes = True
    nt = scene.node_tree
    rl = next(n for n in nt.nodes if n.type == 'R_LAYERS')
    comp = next(n for n in nt.nodes if n.type == 'COMPOSITE')
    glare = nt.nodes.new('CompositorNodeGlare')
    glare.glare_type = 'FOG_GLOW'
    for attr, val in (('quality', 'HIGH'), ('threshold', 1.25), ('size', 8), ('mix', -0.65)):
        try:
            setattr(glare, attr, val)
        except Exception:
            pass
    nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
    nt.links.new(glare.outputs['Image'], comp.inputs['Image'])

    st = scene.render.image_settings
    st.file_format = 'JPEG'
    st.color_mode = 'RGB'
    st.quality = 85
    scene.render.filepath = args.out or KEYART_PATH
    bpy.ops.render.render(write_still=True)
    print('WROTE', scene.render.filepath, os.path.getsize(scene.render.filepath), 'bytes')


def main():
    only = [n for n in args.only.split(',') if n]
    jobs = list(PORTRAITS) + ['keyart']
    for job in jobs:
        if only and job not in only:
            continue
        if job == 'keyart':
            keyart(args.samples or 220)
        else:
            portrait(job, args.samples or 256)


main()
