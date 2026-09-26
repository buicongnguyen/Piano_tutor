// Visual review captures on a real GPU: title, map, island panel, gameplay, results.
// Usage: node scripts/capture.mjs [stageId] [difficulty] [mode] [--url http://...] [--mobile]
// Starts its own Vite dev server unless --url is given. Writes artifacts/captures/*.png.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--url", "--tag"].includes(args[i - 1])));
const prefix = opt("--tag") ?? "";
const [stageId = "morning-light", difficulty = "normal", mode = "lanes"] = positional;
const mobile = flag("--mobile");
const out = "artifacts/captures";
mkdirSync(out, { recursive: true });

let server;
let url = opt("--url");
if (!url) {
  const port = 5231;
  url = `http://127.0.0.1:${port}/`;
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    stdio: "pipe",
  });
  process.on("exit", () => server.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Vite did not start")), 30000);
    server.stdout.on("data", (d) => {
      if (String(d).includes("Local")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (d) => process.stderr.write(d));
  });
}

process.on("uncaughtException", (e) => {
  console.error(e);
  server?.kill();
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e);
  server?.kill();
  process.exit(1);
});
const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext(
  mobile
    ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1600, height: 900 } },
);
const page = await context.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.log(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
const tag = prefix + (mobile ? "mobile-" : "");
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${tag}${name}.png` });
  console.log("captured", name);
};

await page.goto(url + "?capture", { waitUntil: "load" });
await page.waitForFunction(() => window.__encore?.state() === "title", null, { timeout: 60000 });
await page.waitForTimeout(1500);
await shot("01-title");
await page.click(".title-play", { force: true });
await page.waitForTimeout(800);
if (await page.isVisible(".dialogue")) {
  await shot("02-dialogue");
  await page.click(".dialogue-skip");
}
await page.waitForFunction(() => window.__encore.state() === "map", null, { timeout: 30000 });
await page.waitForTimeout(1800);
await shot("03-map");
await page.click('.island-label[data-island="meadow"]');
await page.waitForTimeout(600);
if (await page.isVisible(".dialogue")) await page.click(".dialogue-skip");
await page.waitForTimeout(500);
await shot("04-island");
await page.evaluate(
  ([s, d, m]) => window.__encore.play(s, d, m),
  [stageId, difficulty, mode],
);
await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
await page.evaluate(() => window.__encore.autoplay(true));
for (const [i, wait] of [3500, 4000, 5000].entries()) {
  await page.waitForTimeout(wait);
  await shot(`05-play-${i + 1}`);
}
if (!flag("--quick")) {
  await page.waitForFunction(() => window.__encore.state() === "results", null, { timeout: 240000 });
  await page.waitForTimeout(2600);
  await shot("06-results");
}
const stats = await page.evaluate(() => {
  const r = window.__encore.app.renderer.renderer.info.render;
  return { calls: r.calls, triangles: r.triangles, quality: window.__encore.app.quality };
});
console.log("render", JSON.stringify(stats));
await browser.close();
server?.kill();
process.exit(0);
