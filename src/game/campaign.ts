// The Encore campaign: nine sky islands, their stages and the star gates
// between them. Songs are the bundled MIDI editions (see src/repertoire.ts and
// public/music/SOURCES.md) plus the two original Stillnote exercises.
import { repertoire } from "../repertoire";

export type ThemeId =
  | "meadow"
  | "snow"
  | "festival"
  | "pier"
  | "garden"
  | "neon"
  | "harbour"
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "crown";

export type SongRef = { file: string } | { exercise: "morning-light" | "room-to-breathe" };

export type Stage = {
  id: string;
  song: SongRef;
  title: string;
  composer: string;
  theme?: ThemeId; // overrides the island theme (Season Wheel)
  blurb: string;
};

export type Island = {
  id: string;
  name: string;
  tagline: string;
  theme: ThemeId;
  gate: number; // total stars needed to open
  map: [number, number]; // map position (x, z)
  keeper: string; // who greets you there
  stages: Stage[];
};

const edition = (file: string) => {
  const e = repertoire.find((r) => r.file === file);
  if (!e) throw Error(`Unknown song ${file}`);
  return e;
};
const shortTitle = (t: string) => t.replace(/ · .*$/, "");
const song = (file: string, blurb: string, extra: Partial<Stage> = {}): Stage => {
  const e = edition(file);
  return {
    id: file.replace(/\.mid$/, "").replace(/_/g, "-"),
    song: { file },
    title: extra.title ?? shortTitle(e.title),
    composer: e.composer,
    blurb,
    ...extra,
  };
};

export const islands: Island[] = [
  {
    id: "meadow",
    name: "Dawn Meadow",
    tagline: "Where the first note wakes up.",
    theme: "meadow",
    gate: 0,
    map: [-46, 34],
    keeper: "Miller Juniper",
    stages: [
      {
        id: "morning-light",
        song: { exercise: "morning-light" },
        title: "Morning Light",
        composer: "Stillnote original",
        blurb: "Your very first flight. A bright melody over warm chords.",
      },
      {
        id: "room-to-breathe",
        song: { exercise: "room-to-breathe" },
        title: "A Little Room to Breathe",
        composer: "Stillnote original",
        blurb: "Slow and gentle. Feel each note land.",
      },
      song("arirang.mid", "A mountain-pass folk song that everyone in the meadow hums.", {
        title: "Arirang",
      }),
    ],
  },
  {
    id: "snow",
    name: "Starlight Snow Village",
    tagline: "Warm windows, frozen carols.",
    theme: "snow",
    gate: 4,
    map: [-20, 50],
    keeper: "Grandma Pinecone",
    stages: [
      song("silent-night.mid", "A lullaby carol, lit by every window in the village.", {
        title: "Silent Night",
      }),
      song("o-come-all-ye-faithful.mid", "The whole choir, all at once. Keep the chords marching.", {
        title: "O Come, All Ye Faithful",
      }),
    ],
  },
  {
    id: "festival",
    name: "Festival Hills",
    tagline: "A thousand lanterns waiting for a song.",
    theme: "festival",
    gate: 8,
    map: [8, 40],
    keeper: "Lantern-maker Bo",
    stages: [
      song("aegukga.mid", "A stately anthem to raise the first lantern.", { title: "Aegukga" }),
      song("tien-quan-ca.mid", "A marching song. Chin up, keep the rhythm proud.", {
        title: "Tiến quân ca",
      }),
      song("star-spangled-banner.mid", "Big leaps, bigger fireworks.", {
        title: "The Star-Spangled Banner",
      }),
    ],
  },
  {
    id: "pier",
    name: "Ragtime Pier",
    tagline: "The carnival that forgot how to swing.",
    theme: "pier",
    gate: 13,
    map: [36, 22],
    keeper: "Captain Fizz",
    stages: [
      song("the-entertainer.mid", "Syncopation! Notes that land just off the beat."),
      song("maple-leaf-rag.mid", "The king of rags. Quick hands, big grin."),
    ],
  },
  {
    id: "garden",
    name: "Glasshouse Gardens",
    tagline: "A conservatory of sleeping flowers.",
    theme: "garden",
    gate: 18,
    map: [50, -6],
    keeper: "Professor Marigold",
    stages: [
      song("fur-elise.mid", "The most famous little piece in the world."),
      song("arabesque-no-1.mid", "Rippling triplets like water in a fountain."),
      song("gymnopedie-no-1.mid", "Slow, floating, patient. Let it breathe."),
      song("prelude-kumar.mid", "A modern prelude that blooms in the sunlight."),
      song("variations-automne.mid", "Autumn variations on a quiet theme."),
      song("flat-kumar.mid", "A long, winding contemporary piece. The gardens' final door."),
    ],
  },
  {
    id: "neon",
    name: "Neon Reef",
    tagline: "A synth lagoon where the lights went dark.",
    theme: "neon",
    gate: 26,
    map: [34, -32],
    keeper: "DJ Axolotl",
    stages: [
      song("katana-a1_listen_first.mid", "Pop-rock energy. Hit it and the reef lights up.", {
        title: "A1 Listen First",
      }),
      song("katana-action_title.mid", "A short action theme. Short, sharp and loud.", {
        title: "Action Title",
      }),
    ],
  },
  {
    id: "harbour",
    name: "Moonlit Harbour",
    tagline: "The lighthouse that lost its tune.",
    theme: "harbour",
    gate: 32,
    map: [4, -46],
    keeper: "Keeper Nell",
    stages: [
      song("moonlight-1.mid", "Moonlight on still water. Slow triplets, soft hands.", {
        title: "Moonlight Sonata I",
      }),
      song("clair-de-lune.mid", "Moonlight in French. Drift with it."),
      song("nocturne-op9-no2.mid", "A night song full of ornaments and sighs.", {
        title: "Nocturne Op. 9 No. 2",
      }),
      song("moonlight-2.mid", "A gentle dance between two storms.", {
        title: "Moonlight Sonata II",
      }),
      song("moonlight-3.mid", "The storm. Fast, furious and very bright.", {
        title: "Moonlight Sonata III",
      }),
    ],
  },
  {
    id: "seasons",
    name: "Season Wheel",
    tagline: "Four isles, four seasons, one great wheel.",
    theme: "spring",
    gate: 40,
    map: [-28, -36],
    keeper: "The Season Sisters",
    stages: (
      [
        ["spring", "Spring"],
        ["summer", "Summer"],
        ["autumn", "Autumn"],
        ["winter", "Winter"],
      ] as const
    ).flatMap(([season, name]) =>
      [1, 2, 3].map((movement) =>
        song(
          `${season}-${movement}.mid`,
          `${name}, movement ${["I", "II", "III"][movement - 1]}. Vivaldi's strings play along with you.`,
          { title: `${name} ${["I", "II", "III"][movement - 1]}`, theme: season },
        ),
      ),
    ),
  },
  {
    id: "crown",
    name: "Carillon Crown",
    tagline: "The Hush's castle above the clouds.",
    theme: "crown",
    gate: 60,
    map: [-52, -4],
    keeper: "The Hush",
    stages: [
      song("canon-in-d.mid", "Everyone you met plays together. The last song of the journey.", {
        title: "Canon in D",
      }),
    ],
  },
];

export const allStages = islands.flatMap((island) =>
  island.stages.map((stage) => ({ island, stage })),
);

export function findStage(id: string) {
  return allStages.find((s) => s.stage.id === id);
}

const campaignIds = new Set(allStages.map((s) => s.stage.id));

/** Campaign stars only: imported songs never open islands or skins. */
export function totalStars(best: Record<string, number>) {
  return Object.entries(best).reduce(
    (s, [id, n]) => s + (campaignIds.has(id) ? Math.max(0, Math.min(3, n || 0)) : 0),
    0,
  );
}

export function islandOpen(island: Island, stars: number, openAll = false) {
  return openAll || stars >= island.gate;
}

/** The next island the player hasn't opened yet, for "N more stars" hints. */
export function nextGate(stars: number) {
  return islands.find((i) => i.gate > stars);
}

/** An island is restored once every stage on it has at least one star. */
export function islandRestored(island: Island, best: Record<string, number>) {
  return island.stages.every((s) => (best[s.id] ?? 0) >= 1);
}

export function islandStars(island: Island, best: Record<string, number>) {
  return island.stages.reduce((s, st) => s + Math.min(3, best[st.id] ?? 0), 0);
}
