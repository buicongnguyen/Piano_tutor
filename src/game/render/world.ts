// World dressing for a stage: floating islets drifting past the Piano Road,
// the destination island (beacon + landmark) growing on the horizon, clouds,
// and the Hush colour drain that the player's harmony washes away.
import * as THREE from "three";
import { applyHush, hushUniforms, materialsOf, ownAllMaterials, spawn, type Kit } from "./assets";
import { bakeStatic, disposeBaked, type BakeMaterials } from "./bake";
import { createFlock, type FlyerKind } from "./flock";
import { ShoreFoam, waterlineRadius, type Waterline } from "./foam";
import { Hush } from "./characters";
import { Environment } from "./env";
import { Shoals } from "./shoals";
import type { Theme } from "./themes";

export type Pivots = { spin: THREE.Object3D[]; wheels: THREE.Object3D[]; blades: THREE.Object3D[]; bells: THREE.Object3D[] };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Collect animated pivots by their contract names. */
export function pivotsOf(root: THREE.Object3D, into: Pivots = { spin: [], wheels: [], blades: [], bells: [] }) {
  root.traverse((o) => {
    if (o.name.startsWith("Beacon_Spin")) into.spin.push(o);
    else if (o.name.startsWith("Ferris_Wheel")) into.wheels.push(o);
    else if (o.name.startsWith("Windmill_Blades")) into.blades.push(o);
    else if (o.name.startsWith("Carillon_Bell")) into.bells.push(o);
  });
  return into;
}

export function animatePivots(p: Pivots, time: number, dt: number, energy: number) {
  for (const o of p.spin) o.rotation.y += dt * (0.4 + energy * 1.6);
  for (const o of p.wheels) o.rotation.z += dt * (0.12 + energy * 0.25);
  for (const o of p.blades) o.rotation.z += dt * (0.5 + energy * 2.5);
  for (const o of p.bells) o.rotation.x = Math.sin(time * 3) * 0.25 * energy;
}

/** Tint foliage and island tops for a theme. Call on private materials (ownAllMaterials). */
export function dressMaterials(root: THREE.Object3D, theme: Theme) {
  for (const m of materialsOf(root)) {
    const tint =
      m.name === "Island Top" ? theme.islandTop : theme.foliage && /^Foliage|^Blossom/.test(m.name) ? theme.foliage : undefined;
    if (!tint || m.userData.tinted === tint) continue;
    m.userData.tinted = tint;
    m.color.set(tint);
    if (m.name.startsWith("Foliage Deep")) m.color.multiplyScalar(0.72);
  }
}

/** Props whose origin is the water line: they float on the sea, never on grass. */
export const ON_WATER = new Set(["Boat_Sail", "Pier"]);
export const SEA_LEVEL = -3.2;

type Islet = { root: THREE.Object3D; x: number; y: number; z: number; phase: number; spin: number; foam?: number; water?: Waterline };

export class World {
  readonly group = new THREE.Group();
  readonly env: Environment;
  readonly hush = hushUniforms();
  theme?: Theme;
  private islets: Islet[] = [];
  private clouds: { x: number; y: number; z: number; scale: number; speed: number }[] = [];
  private cloudMesh?: THREE.InstancedMesh;
  private readonly cloudMatrix = new THREE.Matrix4();
  private bakeMaterials: BakeMaterials = new Map();
  // The instanced clouds get their own material: sharing one between instanced and
  // plain meshes makes three switch shader programs back and forth every frame.
  private cloudMaterials: BakeMaterials = new Map();
  private bakedMeshes: THREE.Mesh[] = [];
  /** Real point light at the beacon: only on high quality (phones fake it with emissive glow). */
  private beaconLightOn = true;
  private destination?: THREE.Group;
  private pivots: Pivots = { spin: [], wheels: [], blades: [], bells: [] };
  private beaconLight?: THREE.PointLight;
  private copies = new Map<THREE.Material, THREE.Material>();
  private colour = 0.4;
  drift = 0;
  private isletSpan = 12 * 26;

  private hushChar?: Hush;
  private hushAway = 0;
  /** Fish schools in the sea beside the road (drawn instanced; see shoals.ts). */
  readonly shoals: Shoals;
  /** Foam where every islet's rock meets the sea: one instanced draw. */
  readonly foam = new ShoreFoam(32, { width: 1.8 });
  private destFoam = -1;
  /**
   * A flock circling over the sea beside the road ahead: one draw, motion on the GPU.
   * Anchored in course space: it drifts toward the camera with the world and wraps to
   * the far end, on the other side of the road (birds by the far destination were specks).
   */
  private flock?: ReturnType<typeof createFlock>;
  private flockAt = { x: 0, z: -120, side: 1 };
  private roadHalf = 6;

  constructor(
    readonly scene: THREE.Scene,
    readonly kit?: Kit,
    charKit?: Kit,
    fishKit?: Kit,
  ) {
    this.env = new Environment(scene);
    scene.add(this.group);
    this.shoals = new Shoals(fishKit, this.hush);
    scene.add(this.shoals.group, this.foam.mesh);
    if (charKit) {
      // The Hush broods over the destination until the music drives it off.
      this.hushChar = new Hush(charKit);
      this.hushChar.root.scale.setScalar(5.5);
      this.hushChar.root.visible = false;
      applyHush(ownAllMaterials(this.hushChar.root), this.hush);
      scene.add(this.hushChar.root);
    }
  }

  build(theme: Theme, seed: number, roadHalfWidth: number, density = 1, quiet = false) {
    this.clear();
    this.theme = theme;
    this.env.apply(theme);
    this.shoals.build(theme, seed, roadHalfWidth, density);
    const kit = this.kit;
    if (!kit) return;
    const random = rng(seed);
    const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
    // Private materials for this stage's world (the map keeps its own per island).
    const dress = (root: THREE.Object3D) => {
      ownAllMaterials(root, this.copies);
      dressMaterials(root, theme);
      applyHush(root, this.hush);
      pivotsOf(root, this.pivots);
      return root;
    };
    // Islets on both sides of the road, recycled as they drift past.
    const isletCount = density < 0.6 ? 6 : density < 0.9 ? 9 : 12;
    this.isletSpan = isletCount * 26;
    for (let i = 0; i < isletCount; i++) {
      const side = i % 2 ? 1 : -1;
      const root = new THREE.Group();
      const base = spawn(kit, "Island_Base");
      const s = 0.42 + random() * 0.38;
      if (base) {
        base.scale.setScalar(s);
        root.add(base);
      }
      const props = 2 + Math.floor(random() * 4);
      const landProps = theme.props.filter((n) => !ON_WATER.has(n));
      for (let k = 0; k < props; k++) {
        const name = k === 0 && random() < 0.7 ? pick(theme.houses) : pick(landProps.length ? landProps : theme.props);
        const prop = spawn(kit, name);
        if (!prop) continue;
        const a = random() * Math.PI * 2,
          r = random() * 6.5 * s;
        prop.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        prop.rotation.y = random() * Math.PI * 2;
        prop.scale.setScalar(0.85 + random() * 0.3);
        root.add(prop);
      }
      dress(root);
      // A cushion of cloud under some islets, as in the key art.
      if (random() < 0.6) {
        const puff = spawn(kit, "Cloud_Puff");
        if (puff) {
          puff.position.set((random() - 0.5) * 4 * s, -7 * s - 1, (random() - 0.5) * 3 * s);
          puff.scale.setScalar(1.1 * s + 0.4);
          applyHush(ownAllMaterials(puff, this.copies), this.hush);
          root.add(puff);
        }
      }
      // Height first: the foam ring needs the base's waterline at that depth (before baking).
      const x = side * (roadHalfWidth + 17 + random() * 28),
        y = -2.1 + random() * 4.2; // island tops stay above the sea (-3.2)
      const water = base ? waterlineRadius(base, SEA_LEVEL - y) : undefined;
      this.bake(root);
      const islet: Islet = {
        root,
        x,
        y,
        water,
        z: -20 - i * 26 - random() * 10,
        phase: random() * 10,
        spin: (random() - 0.5) * 0.05,
      };
      root.position.set(islet.x, islet.y, islet.z);
      root.rotation.y = random() * Math.PI * 2;
      this.islets.push(islet);
      this.group.add(root);
    }
    // Boats and piers bob on the sea between the islets.
    const waterProps = theme.props.filter((n) => ON_WATER.has(n));
    if (waterProps.length)
      for (let i = 0; i < Math.round(6 * Math.max(0.5, density)); i++) {
        const prop = spawn(kit, pick(waterProps));
        if (!prop) continue;
        const side = i % 2 ? 1 : -1;
        const holder = new THREE.Group();
        holder.add(prop);
        prop.rotation.y = random() * Math.PI * 2;
        dress(holder);
        const water = waterlineRadius(prop, 0); // a hull at the water line: a little wake
        this.bake(holder);
        const islet: Islet = {
          root: holder,
          x: side * (roadHalfWidth + 7 + random() * 22),
          y: SEA_LEVEL,
          water,
          z: -30 - i * (this.isletSpan / 6) - random() * 12,
          phase: random() * 10,
          spin: (random() - 0.5) * 0.02,
        };
        holder.position.set(islet.x, islet.y, islet.z);
        this.islets.push(islet);
        this.group.add(holder);
      }
    // Destination: a big island with the landmark and the beacon.
    const dest = new THREE.Group();
    const base = spawn(kit, "Island_Base");
    if (base) {
      base.scale.set(2.6, 1.6, 2.2);
      dest.add(base);
    }
    theme.landmark.forEach((name, i) => {
      const prop = spawn(kit, name);
      if (!prop) return;
      const x = i === 0 ? 0 : (i % 2 ? 1 : -1) * 16;
      prop.position.set(x, 0, i === 0 ? -4 : 6);
      prop.scale.setScalar(i === 0 ? 1.7 : 1.3);
      dest.add(prop);
    });
    if (!theme.landmark.includes("Beacon")) {
      const beacon = spawn(kit, "Beacon");
      if (beacon) {
        beacon.position.set(-18, 0, -10);
        beacon.scale.setScalar(1.2);
        dest.add(beacon);
      }
    }
    const extras = Math.round(16 * Math.max(0.5, density));
    const destProps = theme.props.filter((n) => !ON_WATER.has(n));
    for (let k = 0; k < extras; k++) {
      const name = k < 6 ? pick(theme.houses) : pick(destProps.length ? destProps : theme.houses);
      const prop = spawn(kit, name);
      if (!prop) continue;
      const a = (k / extras) * Math.PI * 2 + random() * 0.3,
        r = 12 + random() * 12;
      prop.position.set(Math.cos(a) * r * 1.6, 0, Math.sin(a) * r);
      prop.rotation.y = -a + Math.PI / 2 + (random() - 0.5);
      prop.scale.setScalar(1 + random() * 0.4);
      dest.add(prop);
    }
    dress(dest);
    const destWater = base ? waterlineRadius(base, SEA_LEVEL + 4) : undefined; // placed at y = -4 in update()
    this.bake(dest);
    this.beaconLightOn = density >= 0.9;
    if (this.beaconLightOn) {
      this.beaconLight = new THREE.PointLight(theme.night ? "#ffd27a" : "#fff0c0", 0, 160, 1.5);
      this.beaconLight.position.set(0, 30, 0);
      dest.add(this.beaconLight);
    }
    this.destination = dest;
    this.group.add(dest);
    // Clouds: one baked puff drawn as ONE instanced mesh (it was a mesh per cloud).
    const cloud = spawn(kit, "Cloud_Puff");
    if (cloud) {
      ownAllMaterials(cloud, this.copies);
      if (theme.night) for (const m of materialsOf(cloud)) m.color.multiplyScalar(0.35);
      const baked = bakeStatic(cloud, [], this.cloudMaterials).meshes;
      if (baked.length === 1) {
        const mesh = new THREE.InstancedMesh(baked[0].geometry, baked[0].material, 9);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false; // nine clouds spread over the whole sky
        mesh.name = "clouds";
        applyHush(mesh, this.hush);
        this.bakedMeshes.push(baked[0]);
        for (let i = 0; i < 9; i++)
          this.clouds.push({
            x: (random() - 0.5) * 260,
            y: 26 + random() * 36,
            z: -60 - random() * 260,
            scale: 1.2 + random() * 2.2,
            speed: 0.6 + random() * 1.2,
          });
        this.cloudMesh = mesh;
        this.group.add(mesh);
        this.placeClouds();
      }
    }
    // Foam where each islet (and boat) meets the sea, and around the destination's shore.
    this.foam.uniforms.uColor.value.set(theme.water.foam);
    this.foam.uniforms.uOpacity.value = theme.night ? 0.55 : 0.9;
    let rings = 0;
    for (const i of this.islets) {
      if (!i.water || Math.min(i.water.rx, i.water.rz) < 0.4) continue;
      i.foam = rings;
      this.foam.set(rings++, i.x, SEA_LEVEL, i.z, { rx: i.water.rx * 1.02, rz: i.water.rz * 1.02 });
    }
    if (this.destination && destWater && Math.min(destWater.rx, destWater.rz) > 1) {
      this.destFoam = rings;
      this.foam.set(rings++, 0, SEA_LEVEL, -270, { rx: destWater.rx * 1.02, rz: destWater.rz * 1.02 });
    }
    // Birds over the sea beside the road. Snowy skies are bright, so dark swallows read
    // there; elsewhere white gulls read against the sea (moonlit at night: bats vanished).
    const kind: FlyerKind = theme.id === "snow" || theme.id === "winter" ? "swallow" : "gull";
    this.roadHalf = roadHalfWidth;
    this.flockAt = { x: roadHalfWidth + 26, z: -110, side: 1 };
    this.flock = createFlock(kind, {
      count: Math.round(12 * Math.max(0.5, density)),
      center: new THREE.Vector3(this.flockAt.x, SEA_LEVEL, this.flockAt.z),
      radius: [8, 20],
      height: [9, 20],
      size: kind === "gull" ? 2.2 : 1.8,
      colors: theme.night && kind === "gull" ? ["#dfe6ff", "#c9d3f5"] : undefined,
      seed,
      quiet,
    });
    this.group.add(this.flock.mesh);
  }

  /** progress 0..1 through the song, harmony 0..1, beat 0..1 pulse. */
  update(dt: number, time: number, progress: number, harmony: number, beat: number, roadSpeed: number, encore: number) {
    const target = Math.min(1, 0.35 + 0.65 * Math.min(1, harmony * (0.75 + 0.6 * progress)) + encore * 0.4);
    this.colour += (target - this.colour) * Math.min(1, dt * 1.5);
    this.hush.uSat.value = this.colour;
    this.hush.uGlow.value = 0.25 + 0.75 * Math.min(1, harmony * 0.8 + progress * 0.4 + encore);
    this.drift += roadSpeed * 0.3 * dt;
    this.env.update(time, this.drift * 3, this.colour);
    this.shoals.update(dt, time, roadSpeed * 0.3, harmony, encore);
    this.foam.update(time);
    if (this.flock) {
      const f = this.flockAt;
      f.z += roadSpeed * 0.3 * dt;
      if (f.z > 30) {
        f.z = -170;
        f.side = -f.side;
        f.x = f.side * (this.roadHalf + 22 + ((time * 7.3) % 1) * 10);
      }
      this.flock.uniforms.uCenter.value.set(f.x, SEA_LEVEL, f.z);
      this.flock.update(time);
    }
    for (const i of this.islets) {
      i.z += roadSpeed * 0.3 * dt;
      if (i.z > 40) i.z -= this.isletSpan;
      if (i.foam !== undefined) this.foam.move(i.foam, i.x, SEA_LEVEL, i.z);
      i.root.position.set(i.x, i.y + Math.sin(time * 0.6 + i.phase) * 0.35 + beat * 0.12, i.z);
      i.root.rotation.y += i.spin * dt;
      const s = i.root.userData.baseScale ?? 1;
      i.root.scale.set(s, s * (1 + beat * 0.03), s);
    }
    if (this.destination) {
      const z = -(270 - 120 * progress);
      this.destination.position.set(0, -4 + Math.sin(time * 0.4) * 0.4, z);
      this.destination.rotation.y = 0;
      if (this.destFoam >= 0) this.foam.move(this.destFoam, 0, SEA_LEVEL, z);

    }
    if (this.beaconLight) this.beaconLight.intensity = (this.theme?.night ? 2400 : 900) * this.hush.uGlow.value * (0.8 + beat * 0.4);
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > 150) c.x = -150;
    }
    this.placeClouds();
    animatePivots(this.pivots, time, dt, 0.4 + harmony + encore);
    if (this.hushChar) this.hushChar.root.visible = false;
    if (this.hushChar && this.destination) {
      // Rises and drifts away as colour returns; sleepier the better you play.
      this.hushAway += (Math.max(0, this.colour - 0.45) * 1.6 - this.hushAway) * Math.min(1, dt * 0.8);
      const away = Math.min(1, this.hushAway);
      const root = this.hushChar.root;
      root.position.set(
        22 + away * 60,
        38 + away * 34 + Math.sin(time * 0.5) * 1.2,
        this.destination.position.z - 30 - away * 60,
      );
      root.rotation.y = -0.5 + Math.sin(time * 0.2) * 0.1;
      root.visible = away < 0.98;
      this.hushChar.update(time, 0.2 + away * 0.8);
    }
  }

  /** Merge a dressed root's static parts into a few colour-baked draws (see bake.ts). */
  private bake(root: THREE.Object3D) {
    const p = pivotsOf(root);
    const { meshes } = bakeStatic(root, [...p.spin, ...p.wheels, ...p.blades, ...p.bells], this.bakeMaterials);
    applyHush(root, this.hush);
    this.bakedMeshes.push(...meshes);
  }

  private placeClouds() {
    const mesh = this.cloudMesh;
    if (!mesh) return;
    this.clouds.forEach((c, i) => {
      this.cloudMatrix.makeScale(c.scale, c.scale, c.scale).setPosition(c.x, c.y, c.z);
      mesh.setMatrixAt(i, this.cloudMatrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.hushAway = 0;
    this.shoals.clear();
    disposeBaked(this.bakedMeshes, this.bakeMaterials);
    disposeBaked([], this.cloudMaterials);
    this.bakedMeshes = [];
    this.cloudMesh?.dispose();
    this.cloudMesh = undefined;
    this.foam.mesh.count = 0;
    this.destFoam = -1;
    if (this.flock) {
      this.flock.mesh.geometry.dispose();
      (this.flock.mesh.material as THREE.Material).dispose();
      this.flock.mesh.dispose();
      this.flock = undefined;
    }
    this.beaconLight = undefined;
    for (const m of this.copies.values()) m.dispose(); // private copies from the last build
    this.copies = new Map();
    this.group.clear();
    this.islets = [];
    this.clouds = [];
    this.destination = undefined;
    this.pivots = { spin: [], wheels: [], blades: [], bells: [] };
    this.colour = 0.4;
  }
}
