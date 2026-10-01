// Bake static scenery so a whole islet costs a handful of draw calls instead of
// one per material of every prop (an islet was 13–36 draws, the destination 150).
//
// Meshes that differ only in colour are merged into one geometry per finish
// (gloss, satin, matte, metal): the colour (material colour × baked AO) moves
// into vertex colours. Kept as they are: glowing materials (Glow/Light, which the
// Hush dims at runtime), transparent ones, and everything under an animated pivot
// (windmill blades, beacon lamp, ferris wheel, bells). See the smooth-dense-scenes
// skill, "bake colours".
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pbrOf, stdMaterial } from "./lite";

export type Finish = "gloss" | "satin" | "matte" | "metal";

/** Roughness/metalness buckets matching art/encore/palette.py FINISH. */
export function finishOf(m: THREE.Material): Finish {
  const f = pbrOf(m) ?? { roughness: 0.5, metalness: 0 };
  if (f.metalness > 0.5) return "metal";
  if (f.roughness < 0.36) return "gloss";
  if (f.roughness < 0.6) return "satin";
  return "matte";
}

const FINISH: Record<Finish, { roughness: number; metalness: number }> = {
  gloss: { roughness: 0.26, metalness: 0 },
  satin: { roughness: 0.45, metalness: 0 },
  matte: { roughness: 0.72, metalness: 0 },
  metal: { roughness: 0.28, metalness: 0.9 },
};

/** Can this mesh be merged into a colour-baked group? */
export function bakeable(mesh: THREE.Mesh): mesh is THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const m = mesh.material;
  // Physically based kit materials, or their phone stand-ins (which remember their finish).
  if (Array.isArray(m) || !pbrOf(m)) return false;
  const s = m as THREE.MeshStandardMaterial;
  if (s.transparent || s.opacity < 1 || s.map || /Glow|Light/.test(s.name)) return false;
  if ((mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.morphTargetInfluences) return false;
  return !!mesh.geometry.getAttribute("position") && !!mesh.geometry.getAttribute("normal");
}

/** Shared baked materials, one per finish and side; dispose with `disposeBaked`. */
export type BakeMaterials = Map<string, THREE.Material>;

export type BakeResult = { meshes: THREE.Mesh[]; merged: number };

/**
 * Merge `root`'s static, opaque, non-glowing meshes into one mesh per finish,
 * parented to `root` (so the root can still move, spin and squash). Subtrees of
 * `keep` objects (animated pivots) are left alone.
 */
export function bakeStatic(root: THREE.Object3D, keep: Iterable<THREE.Object3D>, materials: BakeMaterials): BakeResult {
  const skip = new Set(keep);
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const groups = new Map<string, { finish: Finish; side: THREE.Side; parts: THREE.BufferGeometry[] }>();
  const done: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if (skip.has(o)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && bakeable(mesh)) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      const finish = finishOf(m);
      const key = `${finish}|${m.side}`;
      const g = groups.get(key) ?? { finish, side: m.side, parts: [] };
      g.parts.push(bakedPart(mesh, m, toRoot));
      groups.set(key, g);
      done.push(mesh);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  const meshes: THREE.Mesh[] = [];
  for (const [key, g] of groups) {
    const parts = g.parts.every((p) => p.index) ? g.parts : g.parts.map((p) => (p.index ? p.toNonIndexed() : p));
    const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    let material = materials.get(key);
    if (!material) {
      material = stdMaterial({ vertexColors: true, side: g.side, name: `Baked ${g.finish}`, ...FINISH[g.finish] });
      materials.set(key, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `baked-${g.finish}`;
    mesh.userData.baked = true;
    root.add(mesh);
    meshes.push(mesh);
    for (const p of g.parts) if (p !== geometry) p.dispose();
  }
  // Retire the originals. A mesh with children (pivots, sockets) stays in the tree
  // but stops drawing: removing it would take its children with it.
  for (const mesh of done) {
    if (mesh.children.length) mesh.layers.disableAll();
    else mesh.removeFromParent();
  }
  return { meshes, merged: done.length };
}

function bakedPart(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial, toRoot: THREE.Matrix4) {
  // (material may be a Lambert/Phong stand-in: only colour and vertexColors are read)
  const src = mesh.geometry;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", src.getAttribute("position").clone());
  g.setAttribute("normal", src.getAttribute("normal").clone());
  if (src.index) g.setIndex(src.index.clone());
  g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
  const n = g.getAttribute("position").count;
  const ao = material.vertexColors ? src.getAttribute("color") : undefined;
  const c = material.color;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = ao ? ao.getX(i) : 1; // baked AO lives in COLOR_0 (grey)
    colors[i * 3] = c.r * a;
    colors[i * 3 + 1] = c.g * a;
    colors[i * 3 + 2] = c.b * a;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

export function disposeBaked(meshes: THREE.Mesh[], materials: BakeMaterials) {
  for (const m of meshes) m.geometry.dispose();
  for (const m of materials.values()) m.dispose();
  materials.clear();
}
