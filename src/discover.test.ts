import { describe, it, expect } from "vitest";
import { findDiscoverSongs } from "./discover";
describe("song discovery", () => {
  it("finds artist and pop searches without pretending the songs are playable", () => {
    expect(findDiscoverSongs("adele").map((s) => s.title)).toEqual([
      "Someone Like You",
      "Rolling in the Deep",
    ]);
    expect(findDiscoverSongs("maroon 5").map((s) => s.title)).toEqual([
      "Memories",
      "Girls Like You",
    ]);
    expect(findDiscoverSongs("pop")).toHaveLength(4);
    expect(findDiscoverSongs("Rivers flow in you")[0].artist).toBe("Yiruma");
    expect(findDiscoverSongs("Alan Walker")[0].title).toBe("Faded");
    expect(findDiscoverSongs("electronic")[0].title).toBe("Faded");
    expect(findDiscoverSongs("not a real song")).toHaveLength(0);
    expect(
      findDiscoverSongs("").every(
        (s) => s.url.startsWith("https://") && !("file" in s),
      ),
    ).toBe(true);
  });
});
