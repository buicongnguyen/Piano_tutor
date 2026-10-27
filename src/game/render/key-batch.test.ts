import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { KeyBatch } from "./key-batch";

describe("piano key batching", () => {
  for (const Material of [
    THREE.MeshStandardMaterial,
    THREE.MeshPhongMaterial,
    THREE.MeshLambertMaterial,
  ]) {
    it(`preserves hierarchy and independent glow with ${Material.name}`, () => {
      const parent = new THREE.Group();
      parent.position.set(8, 3, -5);
      const geometry = new THREE.BoxGeometry();
      const roots = [0, 1].map((i) => {
        const root = new THREE.Group();
        root.position.x = i * 2;
        const material = new Material({ name: "Key Ivory" });
        const surface = new THREE.Mesh(geometry, material);
        surface.position.z = 1.2;
        root.add(surface);
        parent.add(root);
        return root;
      });
      const batch = new KeyBatch(parent, roots);
      const mesh = parent.children.find(
        (o) => o instanceof THREE.InstancedMesh,
      ) as THREE.InstancedMesh;
      expect(mesh.count).toBe(2);
      expect(mesh.geometry).not.toBe(geometry);
      expect(geometry.getAttribute("keyEmission")).toBeUndefined();
      roots[1].rotation.x = 0.06;
      roots[1].position.y = -0.05;
      const pressed = roots[1].children[0] as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshStandardMaterial
      >;
      pressed.material.emissive.setRGB(0.2, 0.4, 0.8);
      pressed.material.emissiveIntensity = 1.6;
      batch.update();
      parent.updateMatrixWorld(true);
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(1, matrix);
      const expected = parent.matrixWorld
        .clone()
        .invert()
        .multiply(pressed.matrixWorld);
      matrix.elements.forEach((v, i) =>
        expect(v).toBeCloseTo(expected.elements[i], 5),
      );
      const emission = mesh.geometry.getAttribute("keyEmission") as THREE.InstancedBufferAttribute;
      expect(emission.getX(0)).toBe(0);
      expect(emission.getX(1)).toBeCloseTo(0.32);
      expect(emission.getZ(1)).toBeCloseTo(1.28);
      expect(pressed.visible).toBe(false);
      expect(roots[1].visible).toBe(true);
      const matrixVersion = mesh.instanceMatrix.version;
      const emissionVersion = emission.version;
      batch.update();
      expect(mesh.instanceMatrix.version).toBe(matrixVersion);
      expect(emission.version).toBe(emissionVersion);
    });
  }
  it("leaves unrelated decorative surfaces alone", () => {
    const parent = new THREE.Group();
    const roots = [new THREE.Mesh(), new THREE.Mesh()];
    parent.add(...roots);
    new KeyBatch(parent, roots);
    expect(parent.children).toHaveLength(2);
    expect(roots.every((root) => root.visible)).toBe(true);
  });
});
