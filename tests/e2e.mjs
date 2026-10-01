// End-to-end browser checks for Stillnote Encore (and the classic studio).
// Usage: node tests/e2e.mjs [--url http://127.0.0.1:58231/] [--swiftshader]
// Starts its own Vite dev server unless --url is given (e.g. a `vite preview` build).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const args = process.argv.slice(2);
const urlArg = args.includes("--url") ? args[args.indexOf("--url") + 1] : undefined;
const gpu = !args.includes("--swiftshader");
let server;
let base = urlArg;
if (!base) {
  const port = 5251;
  base = `http://127.0.0.1:${port}/`;
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "pipe" });
  process.on("exit", () => server.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Vite did not start")), 30000);
    server.stdout.on("data", (d) => String(d).includes("Local") && (clearTimeout(timer), resolve()));
    server.stderr.on("data", (d) => process.stderr.write(d));
  });
}

const browser = await chromium.launch({
  args: [
    "--autoplay-policy=no-user-gesture-required",
    ...(gpu ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
  ],
});
const results = [];
const live = new Set(); // contexts opened by the current check, closed even when it fails
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
async function check(name, fn) {
  if (only && !name.includes(only)) return;
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ✓ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✗ ${name}\n    ${String(error?.message ?? error).split("\n").slice(0, 6).join("\n    ")}`);
  } finally {
    for (const context of live) await context.close().catch(() => undefined);
    live.clear();
  }
}

async function open(viewport = { width: 1280, height: 720 }, extra = {}) {
  const context = await browser.newContext({ viewport, ...extra });
  live.add(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()));
  await page.goto(base + "?capture", { waitUntil: "load" });
  await page.waitForFunction(() => window.__encore?.state() === "title", null, { timeout: 60000 });
  return { page, context, errors };
}
const state = (page) => page.evaluate(() => window.__encore.state());
const enterMap = async (page, skipIntro = true) => {
  await page.click(".title-play", { force: true });
  if (skipIntro) {
    await page.waitForSelector(".dialogue:not([hidden])", { timeout: 15000 });
    await page.click(".dialogue-skip");
  }
  await page.waitForFunction(() => window.__encore.state() === "map", null, { timeout: 30000 });
};

console.log(`Stillnote Encore e2e against ${base} (${gpu ? "GPU" : "SwiftShader"})`);

await check("boots to the title with every kit loaded and no errors", async () => {
  const { page, context, errors } = await open();
  const kits = await page.evaluate(() => {
    const k = window.__encore.app.kits;
    return { stage: k.stage?.size ?? 0, world: k.world?.size ?? 0, chars: k.chars?.size ?? 0, fish: k.fish?.size ?? 0 };
  });
  assert.ok(kits.stage >= 13, `stage kit roots ${kits.stage}`);
  assert.ok(kits.world >= 30, `world kit roots ${kits.world}`);
  assert.equal(kits.chars, 3);
  assert.equal(kits.fish, 7);
  assert.ok(await page.isVisible(".title-screen"));
  assert.deepEqual(errors, []);
  await context.close();
});

await check("first launch tells the intro, then shows the map with Dawn Meadow open", async () => {
  const { page, context, errors } = await open();
  await page.click(".title-play", { force: true });
  await page.waitForSelector(".dialogue:not([hidden])");
  const name = await page.textContent(".dialogue-name");
  assert.equal(name, "Coda");
  for (let i = 0; i < 40 && (await page.isVisible(".dialogue")); i++) {
    await page.click(".dialogue-card", { force: true });
    await page.waitForTimeout(80);
  }
  await page.waitForFunction(() => window.__encore.state() === "map");
  assert.match(await page.textContent('[data-el="stars"]'), /★ 0/);
  assert.ok(!(await page.getAttribute('.island-label[data-island="meadow"]', "class")).includes("locked"));
  assert.ok((await page.getAttribute('.island-label[data-island="snow"]', "class")).includes("locked"));
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem("stillnote-encore-v1")).seen);
  assert.ok(seen.includes("intro"));
  assert.deepEqual(errors, []);
  await context.close();
});

await check("island panel → setup → play Easy lanes → autoplay clears with 3 stars → saved", async () => {
  const { page, context, errors } = await open();
  await enterMap(page);
  await page.click('.island-label[data-island="meadow"]');
  if (await page.isVisible(".dialogue")) await page.click(".dialogue-skip");
  await page.click('.stage-row[data-stage="room-to-breathe"]');
  await page.click('[data-act="difficulty"][data-value="easy"]');
  await page.click('[data-act="mode"][data-value="lanes"]');
  await page.click('[data-act="go"]');
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  assert.ok(await page.isVisible(".hud"));
  assert.match(await page.textContent(".hud-badges"), /Easy · 4 lanes/);
  await page.evaluate(() => window.__encore.autoplay(true));
  await page.waitForFunction(() => window.__encore.state() === "results", null, { timeout: 90000 });
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".big-star.on").count(), 3);
  assert.match(await page.textContent(".results-rank"), /S\+/);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem("stillnote-encore-v1")).records["room-to-breathe|easy|lanes"]);
  assert.equal(record.stars, 3);
  assert.equal(record.fullCombo, true);
  await page.click('.results-screen [data-act="quit"]');
  await page.waitForFunction(() => window.__encore.state() === "map");
  assert.match(await page.textContent('[data-el="stars"]'), /★ 3/);
  // Progress survives a reload.
  await page.reload();
  await page.waitForFunction(() => window.__encore?.state() === "title", null, { timeout: 60000 });
  await page.click(".title-play", { force: true });
  await page.waitForFunction(() => window.__encore.state() === "map");
  assert.match(await page.textContent('[data-el="stars"]'), /★ 3/);
  assert.deepEqual(errors, []);
  await context.close();
});

await check("keyboard presses reach the judge: strays, hits and a pause/resume round trip", async () => {
  const { page, context, errors } = await open();
  await enterMap(page);
  await page.evaluate(() => window.__encore.play("morning-light", "normal", "lanes"));
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  await page.evaluate(() => {
    const j = window.__encore.app.session.judge;
    const press = j.press.bind(j);
    j.press = (lane, time) => {
      const events = press(lane, time);
      j.testPress = { lane, types: events.map((e) => e.type) };
      return events;
    };
  });
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(60);
  const held = await page.evaluate(() => window.__encore.app.stage.keys[0].held);
  await page.keyboard.up("KeyS");
  assert.equal(held, true);
  // A slow rendered frame can move the first press into a valid hit window.
  // Verify delivery, without assuming the browser is still in the countdown.
  const press = await page.evaluate(() => window.__encore.app.session.judge.testPress);
  assert.equal(press.lane, 0);
  assert.ok(press.types.some((type) => ["hit", "miss", "stray"].includes(type)));
  // Press each lane exactly when its first notes arrive (song time from the conductor).
  const hits = await page.evaluate(async () => {
    const s = window.__encore.app.session;
    const keys = ["KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"];
    const targets = s.chart.notes.filter((n) => n.time > s.conductor.time() + 0.5).slice(0, 6);
    for (const n of targets) {
      while (s.conductor.time() < n.time - 0.004) await new Promise((r) => setTimeout(r, 1));
      dispatchEvent(new KeyboardEvent("keydown", { code: keys[n.lane], bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      dispatchEvent(new KeyboardEvent("keyup", { code: keys[n.lane], bubbles: true }));
    }
    const c = s.judge.counts;
    return c.perfect + c.great + c.good;
  });
  // Software rendering starves the timer loop, so only the GPU run holds presses to the beat.
  assert.ok(hits >= (gpu ? 5 : 1), `hit ${hits} of 6 timed presses`);
  // A wrong lane while a note is due: ✗ WRONG KEY on screen and the combo resets.
  const wrong = await page.evaluate(async () => {
    const s = window.__encore.app.session;
    const keys = ["KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"];
    const n = s.chart.notes.find(
      (m) =>
        m.time > s.conductor.time() + 0.5 &&
        !s.chart.notes.some((o) => o.lane === (m.lane + 3) % 6 && Math.abs(o.time - m.time) < 0.25),
    );
    while (s.conductor.time() < n.time - 0.004) await new Promise((r) => setTimeout(r, 1));
    dispatchEvent(new KeyboardEvent("keydown", { code: keys[(n.lane + 3) % 6], bubbles: true }));
    const out = { wrong: s.judge.wrong, combo: s.judge.combo, pop: !!document.querySelector(".hud-pop.wrong") };
    dispatchEvent(new KeyboardEvent("keyup", { code: keys[(n.lane + 3) % 6], bubbles: true }));
    return out;
  });
  assert.ok(wrong.wrong >= 1 && wrong.combo === 0 && wrong.pop, `wrong key: ${JSON.stringify(wrong)}`);
  await page.keyboard.press("Escape");
  await page.waitForSelector(".pause-screen:not([hidden])");
  const t1 = await page.evaluate(() => window.__encore.app.session.conductor.time());
  await page.waitForTimeout(500);
  const t2 = await page.evaluate(() => window.__encore.app.session.conductor.time());
  assert.ok(Math.abs(t2 - t1) < 0.01, "clock frozen while paused");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.hidden;
  });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__encore.app.session.paused), true, "hiding a paused game must not resume it");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".pause-screen", { state: "hidden" });
  await page.keyboard.press("Escape");
  await page.waitForSelector(".pause-screen:not([hidden])");
  const t4 = await page.evaluate(() => window.__encore.app.session.conductor.time());
  await page.click('.pause-screen [data-act="resume"]');
  await page.waitForTimeout(400);
  const t3 = await page.evaluate(() => window.__encore.app.session.conductor.time());
  assert.ok(t3 > t4 - 2.2 && t3 < t4, `resume rewinds ~2 s (paused ${t4.toFixed(2)}, now ${t3.toFixed(2)})`);
  await page.evaluate(() => window.__encore.app.quitToMap());
  assert.equal(await state(page), "map");
  assert.deepEqual(errors, []);
  await context.close();
});

await check("practice mode waits at the first note until it is played", async () => {
  const { page, context, errors } = await open();
  await enterMap(page);
  await page.evaluate(() => window.__encore.play("arirang", "easy", "lanes", true));
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  await page.waitForFunction(() => window.__encore.app.session.conductor.waiting !== undefined, null, { timeout: 20000 });
  const { gate, lane } = await page.evaluate(() => {
    const s = window.__encore.app.session;
    return { gate: s.conductor.waiting, lane: s.judge.gateGroup()[0].lane };
  });
  await page.waitForTimeout(700);
  const still = await page.evaluate(() => window.__encore.app.session.conductor.time());
  assert.ok(Math.abs(still - gate) < 0.02, "clock holds at the gate");
  assert.match(await page.textContent(".hud-hint"), /Next:/);
  const key = ["KeyD", "KeyF", "KeyJ", "KeyK"][lane];
  await page.keyboard.press(key);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__encore.app.session.conductor.time());
  assert.ok(after > gate, "clock resumes after the right key");
  assert.deepEqual(errors, []);
  await context.close();
});

await check("real piano mode maps laptop keys from the chosen C and assists far notes", async () => {
  const { page, context, errors } = await open();
  await enterMap(page);
  await page.evaluate(() => window.__encore.play("fur-elise", "normal", "piano"));
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    const s = window.__encore.app.session;
    return { assist: s.assist.size, notes: s.chart.notes.length, mode: s.input.mode, keys: window.__encore.app.stage.keys.length };
  });
  assert.equal(info.mode.kind, "piano");
  assert.ok(info.keys <= 37 && info.keys >= 13, `keys drawn ${info.keys}`);
  assert.ok(info.assist < info.notes / 2, "most notes are playable");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(50);
  const pressed = await page.evaluate(() => window.__encore.app.stage.keys.filter((k) => k.held).map((k) => k.lane));
  await page.keyboard.up("KeyA");
  assert.deepEqual(pressed, [info.mode.base]);
  // P is a note (base + 15) in the chromatic layout, not Pause.
  await page.keyboard.down("KeyP");
  await page.waitForTimeout(50);
  const p = await page.evaluate(() => ({
    paused: window.__encore.app.session.paused,
    held: window.__encore.app.stage.keys.filter((k) => k.held).map((k) => k.lane),
  }));
  await page.keyboard.up("KeyP");
  assert.equal(p.paused, false);
  assert.deepEqual(p.held, [info.mode.base + 15]);
  assert.deepEqual(errors, []);
  await context.close();
});

await check("words mode: typed letters score, wrong letters stay silent, the song keeps playing", async () => {
  const { page, errors } = await open();
  await enterMap(page);
  await page.evaluate(() => window.__encore.play("arirang", "easy", "words"));
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    const s = window.__encore.app.session;
    window.__blips = [];
    const bank = window.__encore.app.bank;
    const blip = bank.blip.bind(bank);
    bank.blip = (kind, pitch) => (window.__blips.push(kind), blip(kind, pitch));
    return {
      keep: s.setup.keepMelody,
      words: s.chart.words.map((w) => w.text),
      scheduledMelody: s.conductor.events.length - s.chart.accompaniment.length,
      notes: s.chart.notes.length,
      keys: window.__encore.app.stage.keys.length,
    };
  });
  assert.equal(info.keep, true, "keep-the-song is on by default for words");
  assert.equal(info.scheduledMelody, info.notes, "every melody note is scheduled to play by itself");
  assert.equal(info.keys, 26);
  assert.ok(info.words.join("").match(/^[asdfghjkl]+$/), `home-row words on Easy: ${info.words.slice(0, 5)}`);
  const hits = await page.evaluate(async () => {
    const s = window.__encore.app.session;
    for (const n of s.chart.notes.slice(0, 5)) {
      while (s.conductor.time() < n.time - 0.004) await new Promise((r) => setTimeout(r, 1));
      const key = String.fromCharCode(97 + n.lane);
      dispatchEvent(new KeyboardEvent("keydown", { key, code: `Key${key.toUpperCase()}`, bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      dispatchEvent(new KeyboardEvent("keyup", { key, code: `Key${key.toUpperCase()}`, bubbles: true }));
    }
    const c = s.judge.counts;
    return c.perfect + c.great + c.good;
  });
  assert.ok(hits >= (gpu ? 4 : 1), `typed ${hits} of 5 letters on the beat`);
  assert.match(await page.textContent(".hud-word"), /[A-Z]/);
  // A wrong letter: a wrong key (a note is due) or a stray (nothing due), shown on
  // screen but with no stray/miss sound in keep-the-song mode.
  await page.keyboard.press("q");
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => {
    const j = window.__encore.app.session.judge;
    return { counted: j.strays + j.wrong, blips: window.__blips };
  });
  assert.ok(after.counted >= 1);
  assert.ok(!after.blips.includes("stray") && !after.blips.includes("miss"), `no penalty sounds: ${after.blips}`);
  assert.deepEqual(errors, []);
});

await check("lane keys: ASDF picked in the setup panel drives the lanes", async () => {
  const { page, errors } = await open();
  await enterMap(page);
  await page.click('.island-label[data-island="meadow"]');
  if (await page.isVisible(".dialogue")) await page.click(".dialogue-skip");
  await page.click('.stage-row[data-stage="morning-light"]');
  await page.click('[data-act="difficulty"][data-value="easy"]');
  await page.click('[data-act="mode"][data-value="lanes"]');
  await page.click('[data-act="lanekeys"][data-value="asdf"]');
  assert.match(await page.textContent('[data-act="difficulty"][data-value="easy"]'), /A S D F/);
  await page.click('[data-act="go"]');
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(50);
  const held = await page.evaluate(() => window.__encore.app.stage.keys.filter((k) => k.held).map((k) => k.lane));
  await page.keyboard.up("KeyA");
  assert.deepEqual(held, [0]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("stillnote-encore-v1")).settings.laneKeys);
  assert.equal(saved, "asdf");
  assert.deepEqual(errors, []);
});

await check("phone portrait: touch taps press lanes and the HUD fits", async () => {
  const { page, context, errors } = await open({ width: 412, height: 860 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluate(() => window.__encore.app.save.seen.push("intro"));
  await page.tap(".title-play", { force: true });
  await page.waitForFunction(() => window.__encore.state() === "map");
  await page.evaluate(() => window.__encore.play("morning-light", "easy", "lanes"));
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  await page.waitForTimeout(2600); // let the fly-in camera settle
  const pos = await page.evaluate(() => {
    const st = window.__encore.app.stage;
    return st.screenOf(0, innerWidth, innerHeight, 0.05);
  });
  const lane = await page.evaluate(({ x, y }) => window.__encore.app.stage.laneAt(x, y, document.querySelector("#scene").getBoundingClientRect()), pos);
  assert.equal(lane, 0);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pos.x, y: pos.y }] });
  await page.waitForTimeout(80);
  const held = await page.evaluate(() => window.__encore.app.stage.keys[0].held);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(held, true);
  const overflow = await page.evaluate(() => {
    const r = document.querySelector(".hud-top").getBoundingClientRect();
    return r.right > innerWidth + 1 || r.left < -1;
  });
  assert.equal(overflow, false);
  assert.deepEqual(errors, []);
  await context.close();
});

await check("phone Tap mode: default on phones, either half of the screen is a button", async () => {
  const { page, context, errors } = await open({ width: 412, height: 860 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluate(() => window.__encore.app.save.seen.push("intro", "arrive:meadow"));
  await page.tap(".title-play", { force: true });
  await page.waitForFunction(() => window.__encore.state() === "map");
  await page.waitForTimeout(1500); // labels follow the map camera: let it settle
  for (let i = 0; i < 3 && !(await page.isVisible('.stage-row[data-stage="arirang"]')); i++) {
    await page.tap('.island-label[data-island="meadow"]', { force: true });
    await page.waitForTimeout(500);
  }
  await page.tap('.stage-row[data-stage="arirang"]');
  assert.equal(await page.getAttribute('[data-act="mode"][data-value="tap"]', "aria-pressed"), "true", "Tap is the phone default");
  assert.equal(await page.isChecked('[data-act="keepmelody"]'), true, "the song keeps playing by default");
  await page.tap('[data-act="go"]');
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  assert.ok(await page.isVisible(".hud-tap"));
  const cdp = await context.newCDPSession(page);
  const tapAt = async (x) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: 420 }] });
    await page.waitForTimeout(60);
    const held = await page.evaluate(() => window.__encore.app.stage.keys.filter((k) => k.held).map((k) => k.lane));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(40);
    return held;
  };
  // Middle of the road, far from the keys: still counts, by screen half.
  assert.deepEqual(await tapAt(60), [0]);
  assert.deepEqual(await tapAt(360), [1]);
  // Two thumbs at once.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 80, y: 600, id: 1 }, { x: 330, y: 600, id: 2 }] });
  await page.waitForTimeout(60);
  const both = await page.evaluate(() => window.__encore.app.stage.keys.filter((k) => k.held).map((k) => k.lane));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.deepEqual(both, [0, 1]);
  assert.deepEqual(errors, []);
});

await check("stars open the next island with a toast", async () => {
  const { page, context, errors } = await open();
  await page.evaluate(() => {
    const save = { v: 1, records: { "morning-light|easy|lanes": { stars: 3, score: 1, accuracy: 1, rank: "S", fullCombo: true, plays: 1 } }, seen: ["intro"], freed: 0, lastIsland: "meadow", settings: {} };
    localStorage.setItem("stillnote-encore-v1", JSON.stringify(save));
  });
  await page.reload();
  await page.waitForFunction(() => window.__encore?.state() === "title", null, { timeout: 60000 });
  await page.click(".title-play", { force: true });
  await page.waitForFunction(() => window.__encore.state() === "map");
  assert.ok((await page.getAttribute('.island-label[data-island="snow"]', "class")).includes("locked"));
  await page.evaluate(() => {
    const a = window.__encore.app;
    a.save.records["arirang|easy|lanes"] = { stars: 1, score: 1, accuracy: 0.6, rank: "C", fullCombo: false, plays: 1 };
    a.refreshMap();
  });
  await page.waitForSelector(".toast.unlock");
  assert.ok(!(await page.getAttribute('.island-label[data-island="snow"]', "class")).includes("locked"));
  assert.deepEqual(errors, []);
  await context.close();
});

await check("fish schools swim beside the road and leap on Perfects", async () => {
  const { page, errors } = await open();
  await enterMap(page);
  await page.evaluate(() => window.__encore.play("arirang", "normal", "lanes"));
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  const start = await page.evaluate(() => {
    const shoals = window.__encore.app.world.shoals;
    window.__splashes = 0;
    const splash = shoals.onSplash;
    shoals.onSplash = (...a) => (window.__splashes++, splash?.(...a));
    window.__encore.autoplay(true);
    const sim = shoals.sim;
    return {
      fish: sim.fish.length,
      meshes: shoals.group.children.map((m) => ({ name: m.name, instanced: !!m.isInstancedMesh, count: m.count })),
      roadHalf: window.__encore.app.stage.roadHalf,
      xs: sim.fish.map((f) => f.x),
    };
  });
  assert.ok([18, 36, 60].includes(start.fish), `fish ${start.fish}`);
  // Meadow: minnows and koi, each species one instanced mesh.
  assert.deepEqual(start.meshes.map((m) => m.name).sort(), ["Fish_Koi", "Fish_Minnow"]);
  assert.ok(start.meshes.every((m) => m.instanced));
  assert.equal(start.meshes.reduce((n, m) => n + m.count, 0), start.fish);
  await page.waitForTimeout(gpu ? 9000 : 15000);
  const after = await page.evaluate(() => {
    const sim = window.__encore.app.world.shoals.sim;
    return { xs: sim.fish.map((f) => f.x), shown: sim.fish.filter((f) => f.show > 0.5).length, splashes: window.__splashes, inner: sim.inner };
  });
  assert.ok(after.xs.some((x, i) => Math.abs(x - start.xs[i]) > 0.5), "fish swim");
  assert.ok(after.xs.every((x) => Math.abs(x) >= after.inner - 1.01), "never under the road");
  assert.ok(after.shown > 0, "some fish are showing");
  assert.ok(after.splashes >= 2, `Perfects made fish leap (${after.splashes} splashes)`);
  assert.deepEqual(errors, []);
});

await check("gameplay frames never go black (bloom NaN guard)", async () => {
  const { page, context, errors } = await open();
  await enterMap(page);
  await page.evaluate(() => window.__encore.play("the-entertainer", "hard", "lanes"));
  await page.waitForFunction(() => window.__encore.state() === "play", null, { timeout: 60000 });
  await page.evaluate(() => window.__encore.autoplay(true));
  let worst = 0;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(300);
    worst = Math.max(worst, await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 72;
      const g = c.getContext("2d");
      g.drawImage(document.querySelector("#scene"), 0, 0, 128, 72);
      const d = g.getImageData(0, 0, 128, 72).data;
      let black = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 12) black++;
      return black / (128 * 72);
    }));
  }
  assert.ok(worst < 0.02, `black fraction ${worst}`);
  assert.deepEqual(errors, []);
  await context.close();
});

await check("the classic studio still loads", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "studio.html");
  await page.waitForSelector("#keyboard .key", { timeout: 30000 });
  assert.ok((await page.locator("#keyboard .key").count()) > 20);
  assert.deepEqual(errors, []);
  await context.close();
});

await check("Vietnamese language switches, persists and fits phone settings", async () => {
  const {page,context,errors}=await open();
  await page.locator('.title-screen [data-language]').selectOption('vi');
  await page.waitForFunction(()=>document.documentElement.lang==='vi');
  assert.equal(await state(page),'title');
  assert.match(await page.locator('.title-play').textContent(),/Chơi/);
  await page.reload();
  await page.waitForFunction(()=>window.__encore?.state()==='title');
  assert.equal(await page.locator('html').getAttribute('lang'),'vi');
  await enterMap(page);
  await page.click('.map-bar [data-act="settings"]');
  assert.match(await page.locator('.settings-screen').textContent(),/Âm lượng nhạc/);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('.settings-screen [name="laneKeys"]').inputValue(),'dfjk');
  await page.screenshot({path: (process.env.TEMP || '.') + '/encore-vietnamese.png'});
  await page.locator('.settings-screen [data-language]').selectOption('en');
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.match(await page.locator('.settings-screen').textContent(),/Music volume/);
  assert.equal(await page.locator('.settings-screen [name="laneKeys"]').inputValue(),'dfjk');
  assert.deepEqual(errors,[]);
  await context.close();
});

await browser.close();
server?.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
