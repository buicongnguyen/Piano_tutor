// Sky dome, stylized sea and the light rig for a theme.
import * as THREE from "three";
import type { Theme } from "./themes";

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
  gl_Position = p.xyww;
}`;
const skyFragment = /* glsl */ `
uniform vec3 zenith, horizon, glow, sunDir;
uniform float stars, moon, time, hush;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5453), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5453);
  float c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5453), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = .5; for(int i=0;i<4;i++){ v += a*n2(p); p = p*2.07 + 3.1; a *= .5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(horizon, zenith, pow(smoothstep(-0.02, 0.75, h), 0.7));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += glow * (pow(s, 6.0) * 0.45 + pow(s, 64.0) * 0.8) * (1.0 - moon * 0.6);
  // Sun or moon disc.
  float disc = smoothstep(0.9975, 0.9985, s);
  col = mix(col, mix(vec3(1.0, 0.97, 0.88), vec3(0.93, 0.95, 1.0), moon), disc);
  // Stars twinkle above the horizon at night.
  if (stars > 0.0) {
    vec3 q = floor(d * 280.0);
    float st = step(0.9965, hash(q)) * smoothstep(0.05, 0.35, h);
    st *= 0.6 + 0.4 * sin(time * 2.0 + hash(q + 3.0) * 30.0);
    col += vec3(st) * stars;
  }
  // A soft band of painted clouds near the horizon.
  vec2 uv = d.xz / max(0.12, d.y + 0.18) * 1.6;
  float c = fbm(uv * 0.6 + vec2(time * 0.004, 0.0));
  float band = smoothstep(0.55, 0.78, c) * smoothstep(0.55, 0.06, h) * smoothstep(-0.05, 0.05, h);
  vec3 cloud = mix(horizon * 1.08 + 0.06, glow, 0.25 * (1.0 - moon));
  col = mix(col, cloud, band * 0.55);
  // Below the horizon fade to the fog colour so the sea edge melts in.
  col = mix(col, horizon * 0.9, smoothstep(0.0, -0.15, d.y));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l) * vec3(0.9, 0.93, 1.05), col, hush);
  gl_FragColor = vec4(col, 1.0);
}`;

const waterVertex = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const waterFragment = /* glsl */ `
uniform vec3 deep, shallow, foam, sky, sunDir, sunColor;
uniform float time, scroll, hush, night;
varying vec3 vWorld;
#include <fog_pars_fragment>
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5453), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5453);
  float c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5453), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5453);
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
void main(){
  vec2 p = vWorld.xz * 0.09 + vec2(0.0, scroll * 0.09);
  float w1 = n2(p * 1.3 + vec2(time * 0.21, time * 0.13));
  float w2 = n2(p * 2.7 - vec2(time * 0.17, -time * 0.19));
  float w = w1 * 0.6 + w2 * 0.4;
  vec3 n = normalize(vec3((w1 - 0.5) * 0.5, 1.0, (w2 - 0.5) * 0.5));
  vec3 view = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, view), 0.0), 4.0);
  float dist = length(cameraPosition.xz - vWorld.xz);
  vec3 col = mix(shallow, deep, smoothstep(0.2, 0.8, w) * 0.28 + smoothstep(20.0, 260.0, dist) * 0.55 + 0.1);
  col = mix(col, sky, fres * 0.5);
  // Toon wave lines: thin contours of the swell, like a painted sea.
  float band = abs(fract(w * 4.0 - time * 0.06) - 0.5);
  float px = fwidth(w * 4.0) * 1.2 + 0.015;
  float lineMask = 1.0 - smoothstep(0.0, px, band - 0.018);
  lineMask *= smoothstep(0.35, 0.6, w) * (1.0 - smoothstep(80.0, 420.0, dist));
  col = mix(col, foam, lineMask * (night > 0.5 ? 0.2 : 0.38));
  // Sun glints.
  vec3 h = normalize(normalize(sunDir) + view);
  float spec = pow(max(dot(n, h), 0.0), 220.0);
  float glint = step(0.93, n2(vWorld.xz * 1.7 + time * 0.8)) * spec * 6.0;
  col += sunColor * (spec * (night > 0.5 ? 0.7 : 1.1) + glint);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l) * vec3(0.9, 0.93, 1.05), col, hush);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

const calmWaterFragment = /* glsl */ `
uniform vec3 deep, shallow, sky;
uniform float hush;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main(){
  float dist = length(cameraPosition.xz - vWorld.xz);
  vec3 col = mix(shallow, deep, 0.24 + smoothstep(20.0, 260.0, dist) * 0.55);
  col = mix(col, sky, smoothstep(80.0, 420.0, dist) * 0.3);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l) * vec3(0.9, 0.93, 1.05), col, hush);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export class Environment {
  readonly group = new THREE.Group();
  readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly water: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly sun = new THREE.DirectionalLight();
  readonly hemi = new THREE.HemisphereLight();
  readonly fill = new THREE.DirectionalLight();
  theme?: Theme;

  constructor(readonly scene: THREE.Scene) {
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          zenith: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          glow: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3(0, 1, 0) },
          stars: { value: 0 },
          moon: { value: 0 },
          time: { value: 0 },
          hush: { value: 1 },
        },
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600, 1, 1),
      new THREE.ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: matchMedia("(pointer: coarse)").matches ? calmWaterFragment : waterFragment,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            deep: { value: new THREE.Color() },
            shallow: { value: new THREE.Color() },
            foam: { value: new THREE.Color() },
            sky: { value: new THREE.Color() },
            sunDir: { value: new THREE.Vector3(0, 1, 0) },
            sunColor: { value: new THREE.Color() },
            time: { value: 0 },
            scroll: { value: 0 },
            hush: { value: 1 },
            night: { value: 0 },
          },
        ]),
      }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -3.2;
    this.sun.position.set(-30, 60, 20);
    this.fill.intensity = 0.5;
    this.fill.position.set(40, 30, 40);
    this.group.add(this.sky, this.water, this.sun, this.sun.target, this.hemi, this.fill);
    scene.add(this.group);
    scene.fog = new THREE.Fog(0xffffff, 80, 400);
  }

  apply(theme: Theme) {
    this.theme = theme;
    const s = this.sky.material.uniforms;
    s.zenith.value.set(theme.sky.zenith);
    s.horizon.value.set(theme.sky.horizon);
    s.glow.value.set(theme.sky.glow);
    s.sunDir.value.set(...theme.sky.sun).normalize();
    s.stars.value = theme.sky.stars;
    s.moon.value = theme.sky.moon;
    const w = this.water.material.uniforms;
    w.deep.value.set(theme.water.deep);
    w.shallow.value.set(theme.water.shallow);
    w.foam.value.set(theme.water.foam);
    w.sky.value.set(theme.sky.horizon);
    w.sunDir.value.set(...theme.sky.sun).normalize();
    w.sunColor.value.set(theme.light.sun);
    w.night.value = theme.night ? 1 : 0;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(theme.fog.color);
    fog.near = theme.fog.near;
    fog.far = theme.fog.far;
    this.sun.color.set(theme.light.sun);
    this.sun.intensity = theme.light.sunIntensity;
    const dir = new THREE.Vector3(...theme.sky.sun).normalize();
    this.sun.position.copy(dir.multiplyScalar(80));
    this.sun.target.position.set(0, 0, -30);
    this.hemi.color.set(theme.light.hemiSky);
    this.hemi.groundColor.set(theme.light.hemiGround);
    this.hemi.intensity = theme.light.hemi;
    this.fill.color.set(theme.night ? "#6f86ff" : "#bfe0ff");
    this.fill.intensity = theme.night ? 0.6 : 0.55;
  }

  /** hush: 0 = drained grey, 1 = full colour. */
  update(time: number, scroll: number, hush: number) {
    this.sky.material.uniforms.time.value = time;
    this.sky.material.uniforms.hush.value = 0.35 + 0.65 * hush;
    const w = this.water.material.uniforms;
    w.time.value = time;
    w.scroll.value = scroll;
    w.hush.value = 0.3 + 0.7 * hush;
  }

  follow(camera: THREE.Camera) {
    this.sky.position.copy(camera.position);
  }
}
