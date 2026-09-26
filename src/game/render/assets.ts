// Loads the Blender-built GLB kits once and hands out clones of their roots by
// name. World materials get a shared "Hush" uniform so the whole island can
// drain to grey and bloom back into colour as the player restores it.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type Kit = Map<string, THREE.Object3D>;
const kits = new Map<string, Promise<Kit>>();
const loader = new GLTFLoader();

export function loadKit(file: string): Promise<Kit> {
  let pending = kits.get(file);
  if (!pending) {
    pending = loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}`).then((gltf) => {
      const kit: Kit = new Map();
      for (const child of [...gltf.scene.children]) {
        child.position.set(0, 0, 0);
        child.updateMatrixWorld(true);
        kit.set(child.name, child);
      }
      return kit;
    });
    pending.catch(() => kits.delete(file));
    kits.set(file, pending);
  }
  return pending;
}

/** Deep clone of a kit root; geometry and materials are shared. */
export function spawn(kit: Kit | undefined, name: string): THREE.Object3D | undefined {
  const proto = kit?.get(name);
  if (!proto) return undefined;
  const copy = proto.clone(true);
  copy.position.set(0, 0, 0);
  return copy;
}

export function findMesh(root: THREE.Object3D, test: (m: THREE.Mesh) => boolean): THREE.Mesh | undefined {
  let found: THREE.Mesh | undefined;
  root.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh && test(o as THREE.Mesh)) found = o as THREE.Mesh;
  });
  return found;
}

export function materialsOf(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out = new Set<THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) out.add(mat as THREE.MeshStandardMaterial);
  });
  return [...out];
}

/** Replace a named material on a clone with a private copy (e.g. per-lane tint). */
export function ownMaterial(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial | undefined {
  let copy: THREE.MeshStandardMaterial | undefined;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const replaced = mats.map((m) => {
      if (m.name !== name) return m;
      copy ??= (m as THREE.MeshStandardMaterial).clone();
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0];
  });
  return copy;
}

/** Give a clone private copies of every material (so shader patches don't leak to other clones). */
export function ownAllMaterials(root: THREE.Object3D, copies = new Map<THREE.Material, THREE.Material>()) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: THREE.Material) => {
      let c = copies.get(m);
      if (!c) copies.set(m, (c = m.clone()));
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  return root;
}

// ---------------------------------------------------------------- Hush tint

export type HushUniforms = { uSat: { value: number }; uLift: { value: number }; uGlow: { value: number } };
export const hushUniforms = (): HushUniforms => ({ uSat: { value: 1 }, uLift: { value: 0 }, uGlow: { value: 1 } });

const patched = new WeakSet<THREE.Material>();

/** Make world materials respond to the island's colour (Hush) uniforms. */
export function applyHush(root: THREE.Object3D, u: HushUniforms) {
  for (const mat of materialsOf(root)) {
    if (patched.has(mat)) continue;
    patched.add(mat);
    const glow = /Glow|Light/.test(mat.name);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSat = u.uSat;
      shader.uniforms.uLift = u.uLift;
      shader.uniforms.uGlow = u.uGlow;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uSat, uLift, uGlow;")
        .replace(
          "#include <opaque_fragment>",
          glow
            ? "outgoingLight *= mix(0.25, 1.0, uGlow);\n#include <opaque_fragment>"
            : `{ float l = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
               vec3 grey = vec3(l) * vec3(0.92, 0.94, 1.04) + uLift * 0.06;
               outgoingLight = mix(grey, outgoingLight, uSat); }
             #include <opaque_fragment>`,
        );
    };
    mat.customProgramCacheKey = () => (glow ? "hush-glow" : "hush");
    mat.needsUpdate = true;
  }
}

/** Instanced gems glow in their own instance colour. */
export function glowFromInstanceColor(mat: THREE.MeshStandardMaterial, amount: { value: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uInstGlow = amount;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uInstGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor.rgb * uInstGlow;\n#endif",
      );
  };
  mat.customProgramCacheKey = () => "inst-glow";
  mat.needsUpdate = true;
}
