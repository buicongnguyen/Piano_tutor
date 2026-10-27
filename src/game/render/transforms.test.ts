import { expect, it } from "vitest";
import { Group, Object3D, Matrix4 } from "three";
import { cacheTransforms, RelativeTransform } from "./transforms";

it("matches normal world transforms through motion, scale, reparenting, visibility and explicit updates", () => {
  const make = () => {
    const root = new Group(),
      a = new Group(),
      b = new Group(),
      child = new Object3D();
    root.add(a, b);
    a.add(child);
    return { root, a, b, child };
  };
  const normal = make(),
    fast = make();
  cacheTransforms(fast.root);
  const compare = () => {
    normal.root.updateMatrixWorld();
    fast.root.updateMatrixWorld();
    for (const name of ["root", "a", "b", "child"] as const)
      expect(fast[name].matrixWorld.elements).toEqual(
        normal[name].matrixWorld.elements,
      );
  };
  compare();
  compare();
  const actions: ((tree: ReturnType<typeof make>) => void)[] = [
    ({ a }) => a.position.set(3, 4, 5),
    ({ child }) => child.rotation.set(0.2, 0.6, 0.1),
    ({ root }) => root.scale.set(0.4, 1.5, 2),
    ({ a }) => {
      a.visible = false;
      a.rotation.y = 0.8;
    },
    ({ child, b }) => b.add(child),
    ({ child }) => {
      child.position.x = 9;
      child.updateWorldMatrix(true, false);
    },
    ({ b }) => {
      b.matrixAutoUpdate = false;
      b.matrix.makeTranslation(12, 1, 3);
      b.matrixWorldNeedsUpdate = true;
    },
    ({ b }) => {
      b.matrixAutoUpdate = true;
    },
    ({ child }) => {
      child.position.z = 8;
      child.updateMatrix();
    },
    ({ root }) => root.updateMatrixWorld(true),
    ({ a }) => {
      a.visible = true;
    },
  ];
  for (const action of actions) {
    action(normal);
    action(fast);
    compare();
  }
});

it("skips stable composition but retains explicit matrix updates and custom traversal", () => {
  const root = new Group(),
    child = new Object3D();
  root.add(child);
  cacheTransforms(root);
  root.updateMatrixWorld();
  let calls = 0;
  const compose = child.matrix.compose;
  child.matrix.compose = function (...args) {
    calls++;
    return compose.apply(this, args);
  };
  root.updateMatrixWorld();
  expect(calls).toBe(0);
  child.position.x = 1;
  root.updateMatrixWorld();
  expect(calls).toBe(1);
  child.updateWorldMatrix(true, false);
  expect(calls).toBe(2);
  const custom = new Group();
  const own = (custom.updateMatrixWorld = () => {});
  root.add(custom);
  cacheTransforms(root);
  expect(custom.updateMatrixWorld).toBe(own);
});

it("relative cache retains unchanged matrices and handles nested/reparented/manual parts", () => {
  const parent = new Group(),
    a = new Group(),
    b = new Group(),
    child = new Object3D();
  parent.add(a, b);
  a.add(child);
  const cache = new RelativeTransform(),
    out = new Matrix4();
  const check = () => {
    cache.update(child, parent, out);
    parent.updateMatrixWorld(true);
    const expected = parent.matrixWorld
      .clone()
      .invert()
      .multiply(child.matrixWorld);
    out.elements.forEach((v, i) =>
      expect(v).toBeCloseTo(expected.elements[i], 10),
    );
  };
  check();
  expect(cache.update(child, parent, out)).toBe(false);
  parent.position.set(20, 30, 40);
  a.rotation.x = 0.3;
  child.position.z = 3;
  check();
  b.add(child);
  b.scale.setScalar(2);
  check();
  child.matrixAutoUpdate = false;
  child.matrix.makeTranslation(2, 4, 6);
  check();
  child.matrixAutoUpdate = true;
  check();
});
