// Locates a portable Blender 4.5 LTS and runs it with the given arguments.
// Usage: node scripts/blender.mjs <blender args...>   (node scripts/blender.mjs --where prints the path)
// Lookup order: $BLENDER_EXE, ./.tools (git-ignored), then sibling repositories' .tools copies, then PATH.
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exe = process.platform === "win32" ? "blender.exe" : "blender";
const folders = ["blender-4.5.9-windows-x64", "blender-4.5.3-windows-x64"];
const siblings = ["Game_simple", "world_of_toy", "3D_claudeopus55", "3d_astra"];

export function findBlender() {
  const candidates = [
    process.env.BLENDER_EXE,
    ...folders.map((f) => path.join(root, ".tools", f, exe)),
    ...siblings.flatMap((s) =>
      folders.map((f) => path.resolve(root, "..", s, ".tools", f, exe)),
    ),
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["blender"], {
    encoding: "utf8",
  });
  const found = which.status === 0 && which.stdout.split(/\r?\n/).find(Boolean);
  if (found) return found.trim();
  throw new Error(
    `Blender 4.5 was not found. Set BLENDER_EXE.\nChecked:\n  ${candidates.join("\n  ")}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const blender = findBlender();
  if (args[0] === "--where") {
    console.log(blender);
    process.exit(0);
  }
  const child = spawn(blender, args, { cwd: root, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
}
