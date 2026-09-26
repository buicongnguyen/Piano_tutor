// The gameplay scene: the Piano Road, the player's keys, instanced note gems,
// beat lines, bar arches and lamps, and all hit feedback. World dressing
// (islets, destination island, characters) lives in world.ts.
import * as THREE from "three";
import type { Chart, ChartNote } from "../chart";
import { noteName } from "../../music";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { glowFromInstanceColor, ownMaterial, spawn, type Kit } from "./assets";
import { Particles, Rings, WeatherFx } from "./fx";
import { LANE_COLORS, LANE_SETS, PITCH_COLORS, type Theme } from "./themes";

export const ROAD_VIEW = 64; // distance (units) a note travels in `approach` seconds
const ROAD_FAR = 320; // deck length
const LANE_W = 1.18; // arcade lane width
const KEY_W = 0.46; // real-piano white key width
const PAD_LEN = 2.4;
const BLACK = new Set([1, 3, 6, 8, 10]);

// Words mode: a toy QWERTY keyboard. Keys and gems share the colour of the
// finger that types them (touch-typing zones), so the colours teach fingering.
const QWERTY = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const CAP = 0.68; // keycap pitch
const ROW_Z = [0.42, 1.12, 1.82];
const ROW_SHIFT = [0, 0.25, 0.75];
const FINGER_OF_COLUMN = [0, 1, 2, 3, 3, 4, 4, 5, 6, 7];
export const FINGER_COLORS = ["#ff4f4f", "#ff9416", "#ffd02a", "#5fd84a", "#2fb2ff", "#8f5bff", "#ff3d7f", "#20d3b0"];
export function letterKey(index: number) {
  const ch = String.fromCharCode(97 + index);
  for (let row = 0; row < 3; row++) {
    const col = QWERTY[row].indexOf(ch);
    if (col >= 0) return { ch, row, col, finger: FINGER_OF_COLUMN[col], x: (col - 4.5 + ROW_SHIFT[row]) * CAP, z: ROW_Z[row] };
  }
  return { ch, row: 1, col: 4, finger: 3, x: 0, z: ROW_Z[1] };
}

const letterVertex = /* glsl */ `
attribute float letter;
varying vec2 vUv;
void main(){
  float col = mod(letter, 8.0), row = floor(letter / 8.0);
  vUv = vec2((uv.x + col) / 8.0, (uv.y + 3.0 - row) / 4.0);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const letterFragment = /* glsl */ `
uniform sampler2D atlas; varying vec2 vUv;
void main(){ vec4 c = texture2D(atlas, vUv); if (c.a < 0.05) discard; gl_FragColor = c; }`;

/** 8×4 atlas of letter badges (white disc, ink letter) for the note gems. */
function letterAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < 26; i++) {
    const cx = (i % 8) * 64 + 32,
      cy = Math.floor(i / 8) * 64 + 32;
    g.fillStyle = "#1b1733";
    g.beginPath();
    g.arc(cx, cy + 2, 29, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff8ea";
    g.beginPath();
    g.arc(cx, cy, 28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1b1733";
    g.font = `800 42px "Baloo 2", "Nunito", system-ui, sans-serif`;
    g.fillText(String.fromCharCode(65 + i), cx, cy + 3);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export type StageOptions = {
  approach: number; // real seconds a note is visible
  speed: number;
  labels: boolean;
  laneLabels?: string[]; // arcade: keyboard letters
  laptopKeys?: Map<number, string>; // piano mode: midi -> laptop key letter
  touch: boolean;
  reducedMotion: boolean;
  quality: number; // particle density 0..1
  skin: string;
  assist?: Set<number>; // assist note ids (drawn ghosted)
  keyRange?: [number, number]; // piano mode: keys to draw
};

type KeyVisual = {
  lane: number;
  x: number;
  width: number;
  root: THREE.Object3D;
  glow?: THREE.MeshStandardMaterial;
  color: THREE.Color;
  pressed: number; // 0..1 animation
  held: boolean;
  flash: number;
  miss: number;
  black: boolean;
};

const roadVertex = /* glsl */ `
varying vec3 vWorld; varying vec2 vUv;
#include <fog_pars_vertex>
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const roadFragment = /* glsl */ `
uniform vec3 deck, line, trim, gold;
uniform float scroll, halfWidth, laneW, lanes, encore, beat, time, pianoMode, keyW, firstKey;
uniform float laneLit[12];
varying vec3 vWorld; varying vec2 vUv;
#include <fog_pars_fragment>
float blackKey(float k){ float m = mod(k, 12.0); return (m==1.0||m==3.0||m==6.0||m==8.0||m==10.0) ? 1.0 : 0.0; }
void main(){
  float x = vWorld.x, z = vWorld.z;
  vec3 col = deck;
  // Depth gradient and a scrolling chevron sheen that sells speed.
  col *= 0.82 + 0.28 * smoothstep(-160.0, 0.0, z);
  float chev = fract((z + scroll) * 0.12 + abs(x) * 0.06);
  col += deck * 0.22 * smoothstep(0.45, 0.5, chev) * smoothstep(0.62, 0.5, chev);
  // Lane dividers.
  float edge = 0.0;
  if (pianoMode < 0.5) {
    float lx = (x + halfWidth) / laneW;
    float d = abs(fract(lx) - 0.5) * 2.0;
    edge = smoothstep(0.94, 0.985, d) * step(0.2, lx) * step(lx, lanes - 0.2);
    int li = int(floor(lx));
    for (int i = 0; i < 12; i++) if (i == li) col += line * laneLit[i] * 0.22 * smoothstep(-14.0, 0.0, z);
  } else if (pianoMode < 1.5) {
    float kx = (x + halfWidth) / keyW;
    float d = abs(fract(kx) - 0.5) * 2.0;
    edge = smoothstep(0.93, 0.99, d) * 0.5;
    // Darker stripes where black keys sit (between C-D, D-E, F-G, G-A, A-B).
    float j = floor(kx + 0.5) - 1.0;
    float m = mod(j + firstKey, 7.0);
    float hasBlack = (m == 0.0 || m == 1.0 || m == 3.0 || m == 4.0 || m == 5.0) ? 1.0 : 0.0;
    float bx = abs(kx - floor(kx + 0.5));
    col *= 1.0 - hasBlack * smoothstep(0.34, 0.26, bx) * 0.38;
  }
  col = mix(col, line, edge * 0.55);
  // Glowing side trims.
  float side = smoothstep(halfWidth - 0.22, halfWidth - 0.04, abs(x));
  col = mix(col, trim * 1.4, side);
  // Hit zone glow and beat pulse.
  float zone = smoothstep(-2.4, 0.0, z) * (1.0 - smoothstep(0.0, 0.6, z));
  col += line * zone * (0.25 + 0.35 * beat);
  // Encore: gold wash with racing stripes.
  float stripes = smoothstep(0.7, 1.0, fract((z + scroll * 2.0) * 0.08));
  col = mix(col, gold * (0.8 + 0.5 * stripes), encore * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

const beamVertex = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const beamFragment = /* glsl */ `
uniform vec3 color; uniform float amount; varying vec2 vUv;
void main(){
  float a = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  gl_FragColor = vec4(color * 1.6, a * amount);
}`;

export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 2000);
  readonly particles: Particles;
  readonly rings = new Rings();
  readonly weather = new WeatherFx();
  readonly content = new THREE.Group(); // road, keys, notes
  chart?: Chart;
  options?: StageOptions;
  theme?: Theme;
  keys: KeyVisual[] = [];
  private keyByLane = new Map<number, KeyVisual>();
  private road?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private gems?: THREE.InstancedMesh;
  private golds?: THREE.InstancedMesh;
  private tails?: THREE.InstancedMesh;
  private caps?: THREE.InstancedMesh;
  private chords?: THREE.InstancedMesh;
  private letters?: THREE.InstancedMesh;
  private shadows?: THREE.InstancedMesh;
  private beatLines?: THREE.InstancedMesh;
  private curbs?: THREE.InstancedMesh;
  private arches: THREE.Object3D[] = [];
  private lamps: THREE.Object3D[] = [];
  private beams: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
  private hitLine?: THREE.Mesh;
  private labels: THREE.Mesh[] = [];
  private noteState: Uint8Array = new Uint8Array(0); // 0 waiting, 1 hit, 2 miss, 3 holding
  private missAt = new Float32Array(0);
  private assistFired = new Set<number>();
  private gemGlow = { value: 0.55 };
  private halfWidth = 4;
  private firstKey = 48;
  private laneW = LANE_W;
  private tmp = new THREE.Object3D();
  private color = new THREE.Color();
  private shake = 0;
  private kick = 0;
  private encoreGlow = 0;
  private beatPulse = 0;
  private lastBeat = -1;
  private songTime = 0;
  private visibleTo = 0;
  private cameraBase = new THREE.Vector3();
  private cameraLook = new THREE.Vector3();
  private intro = 1; // 0 → 1 fly-in at the start of a stage
  outro = 0; // 0 → 1 victory shot on the results screen
  laneColors: THREE.Color[] = [];

  constructor(readonly stageKit: Kit) {
    this.particles = new Particles(3000, 1);
    this.scene.add(this.content, this.particles.points, this.rings.group, this.weather.points);
    // Tune shared kit materials for the real-time look: keep ivory off the clip point
    // and let bulbs glow without flooding the bloom.
    const tuned = new Set<THREE.Material>();
    for (const root of stageKit.values())
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!m || tuned.has(m)) return;
        tuned.add(m);
        if (m.name === "Pad Ivory" || m.name === "Key Ivory") {
          m.color.multiplyScalar(0.8);
          m.roughness = 0.42;
        }
        if (m.name === "Arch Bulb Glow") m.emissiveIntensity = 2.2;
        if (m.name === "Lamp Glow") m.emissiveIntensity = 2.6;
        if (m.name === "Curb Paint") m.roughness = 0.35;
      });
  }

  get roadHalf() {
    return this.halfWidth;
  }

  get unitsPerSong() {
    const o = this.options!;
    return ROAD_VIEW / (o.approach * o.speed);
  }

  /** z of an event at song time t (hit line at 0, notes approach from -z). */
  z(t: number) {
    return -(t - this.songTime) * this.unitsPerSong;
  }

  setup(chart: Chart, theme: Theme, options: StageOptions) {
    this.dispose();
    this.chart = chart;
    this.theme = theme;
    this.options = options;
    this.noteState = new Uint8Array(chart.notes.length);
    this.assistFired.clear();
    this.missAt = new Float32Array(chart.notes.length);
    this.particles.density = options.quality;
    this.particles.clear();
    this.weather.setKind(options.reducedMotion ? "none" : theme.weather);
    this.buildKeys(chart, options);
    this.buildRoad(theme);
    this.buildNotes(chart);
    this.buildDressing(theme);
    this.fitCamera(this.camera.aspect);
    this.intro = options.reducedMotion ? 1 : 0;
    this.outro = 0;
  }

  // ------------------------------------------------------------ build

  private buildKeys(chart: Chart, o: StageOptions) {
    const kit = this.stageKit;
    this.keys = [];
    this.keyByLane.clear();
    if (chart.mode === "lanes") {
      const set = LANE_SETS[chart.lanes] ?? LANE_SETS[6];
      this.laneColors = set.map((i) => new THREE.Color(LANE_COLORS[i]));
      this.laneW = LANE_W;
      this.halfWidth = (chart.lanes * LANE_W) / 2 + 0.35;
      for (let lane = 0; lane < chart.lanes; lane++) {
        const x = (lane - (chart.lanes - 1) / 2) * LANE_W;
        const root = spawn(kit, "LanePad") ?? new THREE.Group();
        root.scale.setScalar(LANE_W / 1.0);
        root.position.set(x, 0, 0);
        const glow = ownMaterial(root, "Pad Glow");
        const color = this.laneColors[lane];
        if (glow) {
          glow.color.copy(color);
          glow.emissive.copy(color);
          glow.emissiveIntensity = 0.9;
        }
        this.content.add(root);
        const key: KeyVisual = { lane, x, width: LANE_W, root, glow, color, pressed: 0, held: false, flash: 0, miss: 0, black: false };
        this.keys.push(key);
        this.keyByLane.set(lane, key);
        const label = o.laneLabels?.[lane];
        if (label && !o.touch) this.addLabel(label, x, 0.03, 2.38, 0.6, "#1b1733");
      }
    } else if (chart.mode === "words") {
      // A toy QWERTY keyboard; lanes are letters (0 = a … 25 = z).
      this.laneW = CAP;
      this.halfWidth = 5 * CAP + 0.55;
      const capGeo = new RoundedBoxGeometry(0.6, 0.3, 0.6, 3, 0.1);
      for (let lane = 0; lane < 26; lane++) {
        const k = letterKey(lane);
        const color = new THREE.Color(FINGER_COLORS[k.finger]);
        const root = new THREE.Group();
        root.position.set(k.x, 0, k.z);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0 });
        const cap = new THREE.Mesh(capGeo, mat);
        cap.position.y = -0.03;
        root.add(cap);
        // Dark ink on the light yellow and lime keys, white elsewhere.
        this.addLabel(k.ch.toUpperCase(), 0, 0.13, 0.02, 0.46, k.finger === 2 || k.finger === 3 ? "#1b1733" : "#ffffff", undefined, root);
        // Home-row bumps on F and J, like a real keyboard.
        if (k.ch === "f" || k.ch === "j") {
          const bump = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }));
          bump.position.set(0, 0.135, 0.2);
          root.add(bump);
        }
        this.content.add(root);
        const key: KeyVisual = { lane, x: k.x, width: 0.6, root, glow: mat, color, pressed: 0, held: false, flash: 0, miss: 0, black: false };
        this.keys.push(key);
        this.keyByLane.set(lane, key);
      }
    } else {
      // A real keyboard covering the chart range, padded to whole octaves.
      const lo = o.keyRange?.[0] ?? Math.max(21, Math.floor((chart.range[0] - 2) / 12) * 12);
      const hi = o.keyRange?.[1] ?? Math.min(108, Math.ceil((chart.range[1] + 3) / 12) * 12);
      this.firstKey = lo;
      let whites = 0;
      for (let m = lo; m <= hi; m++) if (!BLACK.has(m % 12)) whites++;
      this.laneW = KEY_W;
      this.halfWidth = (whites * KEY_W) / 2 + 0.3;
      let wi = 0;
      const xs = new Map<number, number>();
      for (let m = lo; m <= hi; m++) {
        if (BLACK.has(m % 12)) continue;
        xs.set(m, -((whites - 1) / 2) * KEY_W + wi * KEY_W);
        wi++;
      }
      for (let m = lo; m <= hi; m++) {
        const black = BLACK.has(m % 12);
        const x = black ? (xs.get(m - 1)! + xs.get(m + 1)!) / 2 : xs.get(m)!;
        const root = spawn(kit, black ? "BlackKey" : "WhiteKey") ?? new THREE.Group();
        root.scale.setScalar(KEY_W * 0.98);
        root.position.set(x, 0, 0);
        const color = new THREE.Color(PITCH_COLORS[m % 12]);
        const glow = ownMaterial(root, black ? "Key Ebony" : "Key Ivory");
        this.content.add(root);
        const key: KeyVisual = { lane: m, x, width: black ? KEY_W * 0.6 : KEY_W, root, glow, color, pressed: 0, held: false, flash: 0, miss: 0, black };
        this.keys.push(key);
        this.keyByLane.set(m, key);
        if (!black && o.labels && (m % 12 === 0 || o.laptopKeys?.has(m)))
          this.addLabel(noteName(m).replace("♯", "#"), x, 0.02, 2.3, 0.34, m % 12 === 0 ? "#e8282f" : "#5b5470");
        const letter = o.laptopKeys?.get(m);
        if (letter && !o.touch)
          this.addLabel(letter, x, black ? 0.27 : 0.02, black ? 1.3 : 1.75, 0.3, black ? "#ffffff" : "#1b1733", black ? "#15131f" : undefined);
      }
    }
    // Cabinet: stretched mid section plus lacquered cheeks.
    const width = this.halfWidth * 2;
    const mid = spawn(kit, "Keybed_Mid");
    if (mid) {
      mid.scale.set(width, 1, this.chart?.mode === "piano" ? 1.13 : 1);
      mid.position.set(0, 0, 0);
      this.content.add(mid);
    }
    const left = spawn(kit, "Keybed_Left"),
      right = spawn(kit, "Keybed_Right");
    if (left) {
      left.position.set(-this.halfWidth, 0, 0);
      this.content.add(left);
    }
    if (right) {
      right.position.set(this.halfWidth, 0, 0);
      this.content.add(right);
    }
    this.applySkin(o.skin);
    // Lane light beams rising from each key when pressed.
    this.beams = [];
    for (const key of this.keys) {
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(key.width * 0.96, 7),
        new THREE.ShaderMaterial({
          vertexShader: beamVertex,
          fragmentShader: beamFragment,
          uniforms: { color: { value: key.color.clone() }, amount: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.set(key.x, 3.5, -0.15);
      beam.renderOrder = 6;
      beam.userData.lane = key.lane;
      this.beams.push(beam);
      this.content.add(beam);
    }
  }

  applySkin(skin: string) {
    const skins: Record<string, string> = {
      cherry: "#e8282f",
      ocean: "#1f6fe8",
      sunflower: "#ffb81f",
      mint: "#12b39a",
      grape: "#7a3cff",
      midnight: "#1b1f4b",
    };
    this.content.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.name === "Cabinet Lacquer") m.color.set(skins[skin] ?? skins.cherry);
    });
  }

  private addLabel(text: string, x: number, y: number, z: number, size: number, color: string, bg?: string, parent?: THREE.Object3D) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.font = `800 ${text.length > 2 ? 52 : 78}px "Baloo 2", "Nunito", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 70);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2 + 0.35;
    mesh.position.set(x, y + 0.01, z);
    mesh.renderOrder = 7;
    mesh.userData.baseY = y + 0.01;
    this.labels.push(mesh);
    (parent ?? this.content).add(mesh);
  }

  private buildRoad(theme: Theme) {
    const lanes = this.chart!.mode === "lanes" ? this.chart!.lanes : 0;
    const geometry = new THREE.PlaneGeometry(this.halfWidth * 2, ROAD_FAR, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -ROAD_FAR / 2 + 0.02);
    const material = new THREE.ShaderMaterial({
      vertexShader: roadVertex,
      fragmentShader: roadFragment,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          deck: { value: new THREE.Color(theme.road.deck) },
          line: { value: new THREE.Color(theme.road.line) },
          trim: { value: new THREE.Color(theme.road.trim) },
          gold: { value: new THREE.Color("#ffb81f") },
          scroll: { value: 0 },
          halfWidth: { value: this.halfWidth - (lanes ? 0.35 : 0.3) },
          laneW: { value: this.laneW },
          lanes: { value: lanes },
          encore: { value: 0 },
          beat: { value: 0 },
          time: { value: 0 },
          pianoMode: { value: lanes ? 0 : this.chart!.mode === "words" ? 2 : 1 },
          keyW: { value: KEY_W },
          firstKey: { value: 0 },
          laneLit: { value: new Array(12).fill(0) },
        },
      ]),
    });
    // The first white key's position in the C–B cycle (0 = C) for black-key stripes.
    const whiteIndex = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][this.firstKey % 12];
    material.uniforms.firstKey.value = whiteIndex;
    this.road = new THREE.Mesh(geometry, material);
    this.content.add(this.road);
    // Chunky side skirts below the deck edge.
    const skirtMat = new THREE.MeshStandardMaterial({ color: theme.road.side, roughness: 0.35 });
    const trimMat = new THREE.MeshStandardMaterial({ color: theme.road.trim, roughness: 0.3, metalness: 0.6 });
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, ROAD_FAR), skirtMat);
      skirt.position.set(side * (this.halfWidth + 0.2), -0.47, -ROAD_FAR / 2);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, ROAD_FAR), trimMat);
      trim.position.set(side * (this.halfWidth + 0.2), -0.07, -ROAD_FAR / 2);
      this.content.add(skirt, trim);
    }
    const under = new THREE.Mesh(
      new THREE.BoxGeometry(this.halfWidth * 2, 0.8, ROAD_FAR),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.road.deck).multiplyScalar(0.55), roughness: 0.6 }),
    );
    // Stops at the hit line: a pressed key dips below the deck and must never be hidden by it.
    under.position.set(0, -0.45, -ROAD_FAR / 2 - 0.05);
    this.content.add(under);
    // Hit line: a glowing bar where the notes land.
    this.hitLine = new THREE.Mesh(
      new THREE.BoxGeometry(this.halfWidth * 2 - 0.2, 0.08, 0.16),
      new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: theme.road.line, emissiveIntensity: 1.4, roughness: 0.3 }),
    );
    this.hitLine.position.set(0, 0.05, -0.1);
    this.content.add(this.hitLine);
  }

  private buildNotes(chart: Chart) {
    const kit = this.stageKit;
    const geometryOf = (name: string, fallback: THREE.BufferGeometry) => {
      const root = kit.get(name);
      let geometry: THREE.BufferGeometry | undefined;
      let material: THREE.MeshStandardMaterial | undefined;
      root?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!geometry && mesh.isMesh) {
          geometry = mesh.geometry.clone();
          mesh.updateWorldMatrix(true, false);
          const rel = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
          geometry.applyMatrix4(rel);
          material = (mesh.material as THREE.MeshStandardMaterial).clone();
        }
      });
      return { geometry: geometry ?? fallback, material: material ?? new THREE.MeshStandardMaterial({ color: "#ffffff" }) };
    };
    const count = Math.max(1, chart.notes.length);
    const cap = Math.min(count, 700);
    const gem = geometryOf("NoteGem", new THREE.OctahedronGeometry(0.4));
    gem.material.roughness = 0.18;
    gem.material.envMapIntensity = 1.2;
    glowFromInstanceColor(gem.material, this.gemGlow);
    this.gems = new THREE.InstancedMesh(gem.geometry, gem.material, cap);
    const gold = geometryOf("GoldGem", new THREE.OctahedronGeometry(0.4));
    gold.material.emissive = new THREE.Color("#ff9d00");
    gold.material.emissiveIntensity = 0.55;
    this.golds = new THREE.InstancedMesh(gold.geometry, gold.material, Math.min(cap, 200));
    const tail = geometryOf("HoldBody", new THREE.BoxGeometry(0.5, 0.18, 1));
    glowFromInstanceColor(tail.material, { value: 0.7 });
    tail.material.transparent = true;
    tail.material.opacity = 0.92;
    this.tails = new THREE.InstancedMesh(tail.geometry, tail.material, Math.min(cap, 160));
    const cap_ = geometryOf("HoldCap", new THREE.CylinderGeometry(0.35, 0.35, 0.2, 20));
    glowFromInstanceColor(cap_.material, { value: 0.6 });
    this.caps = new THREE.InstancedMesh(cap_.geometry, cap_.material, Math.min(cap, 160));
    this.chords = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.08, 0.12),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8 }),
      Math.min(cap, 120),
    );
    // Soft contact shadows keep the gems sitting on the road.
    const shadowTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      grad.addColorStop(0, "rgba(0,0,0,0.55)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: "#140c3a" }),
      cap + Math.min(cap, 200),
    );
    this.shadows.renderOrder = 1;
    this.letters = undefined;
    if (chart.mode === "words") {
      // Letter badges riding on each gem (atlas lookup by instance attribute).
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.setAttribute("letter", new THREE.InstancedBufferAttribute(new Float32Array(cap + 200), 1).setUsage(THREE.DynamicDrawUsage));
      this.letters = new THREE.InstancedMesh(
        geo,
        new THREE.ShaderMaterial({
          vertexShader: letterVertex,
          fragmentShader: letterFragment,
          uniforms: { atlas: { value: letterAtlas() } },
          transparent: true,
          depthWrite: false,
        }),
        cap + 200,
      );
      this.letters.renderOrder = 8;
      this.letters.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.letters.count = 0;
      this.letters.frustumCulled = false;
      this.content.add(this.letters);
    }
    for (const mesh of [this.gems, this.golds, this.tails, this.caps, this.chords, this.shadows]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.content.add(mesh);
    }
    // Colour buffers exist from the first setColorAt.
    for (const mesh of [this.gems, this.tails, this.caps]) mesh.setColorAt(0, this.color.set("#ffffff"));
    // Beat and bar lines.
    this.beatLines = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.03, 1),
      new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false }),
      160,
    );
    this.beatLines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beatLines.frustumCulled = false;
    this.beatLines.setColorAt(0, this.color);
    this.content.add(this.beatLines);
  }

  private buildDressing(theme: Theme) {
    const kit = this.stageKit;
    // Piano-key curbs along both edges (white blocks with raised black keys).
    const curbProto = kit.get("CurbBlock");
    let curbGeometry: THREE.BufferGeometry = new THREE.BoxGeometry(0.6, 0.35, 1);
    let curbMaterial: THREE.Material = new THREE.MeshStandardMaterial({ color: "#ffffff" });
    curbProto?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        curbGeometry = mesh.geometry;
        curbMaterial = (mesh.material as THREE.Material).clone();
      }
    });
    const length = this.options!.quality < 0.6 ? 80 : 150;
    this.curbs = new THREE.InstancedMesh(curbGeometry, curbMaterial, Math.ceil(length) * 2 * 2);
    this.curbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.curbs.frustumCulled = false;
    this.curbs.userData.length = length;
    this.curbs.setColorAt(0, this.color.set("#ffffff"));
    this.content.add(this.curbs);
    // Bar arches and lamps (pooled, positioned by bar times).
    this.arches = [];
    for (let i = 0; i < 5; i++) {
      const arch = spawn(kit, "BarArch");
      if (!arch) break;
      const paint = ownMaterial(arch, "Arch Paint");
      paint?.color.set(theme.arch);
      arch.scale.set(Math.max(1, (this.halfWidth * 2 + 1.2) / 9), Math.min(1.3, Math.max(1, (this.halfWidth * 2 + 1.2) / 9)), 1);
      arch.visible = false;
      this.arches.push(arch);
      this.content.add(arch);
    }
    this.lamps = [];
    for (let i = 0; i < 24; i++) {
      const lamp = spawn(kit, "RoadLamp");
      if (!lamp) break;
      lamp.visible = false;
      if (i % 2) lamp.scale.x = -1;
      this.lamps.push(lamp);
      this.content.add(lamp);
    }
  }

  /** Frame the keys and road for any aspect ratio (phones in portrait included). */
  fitCamera(aspect: number) {
    const cam = this.camera;
    cam.aspect = aspect;
    const portrait = aspect < 1;
    cam.fov = portrait ? 64 : aspect < 1.5 ? 56 : 50;
    cam.updateProjectionMatrix();
    // Words mode looks down more steeply so the keyboard and letters read large.
    const words = this.chart?.mode === "words";
    const elevation = THREE.MathUtils.degToRad(portrait ? 33 : words ? 31 : 24);
    const look = new THREE.Vector3(0, portrait || words ? 0 : 1.2, portrait ? -9 : words ? -10 : -15);
    const coverage = this.halfWidth + (portrait ? 0.5 : words ? 0.8 : 1.6);
    const keyLen = this.chart?.mode === "piano" ? 6 * KEY_W * 0.98 : this.chart?.mode === "words" ? ROW_Z[2] + 0.35 : PAD_LEN * LANE_W;
    let lo = 4,
      hi = 80;
    const probe = new THREE.Vector3();
    for (let i = 0; i < 30; i++) {
      const d = (lo + hi) / 2;
      cam.position.set(0, look.y + Math.sin(elevation) * d, look.z + Math.cos(elevation) * d);
      cam.lookAt(look);
      cam.updateMatrixWorld(true);
      let ok = true;
      for (const [x, z] of [
        [-coverage, keyLen + 0.2],
        [coverage, keyLen + 0.2],
        [-coverage, 0],
        [coverage, 0],
      ]) {
        probe.set(x, 0, z).project(cam);
        if (Math.abs(probe.x) > 0.96 || probe.y < (portrait ? -0.9 : -0.94)) ok = false;
      }
      if (ok) hi = d;
      else lo = d;
    }
    const d = hi;
    cam.position.set(0, look.y + Math.sin(elevation) * d, look.z + Math.cos(elevation) * d);
    cam.lookAt(look);
    this.cameraBase.copy(cam.position);
    this.cameraLook.copy(look);
  }

  // ------------------------------------------------------------ events

  keyFor(lane: number) {
    return this.keyByLane.get(lane);
  }

  press(lane: number, down: boolean) {
    const key = this.keyByLane.get(lane);
    if (!key) return;
    key.held = down;
    if (down) key.flash = Math.max(key.flash, 0.5);
  }

  hit(note: ChartNote, judgement: "perfect" | "great" | "good") {
    this.noteState[note.id] = note.hold ? 3 : 1;
    const key = this.keyByLane.get(note.lane);
    if (!key) return;
    key.flash = 1;
    const color = note.golden ? this.color.set("#ffc53d") : this.noteColor(note);
    const power = judgement === "perfect" ? 1.15 : judgement === "great" ? 0.95 : 0.7;
    this.particles.burst(key.x, 0.35, 0.05, color, judgement === "perfect" ? 26 : 16, power);
    this.rings.spawn(key.x, 0.08, -0.05, color, key.width * (judgement === "perfect" ? 1.5 : 1.1));
    if (judgement === "perfect" && !this.options?.reducedMotion) this.kick = Math.min(1, this.kick + 0.25);
  }

  miss(note: ChartNote) {
    this.noteState[note.id] = 2;
    this.missAt[note.id] = this.songTime;
    const key = this.keyByLane.get(note.lane);
    if (key) key.miss = 1;
    if (!this.options?.reducedMotion) this.shake = Math.min(1, this.shake + 0.35);
  }

  holdEnd(note: ChartNote, complete: boolean) {
    this.noteState[note.id] = 1;
    const key = this.keyByLane.get(note.lane);
    if (key && complete) {
      this.rings.spawn(key.x, 0.08, -0.05, this.noteColor(note), key.width * 1.8, 0.5);
      this.particles.burst(key.x, 0.4, 0, this.noteColor(note), 30, 1.2);
    }
  }

  stray(lane: number) {
    const key = this.keyByLane.get(lane);
    if (key) key.flash = Math.max(key.flash, 0.25);
  }

  encoreBurst() {
    this.encoreGlow = 1;
    if (!this.options?.reducedMotion) this.kick = 1;
    const gold = [new THREE.Color("#ffc53d"), new THREE.Color("#fff4c2"), new THREE.Color("#ff9416")];
    for (let i = 0; i < 3; i++) this.particles.firework((i - 1) * 14, 22 + i * 3, -60 - i * 10, gold, 110);
  }

  celebrate(combo: number) {
    const colors = this.laneColors.length ? this.laneColors : [new THREE.Color("#ffd02a")];
    const x = (Math.random() - 0.5) * 30;
    this.particles.firework(x, 20 + Math.random() * 8, -70 - Math.random() * 30, colors, combo >= 100 ? 140 : 100);
  }

  noteColor(note: ChartNote) {
    if (note.golden) return this.color.set("#ffc53d");
    if (this.chart?.mode === "words") return this.color.set(FINGER_COLORS[letterKey(note.lane).finger]);
    if (this.chart?.mode === "piano") return this.color.set(PITCH_COLORS[note.midi % 12]);
    return this.color.copy(this.laneColors[note.lane] ?? this.laneColors[0]);
  }

  /** Screen position (CSS px) of a lane at the hit line, for judgement popups. */
  screenOf(lane: number, width: number, height: number, lift = 1.4) {
    const key = this.keyByLane.get(lane);
    const v = new THREE.Vector3(key?.x ?? 0, lift, -0.5).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
  }

  /** Map a pointer to a lane: ray to the road/keys plane, nearest key by x. */
  laneAt(clientX: number, clientY: number, rect: DOMRect) {
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return undefined;
    if (Math.abs(hit.x) > this.halfWidth + 0.6) return undefined;
    if (this.chart?.mode === "words") {
      // Only the keyboard itself is tappable: the nearest keycap wins.
      if (hit.z < -0.3) return undefined;
      let best: KeyVisual | undefined,
        bestD = Infinity;
      for (const k of this.keys) {
        const d = Math.hypot(k.x - hit.x, letterKey(k.lane).z - hit.z);
        if (d < bestD) {
          best = k;
          bestD = d;
        }
      }
      return bestD < 0.6 ? best?.lane : undefined;
    }
    if (this.chart?.mode === "piano") {
      // Black keys win in their raised front half, like a real keyboard.
      let best: KeyVisual | undefined,
        bestD = Infinity;
      for (const k of this.keys) {
        const d = Math.abs(k.x - hit.x);
        if (k.black && d < k.width / 2 && hit.z < 1.6) return k.lane;
        if (!k.black && d < bestD) {
          best = k;
          bestD = d;
        }
      }
      return best?.lane;
    }
    let best: KeyVisual | undefined,
      bestD = Infinity;
    for (const k of this.keys) {
      const d = Math.abs(k.x - hit.x);
      if (d < bestD) {
        best = k;
        bestD = d;
      }
    }
    return best?.lane;
  }

  // ------------------------------------------------------------ frame

  update(dt: number, songTime: number, state: { encore: number; encoreActive: boolean; harmony: number; holding: Set<number> }) {
    const chart = this.chart,
      o = this.options;
    if (!chart || !o) return;
    this.songTime = songTime;
    const ups = this.unitsPerSong;
    const reduced = o.reducedMotion;
    // Beat pulse from the chart's beat grid.
    let beatIndex = -1;
    for (let i = 0; i < chart.beats.length; i++) {
      if (chart.beats[i] > songTime) break;
      beatIndex = i;
    }
    if (beatIndex !== this.lastBeat && beatIndex >= 0) {
      this.lastBeat = beatIndex;
      this.beatPulse = 1;
    }
    this.beatPulse = Math.max(0, this.beatPulse - dt * 4);
    this.encoreGlow += ((state.encoreActive ? 1 : 0) - this.encoreGlow) * Math.min(1, dt * 3);
    this.gemGlow.value = 0.45 + 0.25 * this.beatPulse + 0.3 * this.encoreGlow;

    // Road uniforms.
    const road = this.road!.material.uniforms;
    road.scroll.value = songTime * ups;
    road.encore.value = this.encoreGlow;
    road.beat.value = this.beatPulse;
    road.time.value = songTime;
    const lit = road.laneLit.value as number[];
    for (const key of this.keys) if (key.lane < 12 && chart.mode === "lanes") lit[key.lane] = key.held ? 1 : 0;

    // Keys: press animation, glow and miss wobble.
    for (const key of this.keys) {
      const target = key.held ? 1 : 0;
      key.pressed += (target - key.pressed) * Math.min(1, dt * (target ? 40 : 18));
      key.flash = Math.max(0, key.flash - dt * 3.2);
      key.miss = Math.max(0, key.miss - dt * 3);
      key.root.rotation.x = chart.mode === "words" ? 0 : key.pressed * (chart.mode === "lanes" ? 0.075 : 0.06);
      key.root.position.y = -key.pressed * 0.05;
      key.root.position.x = key.x + (reduced ? 0 : Math.sin(key.miss * 40) * key.miss * 0.05);
      if (key.glow) {
        if (chart.mode === "lanes") key.glow.emissiveIntensity = 0.45 + key.flash * 2 + key.pressed * 0.8;
        else {
          key.glow.emissive.copy(key.color);
          key.glow.emissiveIntensity = key.flash * 1.6 + key.pressed * 0.6;
        }
      }
    }
    for (const beam of this.beams) {
      const key = this.keyByLane.get(beam.userData.lane as number)!;
      beam.material.uniforms.amount.value = Math.min(0.8, key.pressed * 0.22 + key.flash * 0.5);
      beam.visible = beam.material.uniforms.amount.value > 0.01;
    }
    this.hitLine!.scale.y = 1 + this.beatPulse * 0.8;

    this.updateNotes(songTime, ups, state.holding);
    this.updateLines(songTime, ups);
    this.updateDressing(songTime, ups);

    // Encore streaks along the edges.
    if (this.encoreGlow > 0.3 && !reduced && Math.random() < 0.7)
      for (const side of [-1, 1])
        this.particles.streak(side * (this.halfWidth + 0.3), 0.3, -40 - Math.random() * 30, this.color.set("#ffc53d"), 60);
    // Holding: sparks spray from held notes at the hit line.
    for (const id of state.holding) {
      const key = this.keyByLane.get(chart.notes[id].lane);
      if (key && Math.random() < 0.6) this.particles.burst(key.x, 0.3, 0, this.noteColor(chart.notes[id]), 2, 0.6);
    }
    this.particles.update(dt);
    this.rings.update(dt);
    this.weather.update(dt, performance.now() / 1000, reduced ? 0 : 6);

    // Camera: breathe on the beat, kick on perfects/Encore, shake on misses.
    this.shake = Math.max(0, this.shake - dt * 4);
    this.kick = Math.max(0, this.kick - dt * 3);
    const cam = this.camera;
    cam.position.copy(this.cameraBase);
    const look = this.cameraLook.clone();
    // Fly-in: swoop down from above the road onto the keys.
    this.intro = Math.min(1, this.intro + dt / 2.4);
    const e = 1 - Math.pow(1 - this.intro, 3);
    if (e < 1) {
      cam.position.add(new THREE.Vector3(0, 16 * (1 - e), 26 * (1 - e)));
      look.add(new THREE.Vector3(0, 0, -30 * (1 - e)));
    }
    // Victory: rise and look down the road toward the relit beacon.
    if (this.outro > 0) {
      const k = this.outro * this.outro * (3 - 2 * this.outro);
      cam.position.add(new THREE.Vector3(0, 7 * k, -4 * k));
      look.add(new THREE.Vector3(0, 10 * k, -110 * k));
    }
    if (!reduced) {
      cam.position.y += this.beatPulse * 0.04;
      cam.position.z += this.kick * 0.25 - this.encoreGlow * 0.6;
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.12;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.08;
    }
    cam.lookAt(look);
  }

  private updateNotes(t: number, ups: number, holding: Set<number>) {
    const chart = this.chart!,
      o = this.options!;
    const gems = this.gems!,
      golds = this.golds!,
      tails = this.tails!,
      caps = this.caps!,
      chords = this.chords!;
    const m = this.tmp;
    const shadows = this.shadows!;
    let si = 0;
    const letters = this.letters;
    const letterAttr = letters?.geometry.getAttribute("letter") as THREE.InstancedBufferAttribute | undefined;
    let li = 0;
    const badge = (x: number, y: number, z: number, s: number, lane: number) => {
      if (!letters || !letterAttr || li >= letters.instanceMatrix.count || s <= 0.02) return;
      m.position.set(x, y, z);
      m.rotation.set(-0.95, 0, 0);
      m.scale.setScalar(0.82 * s);
      m.updateMatrix();
      letters.setMatrixAt(li, m.matrix);
      letterAttr.setX(li++, lane);
    };
    const shadow = (x: number, z: number, w: number, s: number) => {
      if (si >= shadows.instanceMatrix.count || s <= 0.02) return;
      m.position.set(x, 0.025, z + 0.05);
      m.rotation.set(0, 0, 0);
      m.scale.set(w * 1.25 * s, 1, w * 0.95 * s);
      m.updateMatrix();
      shadows.setMatrixAt(si++, m.matrix);
    };
    let gi = 0,
      goi = 0,
      ti = 0,
      ci = 0,
      chi = 0;
    const horizon = t + ROAD_VIEW / ups;
    const scaleLanes = this.chart!.mode === "lanes" ? LANE_W * 0.92 : this.chart!.mode === "words" ? 0.62 : KEY_W * 1.15;
    const groupX = new Map<number, [number, number, number]>(); // group -> min x, max x, z
    for (let i = 0; i < chart.notes.length; i++) {
      const n = chart.notes[i];
      if (n.end < t - 1.2 && n.time < t - 1.2) continue;
      if (n.time > horizon) break;
      const st = this.noteState[i];
      const key = this.keyByLane.get(n.lane);
      if (!key) continue;
      const assist = o.assist?.has(i);
      if (assist && n.time <= t) {
        // Assisted notes play themselves: flash the key once as they land.
        if (!this.assistFired.has(i)) {
          this.assistFired.add(i);
          key.flash = Math.max(key.flash, 0.55);
          this.rings.spawn(key.x, 0.08, -0.05, this.noteColor(n), key.width * 0.9, 0.3);
        }
        continue;
      }
      const zHead = -(n.time - t) * ups;
      const zEnd = -(n.end - t) * ups;
      const width = (key.black ? 0.62 : 1) * scaleLanes;
      // Pop in at the far end of the road.
      const appear = THREE.MathUtils.clamp((zHead + ROAD_VIEW) / 6, 0, 1);
      // Hold tail (while holding the head is consumed at the hit line).
      if (n.hold && st !== 1) {
        const from = st === 3 && holding.has(i) ? 0 : Math.min(0, zHead);
        const to = Math.max(zEnd, -ROAD_VIEW);
        const len = from - to;
        if (len > 0.05 && st !== 1 && (st !== 3 || holding.has(i))) {
          m.position.set(key.x, 0.14 + (key.black ? 0.22 : 0), (from + to) / 2);
          m.rotation.set(0, 0, 0);
          m.scale.set(width * 0.5 / 0.5, 1, len);
          m.updateMatrix();
          if (ti < tails.instanceMatrix.count) {
            tails.setMatrixAt(ti, m.matrix);
            this.noteColor(n);
            if (st === 2) this.color.setRGB(0.35, 0.35, 0.42);
            else if (st === 3) this.color.multiplyScalar(1.5);
            tails.setColorAt(ti++, this.color);
          }
          if (zEnd > -ROAD_VIEW && ci < caps.instanceMatrix.count) {
            m.position.set(key.x, 0.12 + (key.black ? 0.22 : 0), zEnd);
            m.scale.set(width * 0.9, 1, width * 0.9);
            m.updateMatrix();
            caps.setMatrixAt(ci, m.matrix);
            caps.setColorAt(ci++, this.color);
          }
        }
      }
      if (st === 1 || st === 3) continue;
      let y = 0.24 + (key.black ? 0.24 : 0);
      let s = appear;
      if (st === 2) {
        const since = t - this.missAt[i];
        y -= since * 2.2;
        s *= Math.max(0, 1 - since * 1.6);
        if (s <= 0.01) continue;
      }
      if (zHead > 3) continue;
      if (n.golden && st !== 2) {
        if (goi >= golds.instanceMatrix.count) continue;
        m.position.set(key.x, y + 0.42 + 0.06 * this.beatPulse, zHead);
        m.rotation.set(0, Math.sin(t * 3 + i) * 0.45, 0);
        m.scale.setScalar(s * width * 1.2);
        m.updateMatrix();
        golds.setMatrixAt(goi++, m.matrix);
        shadow(key.x, zHead, width, s);
        badge(key.x, y + 0.95, zHead + 0.05, s, n.lane);
      } else {
        if (gi >= gems.instanceMatrix.count) continue;
        m.position.set(key.x, y + 0.12, zHead);
        m.rotation.set(0, 0, 0);
        m.scale.set((s * width) / 0.92, s * (1.55 + 0.2 * this.beatPulse) * Math.min(1, width), s * (width / 0.92) * 0.95);
        m.updateMatrix();
        gems.setMatrixAt(gi, m.matrix);
        this.noteColor(n);
        if (st === 2) this.color.setRGB(0.3, 0.3, 0.36);
        else if (assist) this.color.lerp(new THREE.Color("#9aa3c7"), 0.65);
        gems.setColorAt(gi++, this.color);
        if (st !== 2) shadow(key.x, zHead, width, s);
        badge(key.x, y + 0.72, zHead + 0.05, s, n.lane);
      }
      if (st === 0 && chart.mode === "lanes") {
        const g = groupX.get(n.group);
        if (g) {
          g[0] = Math.min(g[0], key.x);
          g[1] = Math.max(g[1], key.x);
        } else groupX.set(n.group, [key.x, key.x, zHead]);
      }
    }
    for (const [, [a, b, z]] of groupX) {
      if (b - a < 0.01 || chi >= chords.instanceMatrix.count) continue;
      m.position.set((a + b) / 2, 0.1, z);
      m.rotation.set(0, 0, 0);
      m.scale.set(b - a, 1, 1);
      m.updateMatrix();
      chords.setMatrixAt(chi++, m.matrix);
    }
    shadows.count = si;
    shadows.instanceMatrix.needsUpdate = true;
    if (letters && letterAttr) {
      letters.count = li;
      letters.instanceMatrix.needsUpdate = true;
      letterAttr.needsUpdate = true;
    }
    gems.count = gi;
    golds.count = goi;
    tails.count = ti;
    caps.count = ci;
    chords.count = chi;
    for (const mesh of [gems, golds, tails, caps, chords]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private updateLines(t: number, ups: number) {
    const chart = this.chart!;
    const lines = this.beatLines!;
    const m = this.tmp;
    const bars = new Set(chart.bars.map((b) => b.toFixed(3)));
    let n = 0;
    const width = this.halfWidth * 2 - 0.5;
    const line = new THREE.Color(this.theme!.road.line);
    for (const b of chart.beats) {
      const z = -(b - t) * ups;
      if (z > 0.2) continue;
      if (z < -ROAD_VIEW - 20) break;
      if (n >= lines.instanceMatrix.count) break;
      const bar = bars.has(b.toFixed(3));
      m.position.set(0, 0.015, z);
      m.rotation.set(0, 0, 0);
      m.scale.set(width, bar ? 1.4 : 0.8, bar ? 0.16 : 0.06);
      m.updateMatrix();
      lines.setMatrixAt(n, m.matrix);
      const fade = THREE.MathUtils.clamp((z + ROAD_VIEW + 20) / 20, 0, 1);
      lines.setColorAt(n++, this.color.copy(line).multiplyScalar((bar ? 0.9 : 0.35) * fade));
    }
    lines.count = n;
    lines.instanceMatrix.needsUpdate = true;
    if (lines.instanceColor) lines.instanceColor.needsUpdate = true;
  }

  private updateDressing(t: number, ups: number) {
    const chart = this.chart!;
    // Curbs: a scrolling piano keyboard along each edge.
    const curbs = this.curbs!;
    const length = curbs.userData.length as number;
    const m = this.tmp;
    const offset = (t * ups) % 7;
    let n = 0;
    const pattern = [1, 1, 0, 1, 1, 1, 0]; // black key after these whites
    for (const side of [-1, 1]) {
      const x = side * (this.halfWidth + 0.62);
      for (let k = 0; k < length; k++) {
        const z = -k + offset - 3;
        if (z > 3 || n + 2 > curbs.instanceMatrix.count) continue;
        m.position.set(x, -0.12, z);
        m.rotation.set(0, 0, 0);
        m.scale.set(1, 1, 0.94);
        m.updateMatrix();
        curbs.setMatrixAt(n, m.matrix);
        curbs.setColorAt(n++, this.color.set("#fff8ea"));
        const idx = ((k % 7) + 7) % 7;
        if (pattern[idx]) {
          m.position.set(x, 0.08, z - 0.5);
          m.scale.set(0.62, 1.05, 0.5);
          m.updateMatrix();
          curbs.setMatrixAt(n, m.matrix);
          curbs.setColorAt(n++, this.color.set("#1b1733"));
        }
      }
    }
    curbs.count = n;
    curbs.instanceMatrix.needsUpdate = true;
    if (curbs.instanceColor) curbs.instanceColor.needsUpdate = true;

    // Arches every 4 bars; lamps every bar.
    const beatLen = chart.beats.length > 1 ? chart.beats[1] - chart.beats[0] : 0.5;
    const archEvery = beatLen * 4 > 2.4 ? 2 : 4;
    let a = 0;
    for (let i = 0; i < chart.bars.length && a < this.arches.length; i += archEvery) {
      const z = -(chart.bars[i] - t) * ups;
      if (z > 12 || z < -260) continue;
      const arch = this.arches[a++];
      arch.visible = true;
      arch.position.set(0, 0, z);
      const phase = ((t - chart.bars[i]) / beatLen) * Math.PI;
      arch.traverse((o) => {
        if (o.name.startsWith("BarArch_Pendulum")) o.rotation.y = Math.sin(phase) * 0.45;
      });
    }
    for (; a < this.arches.length; a++) this.arches[a].visible = false;
    let l = 0;
    for (let i = 0; i < chart.bars.length && l + 1 < this.lamps.length; i++) {
      const z = -(chart.bars[i] - t) * ups;
      if (z > 8 || z < -200) continue;
      for (const side of [-1, 1]) {
        const lamp = this.lamps[l++];
        lamp.visible = true;
        lamp.position.set(side * (this.halfWidth + 1.3), -0.1, z);
        lamp.rotation.y = side > 0 ? Math.PI : 0;
      }
    }
    for (; l < this.lamps.length; l++) this.lamps[l].visible = false;
  }

  dispose() {
    // Kit clones share geometry with the loaded GLB; only free what this stage built.
    const shared = new Set<THREE.BufferGeometry>();
    const sharedMats = new Set<THREE.Material>();
    for (const root of this.stageKit.values())
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        shared.add(mesh.geometry);
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) sharedMats.add(m);
      });
    const freed = new Set<THREE.Material>();
    this.content.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
      if (!shared.has(mesh.geometry)) mesh.geometry.dispose();
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (sharedMats.has(m) || freed.has(m)) continue;
        freed.add(m);
        (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      }
    });
    this.labels = []; // freed with the rest of the content above
    this.content.clear();
    this.keys = [];
    this.keyByLane.clear();
    this.arches = [];
    this.lamps = [];
    this.beams = [];
  }
}
