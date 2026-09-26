"""Build the Stillnote Encore characters kit: public/models/characters.glb.

    BL=$(node scripts/blender.mjs --where)
    "$BL" -b --factory-startup --python art/encore/build_characters.py

Roots (see art/encore/CONTRACTS.md and CHARACTERS.md):
    Coda         golden eighth-note sprite (~0.9 m), origin at the bottom of the body
    Hush         the huge sleepy cloud (~6 m wide), origin at its centre
    Encore_Ship  the flying grand piano (~6 m long), origin at the centre of the hull bottom

Neutral poses only; expression variants live in render_portraits.py. The script checks
the pivot/material contract and the budgets after export and exits non-zero on failure.
Also saves an editable art/encore/characters.blend (compressed, roots spread along X).
"""
import sys, os, json, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import aaa_kit as K
import char_lib as C

BUDGET_BYTES = 1_300_000
TRI_LIMITS = {'Coda': 9000, 'Hush': 9000, 'Encore_Ship': 20000}
PIVOTS = {
    'Coda': ['Coda_Body', 'Coda_WingL', 'Coda_WingR', 'Coda_Flag', 'Coda_EyeL', 'Coda_EyeR'],
    'Hush': ['Hush_Body', 'Hush_EyeL', 'Hush_EyeR', 'Hush_Cap'],
    'Encore_Ship': ['Ship_Lid', 'Ship_PropL', 'Ship_PropR', 'Ship_Balloon'],
}
MATERIALS = ['Ship Lacquer']


def glb_json(path):
    with open(path, 'rb') as f:
        data = f.read()
    n = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + n]), len(data)


def subtree_tris(j, node_index):
    tris, stack = 0, [node_index]
    while stack:
        nd = j['nodes'][stack.pop()]
        if 'mesh' in nd:
            for p in j['meshes'][nd['mesh']]['primitives']:
                acc = j['accessors'][p['indices']] if 'indices' in p else j['accessors'][p['attributes']['POSITION']]
                tris += acc['count'] // 3
        stack.extend(nd.get('children', []))
    return tris


def verify(path):
    j, size = glb_json(path)
    names = {nd.get('name'): i for i, nd in enumerate(j['nodes'])}
    errors, report = [], {}
    for root, pivots in PIVOTS.items():
        if root not in names:
            errors.append(f'missing root {root}')
            continue
        ri = names[root]
        report[root] = subtree_tris(j, ri)
        if report[root] > TRI_LIMITS[root]:
            errors.append(f'{root}: {report[root]} tris > {TRI_LIMITS[root]}')
        for pv in pivots:
            if pv not in names:
                errors.append(f'missing pivot {pv}')
                continue
            nd = j['nodes'][names[pv]]
            rot = nd.get('rotation', [0, 0, 0, 1])
            if max(abs(a - b) for a, b in zip(rot, [0, 0, 0, 1])) > 1e-5:
                errors.append(f'{pv} rest rotation is not identity: {rot}')
    mat_names = [m.get('name') for m in j.get('materials', [])]
    for m in MATERIALS:
        if m not in mat_names:
            errors.append(f'missing material {m}')
    if j.get('images'):
        errors.append('GLB contains images (textures are not allowed)')
    for m in j['meshes']:
        for p in m['primitives']:
            if 'COLOR_0' not in p['attributes']:
                errors.append(f'mesh {m.get("name")} lacks COLOR_0')
                break
    if size > BUDGET_BYTES:
        errors.append(f'GLB is {size} bytes > {BUDGET_BYTES}')
    return report, size, errors, mat_names


def main():
    K.reset()
    coda = C.build_coda('neutral')
    hush = C.build_hush('neutral')
    ship = C.build_ship()
    for r in (coda, hush, ship):
        objs = K.descendants([r])
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ v.co for o in objs if o.type == 'MESH' for v in o.data.vertices]
        lo = [min(p[i] for p in pts) for i in range(3)]
        hi = [max(p[i] for p in pts) for i in range(3)]
        print(f'ROOT {r.name}: {C.tris(objs)} tris, size {[round(h - l, 3) for l, h in zip(lo, hi)]}, '
              f'min {[round(v, 3) for v in lo]}, max {[round(v, 3) for v in hi]}')
    K.export('characters', [coda, hush, ship])
    path = os.path.join(K.OUT, 'characters.glb')
    report, size, errors, mat_names = verify(path)
    print('GLB', path, size, 'bytes;', report)
    print('MATERIALS', mat_names)

    # Editable scene: spread the roots so they do not overlap.
    coda.location.x = -5.0
    ship.location.x = 6.5
    hush.location.x = -12.0
    hush.location.z = 3.2
    blend = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'characters.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print('SAVED', blend)
    if errors:
        for e in errors:
            print('CONTRACT ERROR:', e)
        sys.exit(1)
    print('CONTRACT OK')


if __name__ == '__main__':
    main()
