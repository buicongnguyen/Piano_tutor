// Compare same-build controls first, then seeded old/new render images.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = "artifacts/performance",
  before = process.argv[2] ?? "before",
  after = process.argv[3] ?? "after";
const browser = await chromium.launch();
try {
  const page = await browser.newPage(),
    results = [];
  for (const device of ["desktop", "mobile"])
    for (const fixture of ["control", "idle", "moving"]) {
      const a = `${root}/${before}/${device}-${fixture === "control" ? "idle" : fixture}.png`;
      const b = `${root}/${fixture === "control" ? before : after}/${device}-${fixture}.png`;
      const urls = await Promise.all(
        [a, b].map(
          async (file) =>
            "data:image/png;base64," +
            (await readFile(file)).toString("base64"),
        ),
      );
      const result = await page.evaluate(async (urls) => {
        const images = await Promise.all(
          urls.map(
            (src) =>
              new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = src;
              }),
          ),
        );
        const canvas = document.createElement("canvas");
        canvas.width = images[0].width;
        canvas.height = images[0].height;
        if (
          images[1].width !== canvas.width ||
          images[1].height !== canvas.height
        )
          throw Error("Different image dimensions");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const data = images.map((img) => {
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        });
        let changed = 0,
          exact = 0,
          max = 0;
        for (let i = 0; i < data[0].length; i += 4) {
          const d = Math.max(
            ...[0, 1, 2].map((c) => Math.abs(data[0][i + c] - data[1][i + c])),
          );
          if (d) exact++;
          if (d > 16) changed++;
          max = Math.max(d, max);
        }
        return {
          pixels: canvas.width * canvas.height,
          changed,
          exact,
          max,
          percent: (changed / (canvas.width * canvas.height)) * 100,
        };
      }, urls);
      results.push({ device, fixture, ...result });
      console.log(device, fixture, result);
      assert.ok(
        result.percent < 0.1,
        `${device} ${fixture} differs materially`,
      );
    }
  await writeFile(
    `${root}/${after}/visual-diff.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
