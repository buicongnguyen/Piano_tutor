// Cheap road VFX, all animated on the GPU (the CPU writes a few uniforms):
//   RoadWaves  - one additive overlay on the road deck: a Perfect sends a glowing
//                ripple racing down the road from its key, combo milestones send a
//                wide gold wave, and the road edges glow with combo and the beat.
//   SpeedLines - streaks of light rushing past the camera during Encore (and
//                faintly at high combo): one instanced draw, positions from time.
// Each is ONE draw call and no per-frame allocation; both honour reduced motion.
import * as THREE from "three";
import { ROAD_VIEW } from "./stage";

const WAVES = 6;

export class RoadWaves {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private next = 0;
  private readonly waves = Array.from({ length: WAVES }, () => new THREE.Vector4(0, -100, 0, 0)); // x, birth, strength, gold
  readonly uniforms = {
    uTime: { value: 0 },
    uWaves: { value: this.waves },
    uHalf: { value: 4 },
    uEdge: { value: 0 }, // 0..1: combo glow on the edges
    uBeat: { value: 0 },
    uColor: { value: new THREE.Color("#7fe8ff") },
    uGold: { value: new THREE.Color("#ffc53d") },
  };

  constructor() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -0.5); // from the keys (z = 0) away down the road
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
varying vec3 vPos;
void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
uniform float uTime, uHalf, uEdge, uBeat;
uniform vec4 uWaves[${WAVES}];
uniform vec3 uColor, uGold;
varying vec3 vPos;
void main(){
  vec2 p = vec2(vPos.x * 2.0 * uHalf, -vPos.z * ${ROAD_VIEW.toFixed(1)}); // road units: x across, d down the road
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${WAVES}; i++) {
    vec4 w = uWaves[i];
    float age = uTime - w.y;
    if (age < 0.0 || age > 0.9) continue;
    float front = age * 70.0;                          // races away from the keys
    float dx = (p.x - w.x) / (uHalf * (0.35 + age * 2.2 + w.w * 2.0));
    float ring = exp(-pow((p.y - front) / (0.9 + age * 2.0), 2.0)) * exp(-dx * dx);
    col += mix(uColor, uGold, w.w) * ring * w.z * (1.0 - age / 0.9);
  }
  // Edge glow: brighter with combo, pulsing on the beat, fading into the distance.
  float edge = smoothstep(0.82, 1.0, abs(p.x) / uHalf);
  float far = 1.0 - smoothstep(0.0, ${ROAD_VIEW.toFixed(1)}, p.y);
  col += mix(uColor, uGold, 0.4) * edge * far * uEdge * (0.35 + 0.65 * uBeat);
  gl_FragColor = vec4(col, 1.0);
}`,
      }),
    );
    this.mesh.position.y = 0.03; // just above the deck
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.name = "road-waves";
  }

  /** Fit the overlay to the road. */
  fit(halfWidth: number) {
    this.uniforms.uHalf.value = halfWidth;
    this.mesh.scale.set(halfWidth * 2, 1, ROAD_VIEW);
  }

  /** A ripple from lane position `x`; `gold` for golden notes and milestones. */
  wave(x: number, time: number, strength = 1, gold = 0) {
    this.waves[this.next].set(x, time, strength, gold);
    this.next = (this.next + 1) % WAVES;
  }

  update(time: number, combo: number, beat: number) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uEdge.value += (Math.min(1, combo / 60) - u.uEdge.value) * 0.05;
    u.uBeat.value = beat;
  }
}

export class SpeedLines {
  readonly mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly uniforms = { uTime: { value: 0 }, uAmount: { value: 0 }, uColor: { value: new THREE.Color("#fff2c0") } };
  private target = 0;

  constructor(count = 70) {
    const geometry = new THREE.PlaneGeometry(0.05, 1);
    geometry.rotateX(-Math.PI / 2); // lying along z
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    geometry.setAttribute("iSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    this.mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
uniform float uTime, uAmount;
attribute vec4 iSeed;
varying float vA, vV;
void main(){
  // A tunnel of streaks around the road: angle and radius from the seed, flying toward the camera.
  float a = iSeed.x * 6.2832, r = 7.0 + iSeed.y * 12.0;
  float z = -mod(uTime * (60.0 + iSeed.z * 50.0) + iSeed.w * 120.0, 120.0) + 8.0;
  vec3 base = vec3(cos(a) * r, 3.0 + sin(a) * r * 0.55, z);
  float len = 3.0 + iSeed.z * 5.0;
  vec3 p = base + vec3(position.x * (1.0 + iSeed.y), 0.0, position.z * len);
  vV = position.z + 0.5;
  vA = uAmount * smoothstep(-120.0, -60.0, z) * (1.0 - smoothstep(0.0, 8.0, z));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
        fragmentShader: /* glsl */ `
uniform vec3 uColor;
varying float vA, vV;
void main(){
  float a = vA * smoothstep(0.0, 0.6, vV) * (1.0 - smoothstep(0.85, 1.0, vV));
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
}`,
      }),
      count,
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.name = "speed-lines";
    this.mesh.visible = false;
  }

  /** 1 during Encore, a faint hint at high combo, 0 otherwise. */
  set(amount: number) {
    this.target = amount;
  }

  update(time: number, dt: number) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uAmount.value += (this.target - u.uAmount.value) * Math.min(1, dt * 3);
    this.mesh.visible = u.uAmount.value > 0.01; // skip the draw entirely when idle
  }
}
