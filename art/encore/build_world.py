"""Stillnote Encore world scenery kit -> public/models/world-kit.glb (+ art/encore/world-kit.blend).

Deterministic headless generator (fixed seeds, no image textures). Run from the repo root:

    BL=$(node scripts/blender.mjs --where)
    "$BL" -b --factory-startup --python art/encore/build_world.py

Options after `--`:
    --only Tree_Round,Beacon   build a subset (for iteration)
    --out DIR                  write the GLB to DIR instead of public/models
    --noblend                  skip saving art/encore/world-kit.blend

Every prop is one top-level root laid out side by side along X (the runtime clones
roots by name and resets their position). Node/material contracts: CONTRACTS.md.
Builders live in world_nature.py, world_buildings.py, world_landmarks.py and
world_festive.py; shared helpers in world_lib.py.
"""
import bpy, sys, os, json, time, argparse, random, struct

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from aaa_kit import reset, export, ROOT  # noqa: E402
import world_lib  # noqa: E402
from world_lib import bounds, tri_count  # noqa: E402
import world_nature, world_buildings, world_landmarks, world_festive  # noqa: E402

GLB_BUDGET = 2_600_000


def _f32(x):
    """Shortest decimal that parses back to the identical float32 (exporter floats are float32 values)."""
    ref = struct.unpack('<f', struct.pack('<f', x))[0]
    for p in range(1, 10):
        t = float(f'{x:.{p}g}')
        if struct.unpack('<f', struct.pack('<f', t))[0] == ref:
            return t
    return x


def _short_floats(o):
    if isinstance(o, float):
        return _f32(o)
    if isinstance(o, list):
        return [_short_floats(v) for v in o]
    if isinstance(o, dict):
        return {k: _short_floats(v) for k, v in o.items()}
    return o


def quantize_colors(path):
    """Post-process the exported GLB (core glTF 2.0 only, no extensions added):
    * COLOR_0 (baked AO) from normalized UNSIGNED_SHORT to normalized UNSIGNED_BYTE VEC4 (-4 bytes/vertex);
    * JSON floats written as the shortest string that round-trips to the same float32 (min/max stay exact);
    * the optional bufferView `target` hint is dropped.
    The Blender exporter writes one tightly packed bufferView per accessor, which this relies on."""
    with open(path, 'rb') as f:
        data = f.read()
    jlen = struct.unpack_from('<I', data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    off = 20 + jlen
    blen = struct.unpack_from('<I', data, off)[0]
    binchunk = data[off + 8:off + 8 + blen]
    views = j['bufferViews']
    blobs = [binchunk[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in views]
    users = {}
    for a in j['accessors']:
        users[a['bufferView']] = users.get(a['bufferView'], 0) + 1
    color = {p['attributes']['COLOR_0'] for m in j['meshes'] for p in m['primitives'] if 'COLOR_0' in p['attributes']}
    done = 0
    for ai in color:
        a = j['accessors'][ai]
        vi = a['bufferView']
        if a['componentType'] != 5123 or a['type'] != 'VEC4' or users[vi] != 1 or 'byteStride' in views[vi]:
            continue
        n = a['count'] * 4
        vals = struct.unpack_from(f'<{n}H', blobs[vi], a.get('byteOffset', 0))
        blobs[vi] = bytes((x * 255 + 32767) // 65535 for x in vals)
        a['componentType'] = 5121
        a.pop('byteOffset', None)
        for k in ('min', 'max'):
            if k in a:
                a[k] = [round(x * 255 / 65535) for x in a[k]]
        done += 1
    out = bytearray()
    for v in views:
        v.pop('target', None)
    j = _short_floats(j)
    views = j['bufferViews']
    for v, b in zip(views, blobs):
        out += bytes(1) * (-len(out) % 4)
        v['byteOffset'] = len(out)
        v['byteLength'] = len(b)
        out += b
    out += bytes(1) * (-len(out) % 4)
    j['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(out), 0x004E4942) + bytes(out))
    print(f'QUANTIZED COLOR_0 on {done} primitives: {len(data)} -> {total} bytes')
    return total

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--only', default='')
ap.add_argument('--out', default='')
ap.add_argument('--noblend', action='store_true')
args = ap.parse_args(argv)


def main():
    reset()
    world_lib.ob_sdf.clear()
    only = [n for n in args.only.split(',') if n]
    builders = (world_nature.BUILDERS + world_buildings.BUILDERS + world_landmarks.BUILDERS +
                world_festive.BUILDERS)
    roots, stats = [], {}
    x = 0.0
    for i, (name, fn) in enumerate(builders):
        if only and name not in only:
            continue
        random.seed(1000 + i)
        t0 = time.time()
        root = fn()
        assert root.name == name, (root.name, name)
        lo, hi = bounds(root)
        mats = sorted({m.name for o in root.children_recursive if o.type == 'MESH' for m in o.data.materials})
        pivots = [o.name for o in root.children_recursive if o.type == 'EMPTY']
        stats[name] = dict(tris=tri_count(root), size=[round(hi.x - lo.x, 2), round(hi.y - lo.y, 2),
                                                       round(hi.z - lo.z, 2)],
                           z=[round(lo.z, 2), round(hi.z, 2)], materials=mats, pivots=pivots,
                           meshes=sum(1 for o in root.children_recursive if o.type == 'MESH'))
        root.location.x += x - lo.x
        x += (hi.x - lo.x) + 6.0
        roots.append(root)
        s = stats[name]
        print(f'BUILT {name:18s} {s["tris"]:6d} tris  {s["size"]}  meshes={s["meshes"]}  '
              f'{time.time() - t0:5.1f}s  pivots={pivots}')
    out_dir = os.path.abspath(args.out) if args.out else None
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    info = export('world-kit', roots, out_dir=out_dir)
    info['bytes'] = quantize_colors(os.path.join(out_dir or os.path.join(ROOT, 'public', 'models'), 'world-kit.glb'))
    total = sum(s['tris'] for s in stats.values())
    print(f'TOTAL {len(roots)} roots, {total} tris (scene), GLB {info["bytes"]} bytes '
          f'({"OK" if info["bytes"] <= GLB_BUDGET else "OVER"} budget {GLB_BUDGET})')
    stats_path = os.path.join(out_dir or os.path.join(ROOT, 'artifacts'), 'world-kit-stats.json')
    os.makedirs(os.path.dirname(stats_path), exist_ok=True)
    with open(stats_path, 'w') as f:
        json.dump(dict(glb_bytes=info['bytes'], glb_tris=info['tris'], meshes=info['meshes'],
                       materials=info['materials'], roots=stats), f, indent=1)
    missing = [n for n, _ in builders if n not in stats and not only]
    if missing:
        print('MISSING ROOTS', missing)
    if not args.noblend and not only:
        path = os.path.join(HERE, 'world-kit.blend')
        bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
        print('SAVED', path)


main()
