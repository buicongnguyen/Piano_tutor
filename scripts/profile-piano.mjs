// Adapted from Claude's smooth-dense-scenes workflow: measure real full-frame
// counters, attribute repeated objects, and compare identical rendered frames.
// Run against Vite: node scripts/profile-piano.mjs http://127.0.0.1:5278/
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"],
});
await mkdir("artifacts/render-review", { recursive: true });
try {
  for (const mobile of [true, false]) {
    const context = await browser.newContext(
      mobile
        ? {
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 2,
          }
        : { viewport: { width: 1280, height: 720 } },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /shader|WebGL/i.test(m.text()))
        errors.push(m.text());
    });
    await page.goto(base + "?capture");
    await page.waitForFunction(() => window.__encore?.state() === "title");
    await page.evaluate(() => window.__encore.app.save.seen.push("intro"));
    await page.click(".title-play", { force: true });
    await page.waitForFunction(() => window.__encore.state() === "map");
    await page.evaluate(() =>
      window.__encore.play("morning-light", "normal", "piano", true),
    );
    await page.waitForFunction(() => window.__encore.state() === "play");
    await page.waitForTimeout(3000);
    const result = await page.evaluate(() => {
      const a = window.__encore.app,
        stage = a.stage,
        wrapper = a.renderer;
      // Stop the app loop: both versions now use exactly the same world and camera.
      a.frame = () => {};
      stage.intro = 1;
      // Include a pressed white key and black key, with different glow strengths.
      for (const black of [false, true]) {
        const key = stage.keys.find((k) => k.black === black);
        key.pressed = black ? 0.7 : 1;
        key.flash = black ? 0.2 : 0.8;
      }
      stage.update(0, 0, {
        encore: 0,
        encoreActive: false,
        harmony: 1,
        holding: new Set(),
      });
      const groups = stage.keyBatch.groups;
      if (groups.length !== 2)
        throw Error(`Expected two key batches, got ${groups.length}`);
      const gl = wrapper.renderer.getContext();
      const draw = (batched) => {
        for (const group of groups) {
          group.mesh.visible = batched;
          for (const source of group.sources) source.visible = !batched;
        }
        wrapper.render();
        const pixels = new Uint8Array(
          gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
        );
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        return {
          pixels,
          calls: wrapper.renderer.info.render.calls,
          triangles: wrapper.renderer.info.render.triangles,
          png: wrapper.renderer.domElement.toDataURL("image/png"),
        };
      };
      const before = draw(false),
        control = draw(false),
        after = draw(true);
      const diff = (x, y) => {
        let changed = 0,
          maxDelta = 0;
        for (let i = 0; i < x.length; i += 4) {
          const d = Math.max(
            ...[0, 1, 2].map((j) => Math.abs(x[i + j] - y[i + j])),
          );
          if (d > 16) changed++;
          maxDelta = Math.max(maxDelta, d);
        }
        return { changed, percent: (changed / (x.length / 4)) * 100, maxDelta };
      };
      return {
        quality: wrapper.quality,
        keys: stage.keys.length,
        before: { calls: before.calls, triangles: before.triangles },
        after: { calls: after.calls, triangles: after.triangles },
        control: diff(before.pixels, control.pixels),
        diff: diff(before.pixels, after.pixels),
        images: { before: before.png, after: after.png },
      };
    });
    const name = mobile ? "phone" : "desktop";
    for (const [label, png] of Object.entries(result.images))
      await writeFile(
        `artifacts/render-review/${name}-${label}.png`,
        Buffer.from(png.split(",")[1], "base64"),
      );
    delete result.images;
    console.log(name, JSON.stringify(result));
    await writeFile(
      `artifacts/render-review/${name}.json`,
      JSON.stringify(result, null, 2),
    );
    assert.equal(result.control.changed, 0, "frozen control must be stable");
    assert.ok(result.diff.percent < 0.1, "batching must preserve appearance");
    assert.equal(
      result.before.triangles,
      result.after.triangles,
      "preserve geometry",
    );
    assert.ok(
      result.before.calls - result.after.calls >= result.keys - 2,
      "keys share two submissions",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
