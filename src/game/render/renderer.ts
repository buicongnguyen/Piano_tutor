// WebGL renderer with quality tiers, bloom, a colour-grade finishing pass and
// adaptive resolution. Adapted from the Lantern Picnic engine.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

export type QualityKey = "low" | "medium" | "high";
export const QUALITY: Record<QualityKey, { pixelRatio: number; msaa: number; bloom: boolean; post: boolean; particles: number; shadows: boolean }> = {
  low: { pixelRatio: 1, msaa: 0, bloom: false, post: false, particles: 0.45, shadows: false },
  medium: { pixelRatio: 1.25, msaa: 0, bloom: true, post: true, particles: 0.75, shadows: false },
  high: { pixelRatio: 1.75, msaa: 4, bloom: true, post: true, particles: 1, shadows: true },
};

export function autoQuality(gl?: WebGL2RenderingContext | null): QualityKey {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const renderer = gl ? String(gl.getParameter(gl.RENDERER) || "") : "";
  if (/swiftshader|llvmpipe|software/i.test(renderer)) return "low";
  if (coarse) return cores <= 4 ? "low" : "medium";
  return cores >= 8 ? "high" : "medium";
}

// Guards bloom against stray NaN/Inf pixels (which the blur would smear into
// black blocks) and caps extreme HDR values before they overflow half floats.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
      // Some compilers (D3D fast math) drop isnan; clamp still maps NaN/negatives into range there.
      gl_FragColor = vec4(clamp(c, vec3(0.0), vec3(24.0)), 1.0);
    }`,
};

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    saturation: { value: 1.08 },
    contrast: { value: 1.05 },
    vignette: { value: 0.28 },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color("#ffffff") },
    fade: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float saturation, contrast, vignette, flash, fade; uniform vec3 flashColor;
    varying vec2 vUv;
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      vec2 v = vUv - 0.5; v.x *= resolution.x / resolution.y;
      col *= 1.0 - vignette * smoothstep(0.4, 1.1, length(v));
      col = mix(col, flashColor, flash * (0.35 + 0.65 * smoothstep(0.2, 0.9, length(v))));
      col = mix(col, vec3(0.02, 0.02, 0.06), fade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  quality: QualityKey = "medium";
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
  private composer?: EffectComposer;
  bloom?: UnrealBloomPass;
  finish?: ShaderPass;
  private scale = 1;
  private frameTimes: number[] = [];
  width = 1;
  height = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: /[?&]capture/.test(location.search),
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = false;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.info.autoReset = false; // count every pass of a frame, not just the last
  }

  get gl() {
    return this.renderer.getContext() as WebGL2RenderingContext;
  }

  setQuality(key: QualityKey) {
    this.quality = key;
    this.scale = 1;
    this.renderer.shadowMap.enabled = QUALITY[key].shadows;
    this.build();
    this.resize(this.width, this.height);
  }

  /** Show another scene. The post chain is reused: only its render pass is re-pointed. */
  attach(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    if (this.renderPass) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
    } else this.build();
    this.resize(this.width, this.height);
  }

  private renderPass?: RenderPass;
  private bloomValues: [number, number, number] = [0.4, 0.5, 0.82];
  private gradeValues: [number, number, number] = [1.08, 1.05, 0.28];
  onViewport?: (height: number, pixelRatio: number) => void;

  private build() {
    // EffectComposer.dispose() leaves its passes (and bloom's 11 render targets) alive.
    for (const pass of this.composer?.passes ?? []) (pass as { dispose?: () => void }).dispose?.();
    this.composer?.dispose();
    this.composer = undefined;
    this.renderPass = undefined;
    this.bloom = undefined;
    this.finish = undefined;
    const q = QUALITY[this.quality];
    if (!q.post || !this.scene || !this.camera) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: q.msaa,
    });
    const composer = new EffectComposer(this.renderer, target);
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);
    composer.addPass(new ShaderPass(SanitizeShader));
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.4, 0.45, 1.0);
      composer.addPass(this.bloom);
    }
    composer.addPass(new OutputPass());
    this.finish = new ShaderPass(FinishShader);
    composer.addPass(this.finish);
    this.composer = composer;
    // A quality change must keep the current scene's look.
    this.setBloom(...this.bloomValues);
    this.setGrade(...this.gradeValues);
  }

  get pixelRatio() {
    return Math.min(devicePixelRatio || 1, QUALITY[this.quality].pixelRatio) * this.scale;
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    if (this.camera) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(this.width, this.height);
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.finish?.uniforms.resolution.value.set(size.x, size.y);
    }
    // Point sprites are sized in device pixels: tell particle systems (adaptive scale too).
    this.onViewport?.(this.height, this.pixelRatio);
  }

  /** Theme bloom. Thresholds sit above 1 so only lights and emissives glow, never sunlit ivory. */
  setBloom(strength: number, radius = 0.5, threshold = 0.82) {
    this.bloomValues = [strength, radius, threshold];
    if (!this.bloom) return;
    this.bloom.strength = strength * 0.7;
    this.bloom.radius = radius;
    this.bloom.threshold = Math.max(1.0, threshold + 0.3);
  }

  setGrade(saturation: number, contrast = 1.05, vignette = 0.28) {
    this.gradeValues = [saturation, contrast, vignette];
    const u = this.finish?.uniforms;
    if (!u) return;
    u.saturation.value = saturation;
    u.contrast.value = contrast;
    u.vignette.value = vignette;
  }

  flash(amount: number, color = "#ffffff") {
    const u = this.finish?.uniforms;
    if (!u) return;
    u.flash.value = amount;
    u.flashColor.value.set(color);
  }

  setFade(v: number) {
    if (this.finish) this.finish.uniforms.fade.value = v;
  }

  /** Lower internal resolution when frames run long; raise it again when there's headroom. */
  adapt(dt: number) {
    if (document.hidden) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    const before = this.scale;
    if (avg > 1 / 45 && this.scale > 0.6) this.scale = Math.max(0.6, this.scale - 0.1);
    else if (avg < 1 / 58 && this.scale < 1) this.scale = Math.min(1, this.scale + 0.05);
    if (before !== this.scale) this.resize(this.width, this.height);
  }

  render() {
    if (!this.scene || !this.camera) return;
    this.renderer.info.reset();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
