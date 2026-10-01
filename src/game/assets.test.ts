import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FISH_SPECIES, THEME_FISH } from "./render/shoals";
import { THEMES } from "./render/themes";

// Runtime contracts from art/encore/CONTRACTS.md: names the game looks up, and byte budgets.
type Gltf = {
  scenes: { nodes: number[] }[];
  nodes: { name?: string; mesh?: number; children?: number[]; rotation?: number[] }[];
  meshes: { primitives: { material?: number; attributes: Record<string, number> }[] }[];
  materials: { name?: string }[];
  images?: unknown[];
};

function read(file: string) {
  const data = readFileSync(`public/models/${file}`);
  const length = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + length).toString("utf8")) as Gltf;
  const roots = new Map<string, number>();
  for (const i of json.scenes[0].nodes) roots.set(json.nodes[i].name ?? "", i);
  const descendants = (i: number): number[] => [i, ...(json.nodes[i].children ?? []).flatMap(descendants)];
  const namesUnder = (root: string) => descendants(roots.get(root)!).map((i) => json.nodes[i].name ?? "");
  const materialsUnder = (root: string) =>
    new Set(
      descendants(roots.get(root)!).flatMap((i) => {
        const mesh = json.nodes[i].mesh;
        return mesh === undefined ? [] : json.meshes[mesh].primitives.map((p) => json.materials[p.material ?? 0]?.name ?? "");
      }),
    );
  return { json, bytes: data.length, roots, namesUnder, materialsUnder };
}

describe("asset contracts", () => {
  it("stage kit has every piece the stage builds", () => {
    const kit = read("stage-kit.glb");
    expect(kit.bytes).toBeLessThanOrEqual(450_000);
    for (const root of ["LanePad", "WhiteKey", "BlackKey", "Keybed_Mid", "Keybed_Left", "Keybed_Right", "NoteGem", "GoldGem", "HoldCap", "HoldBody", "CurbBlock", "BarArch", "RoadLamp"])
      expect(kit.roots.has(root), root).toBe(true);
    expect([...kit.materialsUnder("LanePad")]).toEqual(expect.arrayContaining(["Pad Ivory", "Pad Glow"]));
    expect(kit.materialsUnder("Keybed_Mid").has("Cabinet Lacquer")).toBe(true);
    expect(kit.materialsUnder("BarArch").has("Arch Paint")).toBe(true);
    expect(kit.namesUnder("BarArch")).toEqual(expect.arrayContaining(["BarArch_PendulumL", "BarArch_PendulumR"]));
  });

  it("world kit has every prop the themes and map ask for", () => {
    const kit = read("world-kit.glb");
    expect(kit.bytes).toBeLessThanOrEqual(2_600_000);
    expect(kit.json.images ?? []).toHaveLength(0);
    const needed = new Set(["Island_Base", "Cloud_Puff", "Beacon", "Crystal_Stillnote"]);
    for (const theme of Object.values(THEMES)) for (const name of [...theme.landmark, ...theme.props, ...theme.houses]) needed.add(name);
    for (const name of needed) expect(kit.roots.has(name), name).toBe(true);
    expect(kit.namesUnder("Beacon")).toContain("Beacon_Spin");
    expect(kit.namesUnder("Windmill")).toContain("Windmill_Blades");
    expect(kit.namesUnder("FerrisWheel")).toContain("Ferris_Wheel");
    expect(kit.namesUnder("Carillon_Tower")).toContain("Carillon_Bell");
    expect(kit.materialsUnder("Island_Base").has("Island Top")).toBe(true);
    expect(kit.materialsUnder("Beacon").has("Beacon Light")).toBe(true);
  });

  it("characters have the rig pivots the animation drives", () => {
    const kit = read("characters.glb");
    expect(kit.bytes).toBeLessThanOrEqual(1_300_000);
    expect(kit.namesUnder("Coda")).toEqual(expect.arrayContaining(["Coda_Body", "Coda_WingL", "Coda_WingR", "Coda_Flag", "Coda_EyeL", "Coda_EyeR"]));
    expect(kit.namesUnder("Hush")).toEqual(expect.arrayContaining(["Hush_Body", "Hush_EyeL", "Hush_EyeR", "Hush_Cap"]));
    expect(kit.namesUnder("Encore_Ship")).toEqual(expect.arrayContaining(["Ship_Lid", "Ship_PropL", "Ship_PropR", "Ship_Balloon"]));
    expect(kit.materialsUnder("Encore_Ship").has("Ship Lacquer")).toBe(true);
    // Pivots rest unrotated so runtime rotations are absolute.
    for (const root of ["Coda", "Hush", "Encore_Ship"])
      for (const i of kit.namesUnder(root).map((n) => kit.json.nodes.findIndex((node) => node.name === n))) {
        const r = kit.json.nodes[i].rotation;
        if (r && /^(Coda|Hush|Ship)_(Wing[LR]|Eye[LR]|Flag|Body|Cap|Lid|Prop[LR]|Balloon)$/.test(kit.json.nodes[i].name ?? ""))
          expect(Math.abs(r[3]), kit.json.nodes[i].name).toBeCloseTo(1, 5);
      }
  });

  it("fish kit has every species the seas ask for, each tiny enough to instance", () => {
    const kit = read("fish-kit.glb");
    expect(kit.bytes).toBeLessThanOrEqual(160_000);
    expect(kit.json.images ?? []).toHaveLength(0);
    const needed = new Set(Object.values(THEME_FISH).flat());
    for (const theme of Object.keys(THEMES)) expect(THEME_FISH[theme as keyof typeof THEME_FISH]?.length, theme).toBeGreaterThan(0);
    for (const name of [...FISH_SPECIES, ...needed]) expect(kit.roots.has(name), name).toBe(true);
    const accessors = (kit.json as unknown as { accessors: { count: number }[] }).accessors;
    for (const name of FISH_SPECIES) {
      // A few hundred triangles each: the whole sea of fish is one or two draw calls.
      const tris = [...kit.namesUnder(name)]
        .map((n) => kit.json.nodes.find((node) => node.name === n)!)
        .flatMap((node) => (node.mesh === undefined ? [] : kit.json.meshes[node.mesh].primitives))
        .reduce((sum, prim) => sum + accessors[(prim as unknown as { indices: number }).indices].count / 3, 0);
      expect(tris, name).toBeGreaterThan(100);
      expect(tris, name).toBeLessThanOrEqual(450);
    }
    expect([...kit.materialsUnder("Fish_Neon")].some((m) => /Glow/.test(m))).toBe(true);
    expect([...kit.materialsUnder("Fish_Moon")].some((m) => /Glow/.test(m))).toBe(true);
  });

  it("ships every dialogue portrait", () => {
    for (const name of ["coda-happy", "coda-wow", "coda-determined", "hush-sleepy", "hush-sad", "hush-smile"]) {
      const png = readFileSync(`public/art/portraits/${name}.png`);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.length).toBeLessThan(250_000);
    }
  });
});
