// The Sky Isles world map (also the title backdrop): nine islands on a golden
// sea joined by a five-line musical-staff trail, the Encore airship with Coda,
// Hush fog over locked islands, and a camera that orbits, pans and swoops.
import * as THREE from "three";
import { islands, type Island } from "../campaign";
import { applyHush, hushUniforms, materialsOf, ownAllMaterials, spawn, type HushUniforms, type Kit } from "./assets";
import { Coda, Hush, Ship } from "./characters";
import { Environment } from "./env";
import { Particles } from "./fx";
import { THEMES, type Theme } from "./themes";
import { animatePivots, dressMaterials, ON_WATER, pivotsOf, SEA_LEVEL, type Pivots } from "./world";

const SCALE = 2.1; // campaign map units -> world units

const MAP_THEME: Theme = {
  ...THEMES.festival,
  id: "festival",
  sky: { zenith: "#1f63ff", horizon: "#ffc27a", glow: "#fff2c0", sun: [0.5, 0.22, -0.8], stars: 0, moon: 0 },
  fog: { color: "#ffd59a", near: 320, far: 1300 },
  water: { deep: "#0754c8", shallow: "#18c2ee", foam: "#f4fbff" },
  light: { sun: "#ffe0b0", sunIntensity: 2.7, hemiSky: "#ffe6c8", hemiGround: "#4a6aa0", hemi: 1.15 },
};

type IslandView = {
  island: Island;
  root: THREE.Group;
  hush: HushUniforms;
  fog: THREE.Object3D[];
  crystal?: THREE.Object3D;
  pivots: Pivots;
  proxy: THREE.Mesh;
  state: "locked" | "open" | "restored";
  sat: number;
};

export class MapScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 3000);
  readonly env: Environment;
  views: IslandView[] = [];
  ship?: Ship;
  coda?: Coda;
  hush?: Hush;
  private staff = new THREE.Group();
  private curve?: THREE.CatmullRomCurve3;
  private shipAt = 0; // curve parameter
  private shipTarget = 0;
  private focus = new THREE.Vector3();
  private focusTarget = new THREE.Vector3();
  private distance = 118;
  private yaw = 0;
  private pitch = THREE.MathUtils.degToRad(48);
  mode: "title" | "map" = "title";
  private tmpSide = new THREE.Vector3();
  readonly particles = new Particles(1800, 1);
  private shows: { x: number; z: number; until: number; next: number }[] = [];
  private titleTime = 0;
  private dragging?: { x: number; y: number; fx: number; fz: number; moved: number };

  constructor(
    readonly worldKit?: Kit,
    readonly charKit?: Kit,
  ) {
    this.env = new Environment(this.scene);
    this.env.apply(MAP_THEME);
    this.scene.add(this.particles.points);
    this.build();
  }

  private build() {
    const kit = this.worldKit;
    for (const island of islands) {
      const theme = THEMES[island.theme];
      const root = new THREE.Group();
      const [x, z] = island.map;
      root.position.set(x * SCALE, 0, z * SCALE);
      const base = spawn(kit, "Island_Base");
      if (base) {
        base.scale.setScalar(1.05);
        root.add(base);
      }
      const place = (name: string, px: number, pz: number, s = 1, ry = 0) => {
        const prop = spawn(kit, name);
        if (!prop) return;
        prop.position.set(px, 0, pz);
        prop.scale.setScalar(s);
        prop.rotation.y = ry;
        root.add(prop);
      };
      place(theme.landmark[0], 0, -2, 1.05);
      if (theme.landmark[0] !== "Beacon") place("Beacon", -7, 3, 0.75);
      theme.houses.slice(0, 2).forEach((h, i) => place(h, 6 - i * 12, 5, 0.9, i * 1.4));
      theme.props
        .filter((p) => !ON_WATER.has(p))
        .slice(0, 4)
        .forEach((p, i) => place(p, -8 + i * 5, -7 + (i % 2) * 3, 0.9, i));
      // Boats and piers float at the island's shore.
      theme.props
        .filter((p) => ON_WATER.has(p))
        .slice(0, 1)
        .forEach((p) => {
          const prop = spawn(kit, p);
          if (!prop) return;
          prop.position.set(13, SEA_LEVEL, 6);
          prop.rotation.y = 0.6;
          root.add(prop);
        });
      const hush = hushUniforms();
      ownAllMaterials(root);
      dressMaterials(root, theme);
      applyHush(root, hush);
      const pivots = pivotsOf(root);
      // Hush fog: grey cloud puffs sitting over locked islands.
      const fog: THREE.Object3D[] = [];
      for (let i = 0; i < 3; i++) {
        const cloud = spawn(kit, "Cloud_Puff");
        if (!cloud) break;
        cloud.position.set((i - 1) * 7, 6 + i * 1.5, (i % 2) * 4 - 2);
        cloud.scale.setScalar(1.1 + i * 0.2);
        for (const m of materialsOf(cloud)) {
          const grey = m.clone();
          grey.color.set("#8a8fb0");
          cloud.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh && mesh.material === m) mesh.material = grey;
          });
        }
        root.add(cloud);
        fog.push(cloud);
      }
      const crystal = spawn(kit, "Crystal_Stillnote");
      if (crystal) {
        crystal.position.set(3, 0, 6);
        crystal.scale.setScalar(1.6);
        root.add(crystal);
      }
      const proxy = new THREE.Mesh(new THREE.SphereGeometry(15, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.y = 4;
      proxy.userData.island = island.id;
      root.add(proxy);
      this.scene.add(root);
      this.views.push({ island, root, hush, fog, crystal, pivots, proxy, state: "locked", sat: 0.2 });
    }
    // The staff trail through the islands in campaign order.
    const points = islands.map((i) => new THREE.Vector3(i.map[0] * SCALE, 1.2, i.map[1] * SCALE));
    this.curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    this.scene.add(this.staff);
    if (this.charKit) {
      this.ship = new Ship(this.charKit);
      this.coda = new Coda(this.charKit);
      this.hush = new Hush(this.charKit);
      this.ship.root.scale.setScalar(1.6);
      this.coda.root.scale.setScalar(2.2);
      this.hush.root.scale.setScalar(2.2);
      this.scene.add(this.ship.root, this.coda.root, this.hush.root);
    }
  }

  /** Recolour islands and the staff for the player's progress. */
  refresh(states: Record<string, "locked" | "open" | "restored">, current: string) {
    for (const v of this.views) v.state = states[v.island.id] ?? "locked";
    const reach = Math.max(0, ...this.views.map((v, i) => (v.state === "locked" ? 0 : i)));
    this.buildStaff(reach);
    const idx = Math.max(0, islands.findIndex((i) => i.id === current));
    this.shipTarget = idx / (islands.length - 1);
    if (this.mode === "title") this.shipAt = this.shipTarget;
    // The Hush lurks just beyond the furthest open island (until the crown is restored).
    const crownDone = states.crown === "restored";
    if (this.hush) {
      const next = this.views[Math.min(islands.length - 1, reach + 1)];
      this.hush.root.visible = !crownDone;
      this.hush.root.position.set(next.root.position.x + 14, 26, next.root.position.z - 18);
    }
  }

  private buildStaff(reach: number) {
    // Rebuilt on every map visit: free the old tubes and materials first.
    const freed = new Set<unknown>();
    this.staff.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const r of [mesh.geometry, ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material])])
        if (!freed.has(r)) {
          freed.add(r);
          r.dispose();
        }
    });
    this.staff.clear();
    if (!this.curve) return;
    const lit = new THREE.MeshStandardMaterial({ color: "#ffc53d", emissive: "#ff9d00", emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 });
    const dim = new THREE.MeshStandardMaterial({ color: "#8f96b3", roughness: 0.6, transparent: true, opacity: 0.55 });
    const split = reach / (islands.length - 1);
    for (let line = 0; line < 5; line++) {
      const offset = (line - 2) * 0.8;
      for (const [from, to, material] of [
        [0, split, lit],
        [split, 1, dim],
      ] as const) {
        if (to - from < 0.001) continue;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 120; i++) {
          const u = from + ((to - from) * i) / 120;
          const p = this.curve.getPointAt(u);
          const tangent = this.curve.getTangentAt(u);
          const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
          pts.push(p.add(side.multiplyScalar(offset)));
        }
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.16, 6), material);
        this.staff.add(tube);
      }
    }
    // Note heads dotted along the lit part of the staff.
    const head = new THREE.SphereGeometry(0.55, 16, 10);
    const colors = ["#ff4f4f", "#ff9416", "#ffd02a", "#5fd84a", "#2fb2ff", "#8f5bff"];
    const count = Math.floor(split * 60);
    for (let i = 1; i < count; i++) {
      const u = i / 60;
      const p = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const line = [-2, -1, 0, 1, 2][(i * 7) % 5];
      const note = new THREE.Mesh(
        head,
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.25, emissive: colors[i % colors.length], emissiveIntensity: 0.3 }),
      );
      note.scale.set(1.25, 0.7, 1);
      note.position.copy(p).add(side.multiplyScalar(line * 0.55 * 0.5 * 2));
      note.position.y += 0.2;
      this.staff.add(note);
    }
  }

  /** A few seconds of fireworks over a freshly restored island. */
  celebrate(id: string, seconds = 4) {
    const v = this.views.find((x) => x.island.id === id);
    if (!v) return;
    v.sat = 0.2; // drain first so the colour visibly floods back
    const now = performance.now() / 1000;
    this.shows.push({ x: v.root.position.x, z: v.root.position.z, until: now + seconds, next: now });
  }

  islandAt(ndc: THREE.Vector2): string | undefined {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.views.map((v) => v.proxy), false);
    return hits[0]?.object.userData.island as string | undefined;
  }

  /** Fly to an island. `panel` shifts the view so it sits left of a side panel. */
  select(id: string, panel = false) {
    const idx = islands.findIndex((i) => i.id === id);
    if (idx < 0) return;
    this.shipTarget = idx / (islands.length - 1);
    const v = this.views[idx];
    const shift = panel ? this.distance * 0.2 : 0;
    this.focusTarget.set(v.root.position.x + shift, 0, v.root.position.z + 4);
  }

  screenOf(id: string, width: number, height: number) {
    const v = this.views.find((x) => x.island.id === id);
    if (!v) return undefined;
    const p = v.root.position.clone();
    p.y += 17;
    p.project(this.camera);
    if (p.z > 1) return undefined;
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
  }

  // ------------------------------------------------------------ camera input

  pointerDown(x: number, y: number) {
    this.dragging = { x, y, fx: this.focusTarget.x, fz: this.focusTarget.z, moved: 0 };
  }

  pointerMove(x: number, y: number) {
    const d = this.dragging;
    if (!d) return;
    const k = this.distance / 700;
    const dx = (x - d.x) * k,
      dy = (y - d.y) * k;
    d.moved = Math.max(d.moved, Math.hypot(x - d.x, y - d.y));
    const cos = Math.cos(this.yaw),
      sin = Math.sin(this.yaw);
    this.focusTarget.set(
      THREE.MathUtils.clamp(d.fx - dx * cos - dy * sin, -140, 140),
      0,
      THREE.MathUtils.clamp(d.fz - dy * cos + dx * sin, -140, 140),
    );
  }

  /** Returns true when the pointer barely moved (a click, not a drag). */
  pointerUp() {
    const moved = this.dragging?.moved ?? 0;
    this.dragging = undefined;
    return moved < 8;
  }

  zoom(delta: number) {
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + delta * 0.001), 45, 190);
  }

  // ------------------------------------------------------------ frame

  update(dt: number, time: number) {
    // Island colour: locked islands drain grey under the Hush fog.
    for (const v of this.views) {
      const target = this.mode === "title" || v.state === "restored" ? 1 : v.state === "open" ? 0.62 : 0.12;
      v.sat += (target - v.sat) * Math.min(1, dt * 2);
      v.hush.uSat.value = v.sat;
      v.hush.uGlow.value = v.state === "restored" ? 1 : 0.2;
      for (const [i, f] of v.fog.entries()) {
        f.visible = v.state === "locked";
        f.position.x += Math.sin(time * 0.3 + i) * dt * 0.4;
      }
      if (v.crystal) {
        v.crystal.visible = v.state !== "restored";
        v.crystal.rotation.y += dt * 0.5;
      }
      v.root.position.y = Math.sin(time * 0.5 + v.root.position.x) * 0.4;
      animatePivots(v.pivots, time, dt, v.state === "restored" ? 1 : v.state === "open" ? 0.2 : 0);
    }
    // Ship glides along the staff to the selected island.
    this.shipAt += (this.shipTarget - this.shipAt) * Math.min(1, dt * 1.6);
    if (this.curve && this.ship) {
      const title = this.mode === "title";
      this.titleTime += dt;
      let p: THREE.Vector3, ahead: THREE.Vector3;
      if (title) {
        // A lazy circle over the archipelago for the title screen.
        const a = this.titleTime * 0.12;
        p = new THREE.Vector3(Math.cos(a) * 60, 22 + Math.sin(this.titleTime * 0.7) * 1.5, Math.sin(a) * 45);
        ahead = new THREE.Vector3(Math.cos(a + 0.05) * 60, p.y, Math.sin(a + 0.05) * 45);
      } else {
        p = this.curve.getPointAt(THREE.MathUtils.clamp(this.shipAt, 0, 1));
        const u2 = THREE.MathUtils.clamp(this.shipAt + (this.shipTarget >= this.shipAt ? 0.01 : -0.01), 0, 1);
        ahead = this.curve.getPointAt(u2);
        // Moor beside the island (not on top of its landmark) once it arrives.
        const moored = 1 - Math.min(1, Math.abs(this.shipTarget - this.shipAt) * 40);
        const side = new THREE.Vector3(ahead.z - p.z, 0, p.x - ahead.x).normalize();
        if (Number.isFinite(side.x)) p.add(side.multiplyScalar(15 * moored));
        p.y = 13 + Math.sin(time * 1.2) * 0.6;
        ahead.add(new THREE.Vector3().subVectors(p, this.curve.getPointAt(THREE.MathUtils.clamp(this.shipAt, 0, 1))).setY(0));
        ahead.y = p.y;
      }
      this.ship.root.position.copy(p);
      if (ahead.distanceTo(p) > 0.01) {
        this.ship.root.lookAt(ahead);
      }
      this.ship.update(dt, time, title ? 1 : 0.4 + Math.min(1, Math.abs(this.shipTarget - this.shipAt) * 20));
      if (this.coda) {
        const side = this.tmpSide.set(1, 0, 0).applyQuaternion(this.ship.root.quaternion);
        this.coda.root.position.copy(p).addScaledVector(side, 6);
        this.coda.root.position.y += 2 + Math.sin(time * 2.3) * 0.8;
        this.coda.root.quaternion.copy(this.ship.root.quaternion);
        this.coda.update(dt, time, 0, 0.5);
      }
    }
    this.hush?.update(time, 0.6);
    // Camera.
    if (this.mode === "title") {
      const a = this.titleTime * 0.05;
      this.camera.position.set(Math.cos(a) * 150, 46, Math.sin(a) * 150 + 20);
      this.camera.lookAt(0, 22, 0);
    } else {
      this.focus.lerp(this.focusTarget, Math.min(1, dt * 3));
      const pos = new THREE.Vector3(
        this.focus.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
        this.focus.y + Math.sin(this.pitch) * this.distance,
        this.focus.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
      );
      this.camera.position.lerp(pos, Math.min(1, dt * 4));
      this.camera.lookAt(this.focus);
    }
    const colors = [new THREE.Color("#ff4f4f"), new THREE.Color("#ffd02a"), new THREE.Color("#5fd84a"), new THREE.Color("#2fb2ff"), new THREE.Color("#8f5bff")];
    this.shows = this.shows.filter((show) => show.until > time);
    for (const show of this.shows)
      if (time >= show.next) {
        show.next = time + 0.35 + Math.random() * 0.3;
        this.particles.firework(show.x + (Math.random() - 0.5) * 20, 22 + Math.random() * 10, show.z + (Math.random() - 0.5) * 14, colors, 80);
      }
    this.particles.update(dt);
    this.env.update(time, time * 2, 1);
    this.env.follow(this.camera);
  }

  enterMap(focusId: string) {
    this.mode = "map";
    this.select(focusId);
    this.focus.copy(this.focusTarget);
    this.shipAt = this.shipTarget;
  }
}
