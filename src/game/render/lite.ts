// Lightweight materials for the phone tiers (medium, low). Physically based
// shading samples the environment map and evaluates PBR lighting on every pixel;
// on a weak GPU that was half the scene's cost. Measured on the stage at phone size
// (software rasteriser): scene 81.5 -> 40 ms with Lambert everywhere.
//
// Matte and satin surfaces become Lambert; glossy and metal ones become Phong, so
// toys keep a sun highlight. Colour, vertex colours (baked AO), emissive glow,
// transparency and every onBeforeCompile patch (Hush colour drain, gem glow) carry
// over unchanged. Kits are converted once, right after loading and before anything
// is spawned, so game code that tints or animates a material holds the lite one.
import * as THREE from "three";
import type { Kit } from "./assets";

/** Decided once at boot from the starting quality; a later quality change applies after a reload. */
export const LITE = { on: false };

export type PbrFinish = { roughness: number; metalness: number };

/** The roughness/metalness a material was authored with (kept on lite copies for baking). */
export function pbrOf(m: THREE.Material): PbrFinish | undefined {
  const s = m as THREE.MeshStandardMaterial;
  if (s.isMeshStandardMaterial) return { roughness: s.roughness, metalness: s.metalness };
  return m.userData.pbr as PbrFinish | undefined;
}

/** A Lambert/Phong stand-in for a physically based material (anything else is returned as is). */
export function liteOf(m: THREE.Material): THREE.Material {
  const s = m as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial) return m;
  const metal = s.metalness > 0.5;
  const glossy = metal || s.roughness < 0.36;
  const common = {
    name: s.name,
    color: s.color,
    vertexColors: s.vertexColors,
    emissive: s.emissive,
    emissiveIntensity: s.emissiveIntensity,
    map: s.map,
    emissiveMap: s.emissiveMap,
    transparent: s.transparent,
    opacity: s.opacity,
    side: s.side,
    depthWrite: s.depthWrite,
    depthTest: s.depthTest,
    alphaTest: s.alphaTest,
    fog: s.fog,
    flatShading: s.flatShading,
    visible: s.visible,
  };
  const lite = glossy
    ? new THREE.MeshPhongMaterial({
        ...common,
        specular: metal ? s.color.clone().multiplyScalar(0.55) : new THREE.Color("#3a3a3a"),
        shininess: metal ? 40 : 70,
      })
    : new THREE.MeshLambertMaterial(common);
  lite.userData = { ...s.userData, pbr: { roughness: s.roughness, metalness: s.metalness } };
  lite.onBeforeCompile = s.onBeforeCompile;
  lite.customProgramCacheKey = s.customProgramCacheKey;
  return lite;
}

/** Convert every material in a loaded kit in place (shared by all later clones). */
export function liteKit(kit: Kit | undefined) {
  if (!kit) return;
  const done = new Map<THREE.Material, THREE.Material>();
  const swap = (m: THREE.Material) => {
    let l = done.get(m);
    if (!l) done.set(m, (l = liteOf(m)));
    return l;
  };
  for (const root of kit.values())
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
}

/**
 * Factory for materials made in code: physically based on high, lite on phones.
 * Typed as standard: the stand-ins share colour, emissive, maps and flags, and
 * writes to roughness/metalness on them are simply ignored.
 */
export function stdMaterial(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial(params);
  return (LITE.on ? liteOf(m) : m) as THREE.MeshStandardMaterial;
}
