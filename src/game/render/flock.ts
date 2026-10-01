// Ambient flocks: gulls circling the destination beacon, bats at night, swallows over
// the snow. ONE draw call per flock and zero CPU per frame: every flyer follows a
// looping path computed in the vertex shader (radius, height, speed, phase), faces
// along it, banks into the turn and flaps. From the lightweight-game-objects skill
// (templates/environment/sky-life.ts); only uCenter is set per frame, to follow the
// island the flock lives around.
import * as THREE from "three";

export type FlyerKind = "gull" | "swallow" | "butterfly" | "bat";

type Shape = { flapRate: [number, number]; flapAmp: number; wobble: number; bank: number; colors: string[] };
const SHAPES: Record<FlyerKind, Shape> = {
  gull: { flapRate: [5, 7], flapAmp: 0.55, wobble: 0.15, bank: 0.35, colors: ["#ffffff", "#f2f4f8"] },
  swallow: { flapRate: [11, 15], flapAmp: 0.7, wobble: 0.3, bank: 0.5, colors: ["#27306b", "#3b2f5c"] },
  butterfly: { flapRate: [14, 20], flapAmp: 1.1, wobble: 0.9, bank: 0.2, colors: ["#ff9f1c", "#ff5fa2", "#58c4ff", "#ffe14d"] },
  bat: { flapRate: [12, 16], flapAmp: 0.9, wobble: 0.6, bank: 0.4, colors: ["#2a2340"] },
};

/** Body + wings in model space: forward +Z, up +Y, span along X. `aWing` = 0 body, ±1 tips. */
function flyerGeometry(kind: FlyerKind) {
  const pos: number[] = [],
    wing: number[] = [];
  const tri = (a: number[], b: number[], c: number[], wa: number, wb: number, wc: number) => {
    pos.push(...a, ...b, ...c);
    wing.push(wa, wb, wc);
  };
  if (kind === "butterfly") {
    // Two round-ish wings per side (fore and hind), hinged on the body line.
    for (const side of [-1, 1]) {
      tri([0, 0, 0.12], [side * 0.55, 0, 0.32], [side * 0.62, 0, 0.0], 0, side, side);
      tri([0, 0, 0.12], [side * 0.62, 0, 0.0], [0, 0, -0.02], 0, side, 0);
      tri([0, 0, -0.02], [side * 0.45, 0, -0.05], [side * 0.32, 0, -0.38], 0, side * 0.8, side * 0.7);
    }
    tri([0, 0.02, 0.2], [0.03, 0, -0.3], [-0.03, 0, -0.3], 0, 0, 0);
  } else {
    const sweep = kind === "swallow" ? 0.35 : kind === "bat" ? 0.1 : 0.2;
    const span = kind === "gull" ? 1.0 : 0.8;
    for (const side of [-1, 1]) {
      tri([0, 0, 0.18], [side * span * 0.5, 0.02, 0.05 - sweep * 0.5], [0, 0, -0.12], 0, side * 0.5, 0);
      tri([side * span * 0.5, 0.02, 0.05 - sweep * 0.5], [side * span, 0, -sweep], [0, 0, -0.12], side * 0.5, side, 0);
    }
    tri([0, 0.03, 0.42], [0.06, 0, -0.1], [-0.06, 0, -0.1], 0, 0, 0); // body
    tri([0, 0, -0.1], [0.14, 0, -0.42], [-0.14, 0, -0.42], 0, 0, 0); // tail
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aWing", new THREE.Float32BufferAttribute(wing, 1));
  return g;
}

/**
 * A flock on looping paths around `center`. `budget` 0..1 scales the count;
 * `quiet` (reduced motion) slows flapping and flattens the wobble.
 */
export function createFlock(
  kind: FlyerKind,
  o: {
    count: number;
    center: THREE.Vector3;
    radius: [number, number];
    height: [number, number];
    speed?: [number, number]; // radians per second along the loop
    size?: number;
    squash?: number; // ellipse ratio of the loops (z / x)
    colors?: string[];
    seed?: number;
    budget?: number;
    quiet?: boolean;
    sunDir?: THREE.Vector3;
  },
) {
  const shape = SHAPES[kind];
  let s = (o.seed ?? 11) >>> 0 || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const count = Math.max(1, Math.round(o.count * (o.budget ?? 1)));
  const geometry = flyerGeometry(kind);
  const orbit = new Float32Array(count * 4); // radius, height, speed (signed), phase
  const style = new Float32Array(count * 4); // flap rate, flap amp, wobble, size
  const color = new Float32Array(count * 3);
  const palette = (o.colors ?? shape.colors).map((c) => new THREE.Color(c));
  const [sp0, sp1] = o.speed ?? (kind === "butterfly" ? [0.5, 0.9] : [0.25, 0.55]);
  for (let i = 0; i < count; i++) {
    const dir = rand() < 0.5 ? -1 : 1;
    orbit.set([o.radius[0] + rand() * (o.radius[1] - o.radius[0]), o.height[0] + rand() * (o.height[1] - o.height[0]), dir * (sp0 + rand() * (sp1 - sp0)), rand() * 6.2832], i * 4);
    const rate = shape.flapRate[0] + rand() * (shape.flapRate[1] - shape.flapRate[0]);
    style.set([o.quiet ? rate * 0.4 : rate, shape.flapAmp, o.quiet ? shape.wobble * 0.2 : shape.wobble, (o.size ?? 1) * (0.85 + rand() * 0.3)], i * 4);
    const c = palette[Math.floor(rand() * palette.length)];
    color.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("iOrbit", new THREE.InstancedBufferAttribute(orbit, 4));
  geometry.setAttribute("iStyle", new THREE.InstancedBufferAttribute(style, 4));
  geometry.setAttribute("iColor", new THREE.InstancedBufferAttribute(color, 3));
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
    uCenter: { value: o.center.clone() },
    uSquash: { value: o.squash ?? 0.75 },
    uBank: { value: shape.bank },
    uSunDir: { value: (o.sunDir ?? new THREE.Vector3(-0.4, 0.8, -0.3)).clone().normalize() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
uniform float uTime, uSquash, uBank;
uniform vec3 uCenter, uSunDir;
attribute float aWing;
attribute vec4 iOrbit, iStyle;
attribute vec3 iColor;
varying vec3 vColor;
#include <fog_pars_vertex>
void main(){
  float a = uTime * iOrbit.z + iOrbit.w;
  float r = iOrbit.x * (1.0 + 0.15 * sin(a * 2.3 + iOrbit.w));
  float w = iStyle.z;
  // The loop, plus a little erratic wobble (butterflies wobble a lot).
  vec3 c = uCenter + vec3(cos(a) * r, iOrbit.y + sin(a * 1.7 + iOrbit.w) * (0.6 + w), sin(a) * r * uSquash);
  c += vec3(sin(uTime * 3.1 + iOrbit.w * 5.0), sin(uTime * 4.3 + iOrbit.w * 3.0) * 0.6, cos(uTime * 2.7 + iOrbit.w * 7.0)) * w * 0.5;
  // Face along the path (its derivative), bank into the turn.
  float dir = sign(iOrbit.z);
  vec3 fwd = normalize(vec3(-sin(a), 0.12 * cos(a * 1.7 + iOrbit.w), cos(a) * uSquash) * dir);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  float bank = uBank * dir;
  vec3 r2 = right * cos(bank) + up * sin(bank);
  vec3 u2 = up * cos(bank) - right * sin(bank);
  // Flap: wing vertices rise and fall with their wing weight; the span folds a little at the top.
  float flap = sin(uTime * iStyle.x + iOrbit.w * 3.0);
  vec3 p = position;
  p.y += flap * iStyle.y * abs(aWing) * abs(p.x) * 0.9;
  p.x *= 1.0 - 0.18 * abs(aWing) * max(flap, 0.0);
  p *= iStyle.w;
  vec3 world = c + r2 * p.x + u2 * p.y + fwd * p.z;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float light = 0.7 + 0.3 * abs(dot(u2, normalize(uSunDir)));
  vColor = iColor * light;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
varying vec3 vColor;
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false; // positions live in the shader
  mesh.name = `flock-${kind}`;
  return { mesh, uniforms, update: (time: number) => (uniforms.uTime.value = time) };
}
