import { parseMidi, type Piece } from "./music";

export const repertoire = [
  {
    file: "gymnopedie-no-1.mid",
    title: "Gymnopédie No. 1",
    composer: "Erik Satie",
    id: 37,
    sheet: "gymnopedie-no-1.pdf",
    edition: "Evin Robertson · Mutopia · Public domain",
  },
  {
    file: "fur-elise.mid",
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    id: 931,
    sheet: "fur-elise.pdf",
    edition: "Stelios Samelis · Mutopia · Public domain",
  },
  {
    file: "clair-de-lune.mid",
    title: "Clair de lune",
    composer: "Claude Debussy",
    id: 1778,
    sheet: "clair-de-lune.pdf",
    edition: "Keith OHara · Mutopia · Public domain",
  },
  {
    file: "the-entertainer.mid",
    title: "The Entertainer",
    composer: "Scott Joplin",
    id: 263,
    sheet: "the-entertainer.pdf",
    edition: "Chris Sawer · Mutopia · Public domain",
  },
  {
    file: "nocturne-op9-no2.mid",
    title: "Nocturne Op. 9 No. 2",
    composer: "Frédéric Chopin",
    id: 1590,
    sheet: "nocturne-op9-no2.pdf",
    edition: "Renato Biolcati Rinaldi · Mutopia · CC BY-SA 3.0",
  },
  {
    file: "moonlight-1.mid",
    title: "Moonlight Sonata · I. Adagio sostenuto",
    composer: "Ludwig van Beethoven",
    id: 276,
    sheet: "moonlight-sonata.pdf",
    edition: "Stewart Holmes · Mutopia · CC BY-SA 2.5",
  },
  {
    file: "moonlight-2.mid",
    title: "Moonlight Sonata · II. Allegretto",
    composer: "Ludwig van Beethoven",
    id: 276,
    sheet: "moonlight-sonata.pdf",
    edition: "Stewart Holmes · Mutopia · CC BY-SA 2.5",
  },
  {
    file: "moonlight-3.mid",
    title: "Moonlight Sonata · III. Presto agitato",
    composer: "Ludwig van Beethoven",
    id: 276,
    sheet: "moonlight-sonata.pdf",
    edition: "Stewart Holmes · Mutopia · CC BY-SA 2.5",
  },
];
export async function loadRepertoire(): Promise<{
  pieces: Piece[];
  failures: number;
}> {
  const results = await Promise.allSettled(
    repertoire.map(async (item) => {
      const fileUrl = `${import.meta.env.BASE_URL}music/${item.file}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw Error(`Could not load ${item.title}`);
      const piece = parseMidi(await response.arrayBuffer(), item.title);
      return {
        ...piece,
        title: item.title,
        composer: item.composer,
        warning:
          "Complete Mutopia MIDI edition · notation-generated timing, not a live performance.",
        source: {
          url: `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${item.id}`,
          sheetUrl: `${import.meta.env.BASE_URL}music/${item.sheet}`,
          fileUrl,
          edition: item.edition,
        },
      };
    }),
  );
  return {
    pieces: results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    failures: results.filter((r) => r.status === "rejected").length,
  };
}
