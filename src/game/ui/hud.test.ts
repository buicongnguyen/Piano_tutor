// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { Hud, streakMilestone } from "./hud";

it("restarts feedback without synchronous layout reads", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const hud = new Hud(host);
  const layout = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(() => { throw Error("forced layout"); });
  try {
    const state = { score: 300, combo: 10, multiplier: 2, harmony: 0.5, encore: 0.2, encoreActive: false, progress: 0.1, stars: 3, waiting: false, hint: "" };
    for (let i = 0; i < 30; i++) { hud.judgement("perfect", 100, 200, 0); hud.update({ ...state, score: i * 300, combo: i + 10 }); }
    const combo = host.querySelector<HTMLElement>('[data-el="comboNum"]')!;
    const before = combo.style.animationName;
    hud.update({ ...state, combo: 40 });
    expect(combo.style.animationName).not.toBe(before);
    hud.countdown("3"); hud.countdown("2");
    hud.intro("Song", "Island"); hud.milestone(50); hud.hint("Next");
    expect(layout).not.toHaveBeenCalled();
    expect(host.querySelectorAll('.hud-pop.go')).toHaveLength(14);
  } finally { layout.mockRestore(); host.remove(); }
});

const initial = { score: 0, combo: 0, multiplier: 1, harmony: 0.5, encore: 0, encoreActive: false, progress: 0, stars: 3, waiting: false, hint: "" };
const info = { title: "Song", difficulty: "normal", mode: "tap", practice: false, lanes: 2, notes: 100, excerpt: false, assisted: 0, touch: true };

it("shows the first hit, celebrates crossed milestones once, and resets on a broken streak or retry", () => {
  const host = document.createElement("div");
  const hud = new Hud(host);
  const milestone = vi.spyOn(hud, "milestone");
  hud.begin(info);
  const counter = host.querySelector<HTMLElement>('[data-el="combo"]')!;
  const number = host.querySelector('[data-el="comboNum"]')!;
  hud.update({ ...initial, combo: 1 });
  expect(counter.classList.contains("show")).toBe(true);
  expect(number.textContent).toBe("1");
  hud.update({ ...initial, combo: 9 });
  hud.update({ ...initial, combo: 11 }); // a chord can cross a milestone in one frame
  hud.update({ ...initial, combo: 11 });
  expect(milestone.mock.calls).toEqual([[10]]);
  hud.update({ ...initial, combo: 25 });
  expect(counter.dataset.tier).toBe("2");
  expect(host.querySelector('[data-el="streakTag"]')!.textContent).toBe("ON FIRE!");
  hud.update(initial);
  expect(counter.classList.contains("show")).toBe(false);
  expect(number.textContent).toBe("0");
  hud.update({ ...initial, combo: 10 });
  expect(milestone.mock.calls).toEqual([[10], [25], [10]]);
  hud.begin(info);
  expect(counter.classList.contains("show")).toBe(false);
  expect(number.textContent).toBe("0");
  expect(counter.dataset.tier).toBe("0");
  expect(host.querySelector('.streak-ring')!.classList.contains("go")).toBe(false);
});

it("continues celebrations past 100 without counting every frame as a milestone", () => {
  expect([0, 1, 9, 10, 24, 25, 49, 50, 99, 100, 149, 150, 200].map(streakMilestone))
    .toEqual([0, 0, 0, 10, 10, 25, 25, 50, 50, 100, 100, 150, 200]);
});


it("renders the judge's star count and resets the game's motion preference between runs", () => {
  const host = document.createElement("div");
  const hud = new Hud(host);
  hud.begin({ ...info, reducedMotion: true });
  expect(hud.root.classList.contains("reduced-motion")).toBe(true);
  hud.update({ ...initial, progress: 0.5, stars: 1 });
  expect(host.querySelectorAll("[data-star].lit")).toHaveLength(1);
  hud.update({ ...initial, progress: 0.5, stars: 0 });
  expect(host.querySelectorAll("[data-star].lit")).toHaveLength(0);
  hud.begin(info);
  expect(hud.root.classList.contains("reduced-motion")).toBe(false);
});
