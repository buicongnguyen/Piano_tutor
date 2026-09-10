// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { mountJourney } from "./journey-ui";
import type { Player } from "./audio";
import type { Piece } from "./music";
const piece: Piece = {
  id: "one",
  title: "Small river",
  composer: "Test",
  duration: 2,
  notes: [
    { time: 0, duration: 1, midi: 60, velocity: 0.7 },
    { time: 1, duration: 1, midi: 62, velocity: 0.7 },
  ],
};
function setup(init = () => Promise.resolve()) {
  const player = {
    onManual: new Set<(m: number, d: boolean) => void>(),
    position: 0,
    speed: 1,
    playing: false,
    piece,
    practiceHand: undefined,
    loop: true,
    originalInstruments: true,
    playbackEnd: undefined,
    pause() {
      this.playing = false;
    },
    init,
    loadGrand: () => Promise.resolve(),
    play() {
      this.playing = true;
      return Promise.resolve();
    },
    now() {
      return this.position;
    },
  };
  const library = [piece];
  const select = vi.fn(async () => {});
  const game = mountJourney(player as unknown as Player, library, select);
  game.setPiece(piece);
  const emit = (m: number, d: boolean) =>
    player.onManual.forEach((f) => f(m, d));
  return { game, player, library, select, emit };
}
const click = (s: string) =>
  (document.querySelector(s) as HTMLButtonElement).click();
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
  }));
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    clear: () => data.clear(),
    get length() {
      return data.size;
    },
  });
  localStorage.clear();
  document.body.innerHTML =
    '<section class="keyboard-section"><div class="sound"><button>Sound</button></div><div class="transport"><button id="play">Play</button></div></section>';
});
describe("journey interaction lifecycle", () => {
  it("keeps a Learn chord at its gate until every key has been released", async () => {
    const { game, player, emit } = setup();
    game.setPiece({
      ...piece,
      notes: [
        { time: 0, duration: 1, midi: 60, velocity: 0.7, hand: "right" },
        { time: 0, duration: 1, midi: 64, velocity: 0.7, hand: "right" },
        { time: 1, duration: 1, midi: 67, velocity: 0.7, hand: "right" },
      ],
    });
    click('[data-mode="learn"]');
    click("#journey-start");
    await flush();
    emit(60, true);
    emit(64, true);
    emit(60, false);
    emit(67, true);
    emit(67, false);
    expect(player.position).toBe(0);
    emit(64, false);
    expect(player.position).toBe(1);
    expect(game.active).toBe(true);
    emit(67, true);
    emit(67, false);
    expect(game.active).toBe(false);
  });
  it("Perform grants a final release window but gives no hold credit to unreleased keys", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const { game, player, emit } = setup();
    click('[data-mode="perform"]');
    click("#journey-start");
    await flush();
    clock.mockReturnValue(2100);
    game.frame();
    await flush();
    emit(60, true);
    player.position = 1;
    emit(60, false);
    emit(62, true);
    player.position = 2;
    game.frame();
    expect(game.active).toBe(true);
    player.position = 2.36;
    game.frame();
    expect(game.active).toBe(false);
    expect(document.querySelector("#journey-result p")!.textContent).toContain(
      "holds 50%",
    );
    expect(player.piece).toBe(piece);
    clock.mockRestore();
  });
  it("ignores a stale playback rejection after a new Learn challenge starts", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const { game, player } = setup();
    let reject!: (reason: Error) => void;
    player.play = () =>
      new Promise<void>((_, r) => {
        reject = r;
      });
    click('[data-mode="perform"]');
    click("#journey-start");
    await flush();
    clock.mockReturnValue(2100);
    game.frame();
    click('[data-mode="learn"]');
    click("#journey-start");
    await flush();
    reject(new Error("old request"));
    await flush();
    expect(game.active).toBe(true);
    game.cancel();
    clock.mockRestore();
  });
  it("requires all Learn notes and releases, saves completion, restores controls", async () => {
    const { game, player, emit } = setup();
    click('[data-mode="learn"]');
    click("#journey-start");
    await flush();
    expect(game.active).toBe(true);
    document
      .querySelector("#journey-start")!
      .dispatchEvent(new FocusEvent("blur"));
    expect(game.active).toBe(true);
    emit(65, true);
    emit(65, false);
    expect(
      document.querySelector("#journey-result")!.hasAttribute("hidden"),
    ).toBe(true);
    emit(60, true);
    emit(60, false);
    emit(62, true);
    expect(game.active).toBe(true);
    emit(62, false);
    expect(game.active).toBe(false);
    expect(document.querySelector("#journey-result p")!.textContent).toContain(
      "Phrase learned",
    );
    expect(player.loop).toBe(true);
    expect(player.originalInstruments).toBe(true);
    expect(
      (document.querySelector("#play") as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(localStorage.getItem("stillnote-journey-v1")).toContain(
      '"learned":true',
    );
  });
  it("cancels a pending audio start without progress or stale activation", async () => {
    let resolve!: () => void;
    const { game } = setup(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    click('[data-mode="learn"]');
    click("#journey-start");
    game.cancel();
    resolve();
    await flush();
    expect(game.busy).toBe(false);
    expect(localStorage.length).toBe(0);
  });
  it("keeps destination values stable when internet music is added", () => {
    const { game, library, select } = setup();
    library.unshift({ ...piece, id: "two", title: "Other" });
    game.refreshRoutes();
    const route = document.querySelector<HTMLSelectElement>("#journey-route")!;
    expect(route.value).toBe("one");
    route.dispatchEvent(new Event("change"));
    expect(select).toHaveBeenCalledWith(piece);
  });
});
