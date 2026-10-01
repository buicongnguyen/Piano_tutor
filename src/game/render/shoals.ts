// Draws the fish schools of shoal-sim.ts. Built for phones, after the Zoo Garden
// pond fish (cute_game) but cheaper again:
//   * each species is merged into one small geometry (a few hundred triangles,
//     colour in vertex colours) and drawn as ONE instanced mesh: a theme's
//     whole sea of fish costs one or two draw calls;
//   * the swim is a vertex-shader bend (head still, tail swinging, a wave down
//     the body), so the CPU never touches a vertex, and there is no skinning;
//   * the fish sit in a thin layer on the opaque sea and are tinted toward the
//     water colour, which reads as "under the surface" with no transparency or
//     refraction. A fish in the air (a leap) gets its full colour back. This is
//     the same 2.5D trick as Zoo Garden's translucent pond, without the overdraw.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ShoalSim } from "../shoal-sim";
import type { HushUniforms, Kit } from "./assets";
import type { ThemeId } from "../campaign";
import type { Theme } from "./themes";

export const FISH_SPECIES = ["Fish_Minnow", "Fish_Koi", "Fish_Gold", "Fish_Clown", "Fish_Neon", "Fish_Ice", "Fish_Moon"] as const;
export type FishName = (typeof FISH_SPECIES)[number];

/** The fish of each island's sea. */
export const THEME_FISH: Record<ThemeId, FishName[]> = {
  meadow: ["Fish_Minnow", "Fish_Koi"],
  snow: ["Fish_Ice", "Fish_Minnow"],
  festival: ["Fish_Gold", "Fish_Koi"],
  pier: ["Fish_Clown", "Fish_Minnow"],
  garden: ["Fish_Koi", "Fish_Gold"],
  neon: ["Fish_Neon"],
  harbour: ["Fish_Moon"],
  spring: ["Fish_Koi", "Fish_Minnow"],
  summer: ["Fish_Clown", "Fish_Gold"],
  autumn: ["Fish_Gold", "Fish_Koi"],
  winter: ["Fish_Ice"],
  crown: ["Fish_Gold", "Fish_Koi"],
};

/** Fish in the sea by graphics density (World.build's `density`). */
export const fishCount = (density: number) => (density < 0.6 ? 18 : density < 0.9 ? 36 : 60);

const SEA_LEVEL = -3.2; // matches world.ts (the sea plane)
const FISH_Y = SEA_LEVEL + 0.06; // a hair above the plane: the tint does the "under water"

type Prepared = { geometry: THREE.BufferGeometry; head: number; tail: number };

/** Merge a kit fish into one geometry: position, normal, vertex colour (material × baked AO) and glow. */
export function prepareFish(root: THREE.Object3D): Prepared | undefined {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    const g = new THREE.BufferGeometry();
    const src = mesh.geometry;
    g.setAttribute("position", src.getAttribute("position").clone());
    g.setAttribute("normal", src.getAttribute("normal").clone());
    if (src.index) g.setIndex(src.index.clone());
    g.applyMatrix4(mesh.matrixWorld);
    const n = g.getAttribute("position").count;
    const ao = src.getAttribute("color");
    const glow = material.emissiveIntensity > 0 && material.emissive.getHex() !== 0 && /Glow/.test(material.name);
    const base = glow ? material.emissive : material.color;
    const colors = new Float32Array(n * 3);
    const glows = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = ao && !glow ? ao.getX(i) : 1;
      colors[i * 3] = base.r * a;
      colors[i * 3 + 1] = base.g * a;
      colors[i * 3 + 2] = base.b * a;
      glows[i] = glow ? 1 : 0;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aGlow", new THREE.BufferAttribute(glows, 1));
    parts.push(g);
  });
  if (!parts.length) return undefined;
  // mergeGeometries needs every part indexed or none.
  const same = parts.every((g) => !!g.index) ? parts : parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const geometry = same.length === 1 ? same[0] : mergeGeometries(same);
  if (!geometry) return undefined;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return { geometry, head: box.max.z, tail: box.min.z };
}

type Shared = {
  uTime: { value: number };
  uWater: { value: THREE.Color };
  uSubmerge: { value: number };
  uGold: { value: number };
  uLumen: { value: number };
  uSat: { value: number };
  uGlow: { value: number };
};

function fishMaterial(head: number, tail: number, u: Shared) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uHead: { value: head }, uTail: { value: tail } });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime, uHead, uTail;
attribute vec4 iSwim; // phase, tail beat (rad/s), tail swing, lift (0 in the water .. 1 in the air)
attribute float aGlow;
varying float vGlow, vLift;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
{ // 0 at the nose, 1 at the tail tip: the head holds still, a wave runs down to the tail.
  float bw = clamp((uHead - transformed.z) / (uHead - uTail), 0.0, 1.0);
  transformed.x += sin(uTime * iSwim.y + iSwim.x - bw * 3.0) * iSwim.z * (0.03 + 0.3 * bw * bw);
}
vGlow = aGlow;
vLift = iSwim.w;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 uWater;
uniform float uSubmerge, uGold, uLumen, uSat, uGlow;
varying float vGlow, vLift;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vColor.rgb * (vGlow * 1.8 * mix(0.3, 1.0, uGlow) + uLumen); // night fish glow softly`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{ // Seen through the water unless leaping; glowing spots shine through.
  float sub = uSubmerge * (1.0 - vLift) * (1.0 - 0.7 * vGlow);
  outgoingLight = mix(outgoingLight, uWater, sub);
  float l = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  outgoingLight = mix(outgoingLight, vec3(1.0, 0.78, 0.25) * (0.55 + l), uGold * 0.5); // Encore: golden fish
  outgoingLight = mix(vec3(l) * vec3(0.92, 0.94, 1.04), outgoingLight, uSat); // the Hush drains colour
}
#include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "encore-fish";
  return material;
}

export class Shoals {
  readonly group = new THREE.Group();
  sim?: ShoalSim;
  /** Splashes are drawn by the stage's particles and rings. */
  onSplash?: (x: number, y: number, z: number, color: THREE.Color, landing: boolean) => void;
  private prepared = new Map<string, Prepared | null>();
  private meshes: { mesh: THREE.InstancedMesh; swim: THREE.InstancedBufferAttribute; ids: number[] }[] = [];
  private readonly shared: Shared;
  private gold = 0;
  private foam = new THREE.Color();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(
    readonly kit: Kit | undefined,
    hush: HushUniforms,
  ) {
    this.group.name = "shoals";
    this.shared = {
      uTime: { value: 0 },
      uWater: { value: new THREE.Color() },
      uSubmerge: { value: 0.45 },
      uGold: { value: 0 },
      uLumen: { value: 0 },
      uSat: hush.uSat,
      uGlow: hush.uGlow,
    };
  }

  private fish(name: FishName) {
    if (!this.prepared.has(name)) {
      const root = this.kit?.get(name);
      this.prepared.set(name, root ? (prepareFish(root) ?? null) : null);
    }
    return this.prepared.get(name) ?? undefined;
  }

  build(theme: Theme, seed: number, roadHalf: number, density: number) {
    this.clear();
    const kinds = THEME_FISH[theme.id].flatMap((name) => {
      const prepared = this.fish(name);
      return prepared ? [{ name, ...prepared }] : [];
    });
    if (!kinds.length) return;
    // Under-water tint: the theme's sea, a little deeper than its surface colour.
    this.shared.uWater.value.set(theme.water.shallow).lerp(new THREE.Color(theme.water.deep), 0.35);
    this.shared.uSubmerge.value = theme.night ? 0.25 : 0.32;
    // Night seas are black-blue and carry their colour in lights: the fish glow faintly.
    this.shared.uLumen.value = theme.night ? 0.45 : 0;
    this.foam.set(theme.water.foam);
    const sim = (this.sim = new ShoalSim({ count: fishCount(density), species: kinds.length, roadHalf, seed, sea: FISH_Y }));
    sim.onSplash = (x, z, landing) => this.onSplash?.(x, SEA_LEVEL + 0.08, z, this.foam, landing);
    kinds.forEach((kind, k) => {
      const ids = sim.fish.flatMap((f, i) => (f.species === k ? [i] : []));
      if (!ids.length) return;
      const geometry = kind.geometry.clone();
      const swim = new THREE.InstancedBufferAttribute(new Float32Array(ids.length * 4), 4);
      swim.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("iSwim", swim);
      const mesh = new THREE.InstancedMesh(geometry, fishMaterial(kind.head, kind.tail, this.shared), ids.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; // instances span the whole sea
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.name = kind.name;
      this.group.add(mesh);
      this.meshes.push({ mesh, swim, ids });
    });
    this.write(0);
  }

  update(dt: number, time: number, flow: number, harmony: number, encore: number) {
    if (!this.sim) return;
    this.sim.update(dt, flow, harmony);
    this.gold += (encore - this.gold) * Math.min(1, dt * 3);
    this.shared.uGold.value = this.gold;
    this.write(time);
  }

  private write(time: number) {
    const sim = this.sim;
    if (!sim) return;
    this.shared.uTime.value = time;
    for (const { mesh, swim, ids } of this.meshes) {
      const a = swim.array as Float32Array;
      ids.forEach((id, i) => {
        const f = sim.fish[id];
        const scale = Math.max(1e-4, f.size * f.show);
        this.e.set(-f.pitch, f.heading, f.roll);
        this.q.setFromEuler(this.e);
        // A little wider than modelled: from the low chase camera a fish is mostly seen from above.
        this.m.compose(this.p.set(f.x, f.y, f.z), this.q, this.s.set(scale * 1.3, scale, scale));
        mesh.setMatrixAt(i, this.m);
        a[i * 4] = f.phase;
        a[i * 4 + 1] = f.wagRate;
        a[i * 4 + 2] = f.wagAmp;
        a[i * 4 + 3] = f.lift;
      });
      mesh.instanceMatrix.needsUpdate = true;
      swim.needsUpdate = true;
    }
  }

  leap(side?: number) {
    return this.sim?.leap(side) ?? false;
  }

  wave() {
    return this.sim?.wave() ?? 0;
  }

  scatter() {
    return this.sim?.scatter() ?? 0;
  }

  clear() {
    for (const { mesh } of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.group.clear();
    this.meshes = [];
    this.sim = undefined;
    this.gold = 0;
  }
}
