// Local-only deterministic render workload. No production performance switches.
// node scripts/profile-performance.mjs http://127.0.0.1:5278/ before
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] ?? "http://127.0.0.1:5278/";
const label = process.argv[3] ?? "current";
const dir = `artifacts/performance/${label}`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  args: [
    "--use-angle=d3d11",
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
  ],
});
try {
  for (const mobile of [false, true]) {
    const device = mobile ? "mobile" : "desktop";
    const ctx = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 720 },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await ctx.newPage(),
      cdp = await ctx.newCDPSession(page);
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
    await page.evaluate(async () => {
      const a = window.__encore.app;
      a.frame = () => {};
      // All fixture randomness, including rebuilds, belongs to this page only.
      window.__seed = (seed = 1234567) => {
        let s = seed;
        Math.random = () =>
          (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
      };
      window.__seed();
      await window.__encore.play("fur-elise", "hard", "piano", true);
      a.renderer.scale = 1;
      a.renderer.resize(innerWidth, innerHeight);
      a.stage.intro = 1;
      const weatherUpdate = a.stage.weather.update.bind(a.stage.weather);
      a.stage.weather.update = (dt, _wallTime, drift) => weatherUpdate(dt, window.__cosmeticTime, drift);
      window.__step = (moving, i = 0) => {
        window.__seed(7654321 + i);
        window.__cosmeticTime = 10 + (moving ? i / 60 : 0);
        const dt = moving ? 1 / 60 : 0,
          t = 2 + (moving ? i / 60 : 0),
          stage = a.stage;
        if (moving && i % 12 === 0) {
          const key = stage.keys[((i / 12) | 0) % stage.keys.length];
          stage.press(key.lane, true);
          stage.particles.burst(key.x, 0.35, 0, key.color, 26);
          stage.rings.spawn(key.x, 0.08, 0, key.color, key.width * 1.5);
        }
        if (moving && i % 12 === 5)
          for (const key of stage.keys) stage.press(key.lane, false);
        stage.update(dt, t, {
          encore: 0,
          encoreActive: false,
          harmony: 0.8,
          holding: new Set(),
        });
        a.world.update(
          dt,
          10 + (moving ? i / 60 : 0),
          0.1,
          0.8,
          0,
          stage.unitsPerSong * 0.75 * 0.35,
          0,
        );
        a.coda?.update(dt, 10 + (moving ? i / 60 : 0), 0, 0.8);
        a.renderer.render();
      };
      for (let i = 0; i < 10; i++) window.__step(false);
      window.__memory = () => {
        const arrays = new Set(),
          geometries = new Set();
        let nodes = 0;
        const visit = (o) => {
          nodes++;
          const g = o.geometry;
          if (g) {
            geometries.add(g);
            for (const attr of [...Object.values(g.attributes), g.index])
              if (attr) arrays.add((attr.data ?? attr).array.buffer);
          }
          for (const attr of [o.instanceMatrix, o.instanceColor])
            if (attr) arrays.add(attr.array.buffer);
        };
        a.stage.scene.traverse(visit);
        return {
          sceneNodes: nodes,
          sceneGeometries: geometries.size,
          geometryArrayBytes: [...arrays].reduce((n, b) => n + b.byteLength, 0),
          gpuGeometries: a.renderer.renderer.info.memory.geometries,
          textures: a.renderer.renderer.info.memory.textures,
          programs: a.renderer.renderer.info.programs.length,
        };
      };
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: mobile ? 4 : 1 });
    const result = await page.evaluate(async () => {
      const a = window.__encore.app,
        r = a.renderer.renderer,
        gl = r.getContext(),
        proto = a.stage.scene.matrix.constructor.prototype;
      const memory = window.__memory();
      const capture = () => {
        a.renderer.render();
        return r.domElement.toDataURL("image/png");
      };
      const images = { idle: capture(), control: capture() };
      let counts = {},
        phase = "other";
      const restore = [];
      const wrap = (obj, name, fn) => {
        const orig = obj[name];
        obj[name] = function (...args) {
          return fn.call(this, orig, args);
        };
        restore.push(() => (obj[name] = orig));
      };
      for (const name of ["compose", "multiplyMatrices"])
        wrap(proto, name, function (orig, args) {
          counts[name] = (counts[name] ?? 0) + 1;
          return orig.apply(this, args);
        });
      wrap(r, "renderBufferDirect", function (orig, args) {
        const previous = phase;
        phase =
          args[3].isMeshDepthMaterial || args[3].isMeshDistanceMaterial
            ? "shadow"
            : args[1] === a.stage.scene
              ? "main"
              : "post";
        try {
          return orig.apply(this, args);
        } finally {
          phase = previous;
        }
      });
      for (const name of [
        "drawArrays",
        "drawElements",
        "drawArraysInstanced",
        "drawElementsInstanced",
      ])
        wrap(gl, name, function (orig, args) {
          counts.draws = (counts.draws ?? 0) + 1;
          counts[phase] = (counts[phase] ?? 0) + 1;
          return orig.apply(this, args);
        });
      const bytes = (data, offset = 0, length = 0) =>
        typeof data === "number"
          ? data
          : (length || data.length - offset) * (data.BYTES_PER_ELEMENT ?? 1);
      wrap(gl, "bufferSubData", function (orig, args) {
        counts.uploads = (counts.uploads ?? 0) + 1;
        counts.uploadBytes =
          (counts.uploadBytes ?? 0) + bytes(args[2], args[3], args[4]);
        return orig.apply(this, args);
      });
      wrap(gl, "bufferData", function (orig, args) {
        counts.allocations = (counts.allocations ?? 0) + 1;
        counts.allocatedBytes =
          (counts.allocatedBytes ?? 0) + bytes(args[1], args[3], args[4]);
        return orig.apply(this, args);
      });
      const samples = {};
      for (const moving of [false, true]) {
        counts = {draws:0,shadow:0,uploads:0,uploadBytes:0,allocations:0,allocatedBytes:0};
        for (let i = 0; i < 60; i++) {
          await new Promise(requestAnimationFrame);
          window.__step(moving, i);
        }
        samples[moving ? "moving" : "idle"] = Object.fromEntries(
          Object.entries(counts).map(([k, v]) => [k, v / 60]),
        );
        samples[moving ? "moving" : "idle"].triangles = r.info.render.triangles;
      }
      restore.reverse().forEach((fn) => fn());
      images.moving = capture();
      const debug = {
        weather: Array.from(
          a.stage.weather.points.geometry.attributes.position.array,
        ),
        particles: Array.from(
          a.stage.particles.points.geometry.attributes.position.array,
        ).slice(0, 120),
        camera: a.stage.camera.matrixWorld.elements.slice(),
      };
      return {
        quality: a.renderer.quality,
        buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        memory,
        samples,
        images,
        debug,
      };
    });
    // CPU sampling and timing have NO operation-count wrappers installed.
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
    await cdp.send("Profiler.start");
    result.timing = await page.evaluate(async () => {
      const pairs = [],
        gaps = [];
      let last = 0;
      for (let pair = 0; pair < 12; pair++) {
        const arms = [];
        for (let arm = 0; arm < 2; arm++) {
          let ms = 0;
          for (let i = 0; i < 5; i++) {
            await new Promise(requestAnimationFrame);
            const t = performance.now();
            if (last) gaps.push(t - last);
            last = t;
            window.__step(true, 60 + pair * 10 + arm * 5 + i);
            ms += performance.now() - t;
          }
          arms.push(ms / 5);
        }
        pairs.push(arms);
      }
      const sorted = gaps.sort((a, b) => a - b),
        work = pairs.flat().sort((a, b) => a - b);
      return {
        nullPairs: pairs,
        workMedianMs: work[work.length >> 1],
        frameMedianMs: sorted[sorted.length >> 1],
        frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
      };
    });
    const { profile } = await cdp.send("Profiler.stop");
    await writeFile(`${dir}/${device}.cpuprofile`, JSON.stringify(profile));
    const times = new Map();
    profile.samples.forEach((id, i) =>
      times.set(id, (times.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)),
    );
    result.cpuTop = profile.nodes
      .map((n) => ({
        fn: n.callFrame.functionName,
        file: n.callFrame.url.split("/").pop(),
        ms: (times.get(n.id) ?? 0) / 1000,
      }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 15);
    await cdp.send("HeapProfiler.collectGarbage");
    result.heap = await cdp.send("Runtime.getHeapUsage");
    result.rebuilds = [];
    for (let i = 0; i < 3; i++) {
      result.rebuilds.push(
        await page.evaluate(async () => {
          window.__seed();
          await window.__encore.play("fur-elise", "hard", "piano", true);
          window.__encore.app.stage.intro = 1;
          for (let j = 0; j < 10; j++) window.__step(false);
          return window.__memory();
        }),
      );
    }
    await cdp.send("HeapProfiler.collectGarbage");
    result.heapAfterRebuilds = await cdp.send("Runtime.getHeapUsage");
    for (const [key, png] of Object.entries(result.images))
      await writeFile(
        `${dir}/${device}-${key}.png`,
        Buffer.from(png.split(",")[1], "base64"),
      );
    delete result.images;
    result.errors = errors;
    await writeFile(`${dir}/${device}.json`, JSON.stringify(result, null, 2));
    console.log(device, JSON.stringify({quality:result.quality,memory:result.memory,samples:result.samples,timing:{workMedianMs:result.timing.workMedianMs,frameP95Ms:result.timing.frameP95Ms},errors}));
    if (errors.length) throw Error(errors.join("\n"));
    await ctx.close();
  }
} finally {
  await browser.close();
}
