// Character rigs from characters.glb: Coda the note-sprite, the Hush and the
// Encore airship. Pivots are the contract names in art/encore/CONTRACTS.md.
import * as THREE from "three";
import { spawn, type Kit } from "./assets";

const find = (root: THREE.Object3D, name: string) => {
  let hit: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!hit && o.name === name) hit = o;
  });
  return hit;
};

function blink(time: number, seed: number) {
  const cycle = (time + seed) % 3.7;
  return cycle < 0.12 ? 0.12 : 1;
}

export class Coda {
  readonly root: THREE.Object3D;
  private body?: THREE.Object3D;
  private wingL?: THREE.Object3D;
  private wingR?: THREE.Object3D;
  private flag?: THREE.Object3D;
  private eyes: THREE.Object3D[] = [];
  private cheer = 0;
  private hop = 0;

  constructor(kit: Kit) {
    this.root = spawn(kit, "Coda") ?? new THREE.Group();
    this.body = find(this.root, "Coda_Body");
    this.wingL = find(this.root, "Coda_WingL");
    this.wingR = find(this.root, "Coda_WingR");
    this.flag = find(this.root, "Coda_Flag");
    this.eyes = ["Coda_EyeL", "Coda_EyeR"].map((n) => find(this.root, n)).filter(Boolean) as THREE.Object3D[];
  }

  /** A happy flap-and-hop (combo milestones, results). */
  celebrate() {
    this.cheer = 1;
  }

  update(dt: number, time: number, beat: number, energy = 0.5) {
    this.cheer = Math.max(0, this.cheer - dt * 0.8);
    this.hop = Math.max(this.hop - dt * 6, beat * 0.5 * energy, this.cheer * Math.abs(Math.sin(time * 9)));
    const flap = Math.sin(time * (8 + this.cheer * 18)) * (0.25 + this.cheer * 0.6 + beat * 0.2);
    if (this.body) {
      this.body.position.y = this.hop * 0.18;
      this.body.scale.set(1 + beat * 0.05, 1 - beat * 0.06 + this.hop * 0.05, 1 + beat * 0.05);
      this.body.rotation.z = Math.sin(time * 1.3) * 0.06;
    }
    if (this.wingL) this.wingL.rotation.z = 0.2 + flap;
    if (this.wingR) this.wingR.rotation.z = -0.2 - flap;
    if (this.flag) this.flag.rotation.y = Math.sin(time * 5) * 0.25 + beat * 0.2;
    const b = blink(time, 0.3);
    for (const e of this.eyes) e.scale.y = b;
  }
}

export class Hush {
  readonly root: THREE.Object3D;
  private body?: THREE.Object3D;
  private eyes: THREE.Object3D[] = [];
  private cap?: THREE.Object3D;

  constructor(kit: Kit) {
    this.root = spawn(kit, "Hush") ?? new THREE.Group();
    this.body = find(this.root, "Hush_Body");
    this.cap = find(this.root, "Hush_Cap");
    this.eyes = ["Hush_EyeL", "Hush_EyeR"].map((n) => find(this.root, n)).filter(Boolean) as THREE.Object3D[];
  }

  /** sleepiness 0 (awake) .. 1 (asleep). */
  update(time: number, sleepiness = 0.4) {
    const breathe = Math.sin(time * 0.9);
    if (this.body) this.body.scale.set(1 + breathe * 0.025, 1 - breathe * 0.03, 1 + breathe * 0.025);
    if (this.cap) this.cap.rotation.z = Math.sin(time * 0.7) * 0.08;
    const open = Math.max(0.08, (1 - sleepiness) * 0.9) * (blink(time, 1.7) < 1 ? 0.3 : 1);
    for (const e of this.eyes) e.scale.y = open;
    this.root.position.y += Math.sin(time * 0.5) * 0.002;
  }
}

export class Ship {
  readonly root: THREE.Object3D;
  private props: THREE.Object3D[] = [];
  private lid?: THREE.Object3D;
  private balloon?: THREE.Object3D;

  constructor(kit: Kit) {
    this.root = spawn(kit, "Encore_Ship") ?? new THREE.Group();
    this.props = ["Ship_PropL", "Ship_PropR"].map((n) => find(this.root, n)).filter(Boolean) as THREE.Object3D[];
    this.lid = find(this.root, "Ship_Lid");
    this.balloon = find(this.root, "Ship_Balloon");
  }

  update(dt: number, time: number, speed = 1) {
    for (const p of this.props) p.rotation.z += dt * (10 + speed * 14);
    if (this.lid) this.lid.rotation.x = -0.05 + Math.sin(time * 1.1) * 0.03;
    if (this.balloon) this.balloon.position.y = Math.sin(time * 1.4) * 0.05;
    this.root.rotation.z = Math.sin(time * 0.8) * 0.04 * speed;
  }

  setLacquer(color: string) {
    this.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.name === "Ship Lacquer") m.color.set(color);
    });
  }
}
