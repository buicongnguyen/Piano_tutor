#!/usr/bin/env node
// Adapted from ~/.claude/skills/smooth-dense-scenes/scripts/draw-attribution.mjs.
// Who makes the draw calls: wraps three.js's renderer.renderBufferDirect in a running game for N frames and counts
// every draw by pass (view, shadow map, full-screen passes), by top-level scene group, and by object + material
// (instanced draws show their instance count). Works with any three.js game that exposes its renderer and scene.
//
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   node draw-attribution.mjs http://127.0.0.1:5173/ \
//     --renderer "window.game.renderer" --scene "window.game.scene" \
//     [--viewport 390x844 --mobile] [--click "#start"] [--wait 4000] [--frames 30] [--pass shadow] [--top 25]
//     [--setup "window.qa.teleport(10, 20)"]   (any JS to run first, e.g. move the player to a busy spot)
//
// Count actual counter increments inside each submission (zero-instance draws can be skipped).
// This works across per-pass resets; Encore also resets its counters once per whole frame. Passes:
//   shadow = drawn with a depth/distance material; post = drawn outside the game's scene (bloom, grade, output).
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith("--") && /^https?:/.test(a));
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0
    ? d
    : argv[i + 1] && !argv[i + 1].startsWith("--")
      ? argv[i + 1]
      : true;
};
if (!url || !opt("renderer") || !opt("scene")) {
  console.error(
    "usage: draw-attribution.mjs <url> --renderer <js expr> --scene <js expr> [--viewport WxH] [--mobile] [--click sel] [--wait ms] [--frames n] [--pass main|shadow|post] [--top n] [--setup js]",
  );
  process.exit(2);
}
const pw = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import("playwright");
const [w, h] = String(opt("viewport", "1280x720")).split("x").map(Number);
const browser = await pw.chromium.launch({
  headless: true,
  args: [
    "--use-angle=d3d11",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    ...(opt("software")
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : []),
  ],
});
const ctx = await browser.newContext(
  opt("mobile")
    ? {
        viewport: { width: w, height: h },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      }
    : { viewport: { width: w, height: h } },
);
const page = await ctx.newPage();
if (opt("throttle")) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: +opt("throttle") });
}
await page.goto(url);
if (opt("click")) await page.click(opt("click"), { force: true });
await page.waitForFunction(
  (e) => {
    try {
      return !!(0, eval)(e);
    } catch {
      return false;
    }
  },
  opt("renderer"),
  { timeout: 240000 },
);
if (opt("setup")) await page.evaluate((js) => (0, eval)(js), opt("setup"));
await page.waitForTimeout(+opt("wait", 4000));
const r = await page.evaluate(
  ([re, se, frames]) =>
    new Promise((done) => {
      const R = (0, eval)(re),
        S = (0, eval)(se),
        orig = R.renderBufferDirect;
      const rows = new Map(),
        groups = new Map(),
        pass = { main: 0, shadow: 0, post: 0 };
      let n = 0,
        tris = 0;
      R.renderBufferDirect = function (
        camera,
        scene,
        geometry,
        material,
        object,
      ) {
        const callsBefore = R.info.render.calls,
          trisBefore = R.info.render.triangles;
        const result = orig.apply(this, arguments);
        const calls = R.info.render.calls - callsBefore;
        tris += R.info.render.triangles - trisBefore;
        if (!calls) return result;
        const p =
          material.isMeshDepthMaterial || material.isMeshDistanceMaterial
            ? "shadow"
            : scene !== S && !(scene && scene.isScene && scene === S)
              ? "post"
              : "main";
        pass[p] += calls;
        let top = object;
        while (top.parent && top.parent !== S) top = top.parent;
        const g =
          p === "post"
            ? "(post-processing)"
            : (top.name || top.type).replace(/\d+/g, "#");
        groups.set(g, (groups.get(g) || 0) + calls);
        const k = `${p.padEnd(6)} ${g} / ${(object.name || object.type).replace(/\d+/g, "#")} [${material.name || material.type}]${object.isInstancedMesh ? ` x${object.count}` : ""}`;
        rows.set(k, (rows.get(k) || 0) + calls);
        return result;
      };
      const tick = () => {
        if (++n < frames) requestAnimationFrame(tick);
        else {
          R.renderBufferDirect = orig;
          done({
            n,
            pass,
            tris,
            rows: [...rows].sort((a, b) => b[1] - a[1]),
            groups: [...groups].sort((a, b) => b[1] - a[1]),
          });
        }
      };
      requestAnimationFrame(tick);
    }),
  [opt("renderer"), opt("scene"), +opt("frames", 30)],
);
const per = (v) => (v / r.n).toFixed(1),
  want = opt("pass");
console.log(
  `${per(r.pass.main + r.pass.shadow + r.pass.post)} draws/frame (view ${per(r.pass.main)}, shadow ${per(r.pass.shadow)}, post ${per(r.pass.post)}), ${Math.round(r.tris / r.n / 1000)}k tris/frame`,
);
console.log(
  "by group: " +
    r.groups
      .slice(0, 16)
      .map(([k, v]) => `${k} ${per(v)}`)
      .join(" | "),
);
for (const [k, v] of r.rows
  .filter(([k]) => !want || want === true || k.startsWith(want))
  .slice(0, +opt("top", 25)))
  console.log(`${per(v).padStart(7)}  ${k}`);
if (opt("screenshot"))
  await page.screenshot({ path: String(opt("screenshot")) });
await browser.close();
