// Prints a per-root breakdown of a GLB: triangles, meshes, materials and node names.
// Usage: node scripts/glb-report.mjs public/models/stage-kit.glb [--nodes]
import { readFileSync } from "node:fs";

export function readGlb(path) {
  const data = readFileSync(path);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  return { json, bytes: data.length };
}

export function rootReport(json) {
  const scene = json.scenes[json.scene ?? 0];
  const tris = (meshIndex) =>
    json.meshes[meshIndex].primitives.reduce((sum, p) => {
      const acc = json.accessors[p.indices ?? p.attributes.POSITION];
      return sum + Math.floor(acc.count / 3);
    }, 0);
  return scene.nodes.map((index) => {
    const out = { name: json.nodes[index].name, tris: 0, meshes: 0, materials: new Set(), nodes: [] };
    const walk = (i) => {
      const node = json.nodes[i];
      out.nodes.push(node.name);
      if (node.mesh !== undefined) {
        out.tris += tris(node.mesh);
        out.meshes++;
        for (const p of json.meshes[node.mesh].primitives)
          if (p.material !== undefined) out.materials.add(json.materials[p.material].name);
      }
      for (const c of node.children ?? []) walk(c);
    };
    walk(index);
    return { ...out, materials: [...out.materials] };
  });
}

if (process.argv[1]?.endsWith("glb-report.mjs")) {
  const [path, flag] = process.argv.slice(2);
  const { json, bytes } = readGlb(path);
  const roots = rootReport(json);
  console.log(`${path}: ${bytes} bytes, ${roots.length} roots, ${roots.reduce((s, r) => s + r.tris, 0)} tris`);
  for (const r of roots) {
    console.log(`  ${r.name.padEnd(22)} ${String(r.tris).padStart(6)} tris  ${r.meshes} meshes  [${r.materials.join(", ")}]`);
    if (flag === "--nodes") console.log(`      nodes: ${r.nodes.join(", ")}`);
  }
}
