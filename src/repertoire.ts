import { parseMidi, type Piece } from "./music";

export const repertoire = [
  {
    file: "gymnopedie-no-1.mid",
    title: "Gymnopédie No. 1",
    composer: "Erik Satie",
    id: 37,
    sheet:
      "https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1-a4.pdf",
    edition: "Evin Robertson · Mutopia · Public domain",
  },
  {
    file: "fur-elise.mid",
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    id: 931,
    sheet:
      "https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/fur_Elise_WoO59-a4.pdf",
    edition: "Stelios Samelis · Mutopia · Public domain",
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
          sheetUrl: item.sheet,
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
