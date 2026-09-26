// Captures one gameplay frame per theme for art review (artifacts/captures/theme-*.png).
// Usage: node scripts/theme-gallery.mjs [--mobile]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const mobile = process.argv.includes("--mobile");
mkdirSync("artifacts/captures", { recursive: true });
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5236", "--strictPort"], { stdio: "pipe" });
process.on("exit", () => server.kill());
await new Promise((r) => server.stdout.on("data", (d) => String(d).includes("Local") && r()));
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage(mobile ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://127.0.0.1:5236/?capture");
await page.waitForFunction(() => window.__encore?.state() === "title", null, { timeout: 60000 });
await page.evaluate(() => { const a = window.__encore.app; a.save.seen.push("intro", "finale"); a.save.settings.openAll = true; });
await page.click(".title-play", { force: true });
await page.waitForFunction(() => window.__encore.state() === "map");
const stages = [["meadow", "morning-light"], ["snow", "silent-night"], ["festival", "aegukga"], ["pier", "the-entertainer"], ["garden", "fur-elise"], ["neon", "katana-action-title"], ["harbour", "clair-de-lune"], ["spring", "spring-1"], ["summer", "summer-2"], ["autumn", "autumn-3"], ["winter", "winter-2"], ["crown", "canon-in-d"]];
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
for (const [theme, stage] of stages) {
  if (only && !only.includes(theme)) continue;
  await page.evaluate((s) => window.__encore.play(s, "normal", "lanes"), stage);
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  await page.evaluate(() => window.__encore.autoplay(true));
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `artifacts/captures/theme-${mobile ? "m-" : ""}${theme}.png` });
  const info = await page.evaluate(() => { const r = window.__encore.app.renderer.renderer.info.render; return `${r.calls} calls ${r.triangles} tris`; });
  console.log("captured", theme, info);
  await page.evaluate(() => window.__encore.app.quitToMap());
}
await browser.close(); server.kill(); process.exit(0);
