// GPU-light effects: one pooled additive particle cloud (sparks, fireworks,
// confetti, weather) and pooled shockwave rings.
import * as THREE from "three";
import { uploadPrefix } from "./upload";
import type { Weather } from "./themes";

const pointsVertex = /* glsl */ `
attribute float size;
attribute vec4 tint;
varying vec4 vTint;
uniform float scale;
void main(){
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const pointsFragment = /* glsl */ `
varying vec4 vTint;
uniform float soft;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float a = mix(step(d, 0.42), core * core, soft);
  gl_FragColor = vec4(vTint.rgb * (1.0 + core), a * vTint.a);
}`;

type Particle = {
  alive: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number; r: number; g: number; b: number;
  gravity: number; drag: number; spin: number;
  scroll: number; // moves with the road
};

export class Particles {
  readonly points: THREE.Points;
  private pool: Particle[];
  private cursor = 0;
  private active = new Set<number>();
  private geometry: THREE.BufferGeometry;
  private pos: Float32Array;
  private tint: Float32Array;
  private size: Float32Array;
  density = 1;

  constructor(readonly capacity = 3000, soft = 1) {
    this.pool = Array.from({ length: capacity }, () => ({
      alive: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1,
      size: 1, r: 1, g: 1, b: 1, gravity: 0, drag: 0, spin: 0, scroll: 0,
    }));
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setDrawRange(0, 0);
    this.pos = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("tint", new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      this.geometry,
      new THREE.ShaderMaterial({
        vertexShader: pointsVertex,
        fragmentShader: pointsFragment,
        uniforms: { scale: { value: 300 }, soft: { value: soft } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setViewport(height: number, pixelRatio: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = height * pixelRatio * 0.9;
  }

  spawn(p: Partial<Particle> & { x: number; y: number; z: number }) {
    this.active.add(this.cursor);
    const slot = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    Object.assign(slot, {
      alive: true, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, r: 1, g: 1, b: 1,
      gravity: 0, drag: 0, spin: 0, scroll: 0,
    }, p);
    slot.life = 0;
  }

  /** A radial burst of sparks (note hits). */
  burst(x: number, y: number, z: number, color: THREE.Color, count = 22, power = 1) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.35 + Math.random() * 0.9;
      const speed = (2.2 + Math.random() * 4.2) * power;
      const white = Math.random() < 0.25;
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * speed * 0.8,
        vy: up * speed,
        vz: Math.sin(a) * speed * 0.35,
        max: 0.35 + Math.random() * 0.45,
        size: 0.16 + Math.random() * 0.22,
        r: white ? 1 : color.r, g: white ? 1 : color.g, b: white ? 1 : color.b,
        gravity: -9, drag: 1.6,
      });
    }
  }

  /** Sky fireworks: a shell of coloured stars that fall and fade. */
  firework(x: number, y: number, z: number, colors: THREE.Color[], count = 90) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const speed = 9 + Math.random() * 3;
      const c = colors[i % colors.length];
      this.spawn({
        x, y, z,
        vx: r * Math.cos(a) * speed, vy: u * speed, vz: r * Math.sin(a) * speed,
        max: 1.2 + Math.random() * 0.7, size: 0.9 + Math.random() * 0.8,
        r: c.r, g: c.g, b: c.b, gravity: -4, drag: 1.2,
      });
    }
  }

  /** Confetti from the top of the screen area around a point (results, restores). */
  confetti(x: number, y: number, z: number, colors: THREE.Color[], count = 120, spread = 10) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const c = colors[i % colors.length];
      this.spawn({
        x: x + (Math.random() - 0.5) * spread, y: y + Math.random() * 3, z: z + (Math.random() - 0.5) * spread * 0.4,
        vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 2,
        max: 2.2 + Math.random(), size: 0.25 + Math.random() * 0.2, r: c.r, g: c.g, b: c.b, gravity: -3.5, drag: 0.8,
      });
    }
  }

  /** Streaks along the road edges during Encore. */
  streak(x: number, y: number, z: number, color: THREE.Color, speed: number) {
    this.spawn({
      x, y, z, vx: 0, vy: 0.3 + Math.random() * 0.6, vz: speed,
      max: 0.6 + Math.random() * 0.3, size: 0.18 + Math.random() * 0.14,
      r: color.r, g: color.g, b: color.b, gravity: 0, drag: 0,
    });
  }

  update(dt: number, roadSpeed = 0) {
    const pos = this.pos, tint = this.tint, size = this.size;
    let count = 0;
    // Pool slots keep stable identities; the GPU buffer packs only living particles.
    for (const id of this.active) {
      const p = this.pool[id];
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        this.active.delete(id);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.gravity * dt; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + p.scroll * roadSpeed) * dt;
      const i = count++;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      const t = p.life / p.max;
      const fade = t < 0.1 ? t / 0.1 : 1 - Math.pow((t - 0.1) / 0.9, 1.6);
      tint[i * 4] = p.r; tint[i * 4 + 1] = p.g; tint[i * 4 + 2] = p.b; tint[i * 4 + 3] = fade;
      size[i] = p.size * (1 - t * 0.35);
    }
    this.geometry.setDrawRange(0, count);
    uploadPrefix(this.geometry.attributes.position as THREE.BufferAttribute, count);
    uploadPrefix(this.geometry.attributes.tint as THREE.BufferAttribute, count);
    uploadPrefix(this.geometry.attributes.size as THREE.BufferAttribute, count);
  }

  clear() {
    for (const id of this.active) this.pool[id].alive = false;
    this.active.clear();
    this.geometry.setDrawRange(0, 0);
  }
}

/** Expanding glow rings on the hit line. */
export class Rings {
  readonly group = new THREE.Group();
  private rings: { mesh: THREE.Mesh; life: number; max: number; scale: number }[] = [];
  private geometry = new THREE.RingGeometry(0.72, 1, 48);

  spawn(x: number, y: number, z: number, color: THREE.Color, scale = 1, max = 0.42) {
    let ring = this.rings.find((r) => r.life >= r.max);
    if (!ring) {
      if (this.rings.length > 40) return;
      const mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      ring = { mesh, life: 0, max, scale };
      this.rings.push(ring);
    }
    ring.life = 0;
    ring.max = max;
    ring.scale = scale;
    ring.mesh.position.set(x, y, z);
    (ring.mesh.material as THREE.MeshBasicMaterial).color.copy(color);
    ring.mesh.visible = true;
  }

  update(dt: number) {
    for (const r of this.rings) {
      if (r.life >= r.max) {
        r.mesh.visible = false;
        continue;
      }
      r.life += dt;
      const t = Math.min(1, r.life / r.max);
      const s = r.scale * (0.35 + 1.1 * (1 - Math.pow(1 - t, 3)));
      r.mesh.scale.setScalar(s);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.95;
    }
  }
}

/** Ambient weather for a theme, recycled around the camera. */
export class WeatherFx {
  readonly points: THREE.Points;
  private geometry = new THREE.BufferGeometry();
  private data: { x: number; y: number; z: number; phase: number; speed: number }[] = [];
  private kind: Weather = "none";

  constructor(readonly count = 260) {
    const pos = new Float32Array(count * 3);
    const tint = new Float32Array(count * 4);
    const size = new Float32Array(count);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("tint", new THREE.BufferAttribute(tint, 4));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(size, 1));
    this.points = new THREE.Points(
      this.geometry,
      new THREE.ShaderMaterial({
        vertexShader: pointsVertex,
        fragmentShader: pointsFragment,
        uniforms: { scale: { value: 300 }, soft: { value: 0.6 } },
        transparent: true,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  setViewport(height: number, pixelRatio: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = height * pixelRatio * 0.9;
  }

  setKind(kind: Weather) {
    this.kind = kind;
    const palette: Record<Weather, string[]> = {
      petals: ["#ff8fb8", "#ffc1d8", "#fff0f6"],
      snow: ["#ffffff", "#e8f2ff"],
      leaves: ["#ff7a1f", "#ffb21f", "#e2451c"],
      fireflies: ["#ffe38a", "#d8ff8a"],
      confetti: ["#ff4f4f", "#ffd02a", "#2fb2ff", "#5fd84a", "#8f5bff"],
      bubbles: ["#5ff3ff", "#b58cff", "#ff8fe0"],
      sparkles: ["#fff4c2", "#ffffff", "#ffe08a"],
      none: ["#ffffff"],
    };
    const colors = palette[kind].map((c) => new THREE.Color(c));
    const tint = this.geometry.attributes.tint as THREE.BufferAttribute;
    const size = this.geometry.attributes.size as THREE.BufferAttribute;
    const additive = kind === "fireflies" || kind === "sparkles" || kind === "bubbles";
    const mat = this.points.material as THREE.ShaderMaterial;
    mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.needsUpdate = true;
    this.data = [];
    for (let i = 0; i < this.count; i++) {
      const c = colors[i % colors.length];
      tint.setXYZW(i, c.r, c.g, c.b, kind === "none" ? 0 : kind === "bubbles" ? 0.55 : 0.9);
      size.setX(i, kind === "snow" ? 0.35 : kind === "fireflies" ? 0.3 : kind === "bubbles" ? 0.5 : 0.28);
      this.data.push({
        x: (Math.random() - 0.5) * 70,
        y: Math.random() * 22,
        z: -Math.random() * 110 + 10,
        phase: Math.random() * 10,
        speed: 0.6 + Math.random() * 0.8,
      });
    }
    tint.needsUpdate = true;
    size.needsUpdate = true;
  }

  update(dt: number, time: number, drift: number) {
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const k = this.kind;
    for (let i = 0; i < this.data.length; i++) {
      const p = this.data[i];
      const fall = k === "snow" ? 1.6 : k === "petals" || k === "leaves" || k === "confetti" ? 1.2 : k === "bubbles" ? -0.9 : 0;
      p.y -= fall * p.speed * dt;
      p.x += Math.sin(time * 0.8 + p.phase) * dt * (k === "fireflies" ? 0.8 : 0.5);
      p.z += drift * dt;
      if (k === "fireflies" || k === "sparkles") p.y += Math.sin(time * 1.3 + p.phase) * dt * 0.4;
      if (p.y < -2) p.y += 24;
      if (p.y > 24) p.y -= 26;
      if (p.z > 12) p.z -= 120;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    if (k === "fireflies" || k === "sparkles") {
      const tint = this.geometry.attributes.tint as THREE.BufferAttribute;
      for (let i = 0; i < this.data.length; i++) tint.setW(i, 0.45 + 0.55 * Math.max(0, Math.sin(time * 2 + this.data[i].phase * 3)));
      tint.needsUpdate = true;
    }
  }
}
