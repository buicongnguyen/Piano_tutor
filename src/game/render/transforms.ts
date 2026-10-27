import { Object3D, type Matrix4 } from "three";

// Per-live-object state; never patch engine prototypes or shared asset templates.
const poses = new WeakMap<Object3D, number[]>();
const cached = new WeakSet<Object3D>();
function changedPose(o: Object3D) {
  const p = o.position,
    q = o.quaternion,
    s = o.scale;
  let last = poses.get(o);
  if (
    last &&
    last[0] === p.x &&
    last[1] === p.y &&
    last[2] === p.z &&
    last[3] === q.x &&
    last[4] === q.y &&
    last[5] === q.z &&
    last[6] === q.w &&
    last[7] === s.x &&
    last[8] === s.y &&
    last[9] === s.z
  )
    return false;
  if (!last) poses.set(o, (last = []));
  last[0] = p.x;
  last[1] = p.y;
  last[2] = p.z;
  last[3] = q.x;
  last[4] = q.y;
  last[5] = q.z;
  last[6] = q.w;
  last[7] = s.x;
  last[8] = s.y;
  last[9] = s.z;
  return true;
}

/** r180: keep world traversal/force semantics, skip only unchanged local composition.
 * Explicit updateMatrix/updateWorldMatrix calls retain the original engine behavior. */
export function cacheTransforms(root: Object3D) {
  root.traverse((o) => {
    if (
      cached.has(o) ||
      o.updateMatrixWorld !== Object3D.prototype.updateMatrixWorld ||
      !(
        o.type === "Scene" ||
        o.type === "Group" ||
        o.type === "Object3D" ||
        o.type === "Mesh" ||
        o.type === "InstancedMesh" ||
        o.type === "Points"
      )
    )
      return;
    cached.add(o);
    let parent = o.parent;
    const original = o.updateMatrixWorld;
    o.updateMatrixWorld = function (force?: boolean) {
      if (!this.matrixAutoUpdate) {
        poses.delete(this);
        return original.call(this, force);
      }
      if (parent !== this.parent) {
        this.matrixWorldNeedsUpdate = true;
        parent = this.parent;
      }
      const changed = changedPose(this);
      if (!changed) this.matrixAutoUpdate = false;
      try {
        original.call(this, force);
      } finally {
        this.matrixAutoUpdate = true;
      }
    };
  });
}

/** A key surface relative to its batch parent. Ancestor transforms cancel out.
 * Cache local matrices at double precision, including manually managed matrices. */
export class RelativeTransform {
  private path: Object3D[] = [];
  private last: number[] = [];
  private matrices: Matrix4[] = [];
  update(source: Object3D, parent: Object3D, out: Matrix4) {
    let node: Object3D | null = source,
      n = 0,
      dirty = false;
    while (node && node !== parent) {
      if (this.path[n] !== node) {
        this.path[n] = node;
        dirty = true;
      }
      if (node.matrixAutoUpdate) {
        if (changedPose(node)) node.updateMatrix();
      } else poses.delete(node);
      this.matrices[n] = node.matrix;
      for (let j = 0; j < 16; j++) {
        const v = node.matrix.elements[j],
          index = n * 16 + j;
        if (this.last[index] !== v) {
          this.last[index] = v;
          dirty = true;
        }
      }
      n++;
      node = node.parent;
    }
    if (!node) throw new Error("Piano key must remain inside its batch parent");
    if (this.path.length !== n) dirty = true;
    this.path.length = this.matrices.length = n;
    this.last.length = n * 16;
    if (!dirty) return false;
    out.identity();
    for (let i = n - 1; i >= 0; i--) out.multiply(this.matrices[i]);
    return true;
  }
}
