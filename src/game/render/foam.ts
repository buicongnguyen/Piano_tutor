// Shore foam where island rock meets the sea: every islet's ring in ONE instanced
// draw. Each ring breathes outward with its own phase and breaks into bubbly lobes
// from noise around the circle; the band is a fixed width in world units, so a
// big island and a small rock get the same foam. Adapted from the
// lightweight-game-objects skill (templates/environment/toon-water.ts).
import * as THREE from "three";

const NOISE = /* glsl */ `
float foamHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float foamNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(foamHash(i), foamHash(i + vec2(1, 0)), f.x), mix(foamHash(i + vec2(0, 1)), foamHash(i + vec2(1, 1)), f.x), f.y);
}`;

export type Waterline = { rx: number; rz: number };

/**
 * Half-widths (x and z) where an object's geometry crosses the plane y = `level`
 * (world space), measured from its origin; zero when it never reaches the water.
 * Measure the island base alone: props, boats and cloud cushions would widen it.
 */
export function waterlineRadius(root: THREE.Object3D, level: number, band = 0.6): Waterline {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const centre = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
  let rx = 0,
    rz = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (Math.abs(v.y - level) < band) {
        rx = Math.max(rx, Math.abs(v.x - centre.x));
        rz = Math.max(rz, Math.abs(v.z - centre.z));
      }
    }
  });
  return { rx, rz };
}

export class ShoreFoam {
  readonly mesh: THREE.InstancedMesh;
  readonly uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color("#ffffff") }, uOpacity: { value: 1 } };
  private readonly shore: THREE.InstancedBufferAttribute; // phase, band width relative to the radius
  private readonly radius: Float32Array; // rx, rz per ring
  private readonly m = new THREE.Matrix4();

  constructor(capacity: number, o: { color?: THREE.ColorRepresentation; width?: number; opacity?: number; seed?: number } = {}) {
    const geometry = new THREE.RingGeometry(1, 2, 48, 1); // unit band, remapped per instance
    geometry.rotateX(-Math.PI / 2);
    this.shore = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    geometry.setAttribute("iShore", this.shore);
    this.radius = new Float32Array(capacity * 2);
    this.width = o.width ?? 1.6;
    let s = (o.seed ?? 21) >>> 0 || 1;
    for (let i = 0; i < capacity; i++) this.shore.setX(i, ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 10);
    if (o.color) this.uniforms.uColor.value.set(o.color);
    this.uniforms.uOpacity.value = o.opacity ?? 1;
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
attribute vec2 iShore;
varying vec2 vLocal;
varying float vPhase, vBand;
void main(){
  float rr = length(position.xz);
  vBand = rr - 1.0;                                    // 0 at the shore .. 1 at the outer edge
  vec3 q = position * (1.0 + vBand * iShore.y) / rr;   // band = width world units wide
  vLocal = position.xz;
  vPhase = iShore.x;
  vec4 p = vec4(q, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`,
      fragmentShader: /* glsl */ `
uniform float uTime, uOpacity;
uniform vec3 uColor;
varying vec2 vLocal;
varying float vPhase, vBand;
${NOISE}
void main(){
  float r = vBand;
  float a = atan(vLocal.y, vLocal.x);
  float t = fract(uTime * 0.22 + vPhase);            // a wave rolls out from the shore
  float lobes = (foamNoise(vec2(a * 6.0, vPhase)) - 0.5) * 0.25;
  float wave = smoothstep(0.12, 0.0, abs(r - (0.9 * t + lobes * t))) * (1.0 - t);
  float rim = smoothstep(0.35, 0.0, r) * (0.55 + 0.45 * sin(uTime * 1.7 + vPhase * 6.0 + a * 2.0));
  float alpha = clamp(wave + rim * 0.8, 0.0, 1.0) * uOpacity;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // rings follow islets all over the sea
    this.mesh.renderOrder = 2;
    this.mesh.name = "shore-foam";
  }

  private width: number;

  /** Ring `i` around a shore at (x, y, z) with these waterline half-widths. */
  set(i: number, x: number, y: number, z: number, w: Waterline) {
    if (i >= this.mesh.instanceMatrix.count) return;
    this.radius[i * 2] = w.rx;
    this.radius[i * 2 + 1] = w.rz;
    this.shore.setY(i, this.width / Math.max(0.1, Math.min(w.rx, w.rz)));
    this.m.makeScale(w.rx, 1, w.rz).setPosition(x, y + 0.04, z);
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.count = Math.max(this.mesh.count, i + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.shore.needsUpdate = true;
  }

  /** Move ring `i` (radius unchanged): the per-frame path for drifting islets. */
  move(i: number, x: number, y: number, z: number) {
    this.m.makeScale(this.radius[i * 2], 1, this.radius[i * 2 + 1]).setPosition(x, y + 0.04, z);
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(time: number) {
    this.uniforms.uTime.value = time;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
