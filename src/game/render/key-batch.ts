import * as THREE from "three";
import { RelativeTransform } from "./transforms";
import { uploadChangedPrefix } from "./upload";
type KeyMaterial =
  | THREE.MeshStandardMaterial
  | THREE.MeshPhongMaterial
  | THREE.MeshLambertMaterial;

/** Batch matching piano-key surfaces, retaining their original animation/material state.
 * Private geometry holds per-instance emission; the loaded kit stays untouched. */
export class KeyBatch {
  private groups: {
    mesh: THREE.InstancedMesh;
    sources: THREE.Mesh[];
    emission: THREE.InstancedBufferAttribute;
    transforms: RelativeTransform[];
  }[] = [];
  private matrix = new THREE.Matrix4();

  constructor(
    private parent: THREE.Object3D,
    roots: THREE.Object3D[],
  ) {
    const buckets = new Map<string, THREE.Mesh[]>();
    for (const root of roots)
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.visible)
          return;
        if (!["Key Ivory", "Key Ebony"].includes(mesh.material.name)) return;
        if (!(
          mesh.material instanceof THREE.MeshStandardMaterial ||
          mesh.material instanceof THREE.MeshPhongMaterial ||
          mesh.material instanceof THREE.MeshLambertMaterial
        ))
          return;
        const key = `${mesh.geometry.uuid}:${mesh.material.name}:${mesh.castShadow}:${mesh.receiveShadow}`;
        const list = buckets.get(key) ?? [];
        list.push(mesh);
        buckets.set(key, list);
      });
    for (const sources of buckets.values()) {
      if (sources.length < 2) continue;
      const source = sources[0];
      const geometry = source.geometry.clone();
      const emission = new THREE.InstancedBufferAttribute(
        new Float32Array(sources.length * 3),
        3,
      );
      emission.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("keyEmission", emission);
      const material = (source.material as KeyMaterial).clone();
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute vec3 keyEmission; varying vec3 vKeyEmission;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvKeyEmission = keyEmission;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vKeyEmission;",
          )
          .replace(
            "vec3 totalEmissiveRadiance = emissive;",
            "vec3 totalEmissiveRadiance = vKeyEmission;",
          );
      };
      material.customProgramCacheKey = () => "piano-key-emission-v1";
      const mesh = new THREE.InstancedMesh(geometry, material, sources.length);
      mesh.name = `Batched ${material.name}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      // The compact keyboard stays in view; avoid stale bounds as keys animate.
      mesh.frustumCulled = false;
      parent.add(mesh);
      for (const original of sources) original.visible = false;
      this.groups.push({
        mesh,
        sources,
        emission,
        transforms: sources.map(() => new RelativeTransform()),
      });
    }
    this.update();
  }

  update() {
    for (const { mesh, sources, emission, transforms } of this.groups) {
      sources.forEach((source, i) => {
        if (transforms[i].update(source, this.parent, this.matrix))
          mesh.setMatrixAt(i, this.matrix);
        const material = source.material as KeyMaterial;
        emission.setXYZ(
          i,
          material.emissive.r * material.emissiveIntensity,
          material.emissive.g * material.emissiveIntensity,
          material.emissive.b * material.emissiveIntensity,
        );
      });
      uploadChangedPrefix(mesh.instanceMatrix, sources.length);
      uploadChangedPrefix(emission, sources.length);
    }
  }
}
