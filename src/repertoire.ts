import { parseMidi, type Piece } from "./music";

type Edition = {
  file: string;
  title: string;
  composer: string;
  edition: string;
  id?: number;
  url?: string;
  sheet?: string;
  tags?: string;
  warning?: string;
  ensemble?: boolean;
};
export const repertoire: Edition[] = [
  {
    file: "silent-night.mid",
    title: "Silent Night · Stille Nacht",
    composer: "Franz Xaver Gruber",
    id: 521,
    sheet: "silent-night.pdf",
    tags: "Christmas holiday carol Noel Giáng sinh 크리스마스",
    edition: "D. Widyanto · Mutopia · CC BY-SA 2.0",
    warning:
      "Complete guitar arrangement, one stanza · original MIDI timing and guitar voice retained.",
  },
  {
    file: "o-come-all-ye-faithful.mid",
    title: "O Come, All Ye Faithful · Adeste Fideles",
    composer: "John Francis Wade",
    id: 367,
    sheet: "o-come-all-ye-faithful.pdf",
    tags: "Christmas holiday carol Noel Giáng sinh 크리스마스",
    edition: "Matt Corks · Mutopia · Public domain",
    warning:
      "Complete SATB hymn setting, one stanza · enable Original MIDI instruments for choir voices.",
  },
  {
    file: "arirang.mid",
    title: "Arirang · 아리랑",
    composer: "Korean traditional",
    url: "https://en.wikipedia.org/wiki/Arirang",
    tags: "Korea Korean folk traditional 한국 민요",
    edition:
      "Wikipedia score contributors · Stillnote melody transcription · CC BY-SA 4.0",
    warning:
      "Traditional melody, one complete 16-bar verse in 9/8. Generated sheet is an approximate 4/4 guide; source has original notation.",
  },
  {
    file: "tien-quan-ca.mid",
    title: "Tiến quân ca · Vietnam anthem",
    composer: "Văn Cao",
    url: "https://nationalanthems.info/vn.htm",
    sheet: "tien-quan-ca.gif",
    tags: "Vietnam Vietnamese Việt Nam national anthem quốc ca",
    edition:
      "nationalanthems.info · Stillnote melody transcription · CC BY 4.0",
    warning:
      "Melody-only transcription with the written repeat and both endings. Source sheet includes accompaniment; this edition plays the upper melody.",
  },
  {
    file: "star-spangled-banner.mid",
    title: "The Star-Spangled Banner · US anthem",
    composer: "John Stafford Smith",
    url: "https://commons.wikimedia.org/wiki/File:2_Star_Spangled_Banner.mid",
    tags: "USA US United States American national anthem Mỹ",
    edition: "Hyacinth · Wikimedia Commons · Public domain",
    warning:
      "Complete one-verse melody MIDI · original timing retained; generated sheet is an approximate practice guide.",
  },
  {
    file: "aegukga.mid",
    title: "Aegukga · 애국가 · South Korea anthem",
    composer: "Ahn Eak-tae",
    url: "https://nationalanthems.info/kr.htm",
    sheet: "aegukga.gif",
    tags: "Korea Korean national anthem 한국 대한민국 국가",
    edition:
      "nationalanthems.info · Stillnote melody transcription · CC BY 4.0",
    warning:
      "Melody-only transcription, one verse and chorus at 88 BPM. Piano introduction and accompaniment omitted; original sheet available.",
  },
  {
    file: "katana-a1_listen_first.mid",
    title: "A1 Listen First · Independent original",
    composer: "Katana",
    url: "https://opengameart.org/content/action-music-collection",
    tags: "pop rock synth electronic modern CC0",
    edition: "Katana · OpenGameArt action music collection · CC0 1.0",
    warning:
      "Full source MIDI from a pop/rock/synth collection. Pitched parts play with Original MIDI instruments; drum-channel parts are not rendered by this piano app. Hand practice unavailable.",
  },
  {
    file: "katana-action_title.mid",
    title: "Action Title · Independent original",
    composer: "Katana",
    url: "https://opengameart.org/content/action-music-collection",
    tags: "pop rock synth electronic modern CC0",
    edition: "Katana · OpenGameArt action music collection · CC0 1.0",
    warning:
      "Short original theme from a pop/rock/synth collection. Pitched parts play with Original MIDI instruments; drum-channel parts are not rendered by this piano app. Hand practice unavailable.",
  },
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
  {
    file: "maple-leaf-rag.mid",
    title: "Maple Leaf Rag",
    composer: "Scott Joplin",
    id: 23,
    sheet: "maple-leaf-rag.pdf",
    edition: "Chris Sawer · Mutopia · Public domain",
  },
  {
    file: "arabesque-no-1.mid",
    title: "Arabesque No. 1",
    composer: "Claude Debussy",
    id: 1777,
    sheet: "arabesque-no-1.pdf",
    edition: "Keith OHara · Mutopia · Public domain",
  },
  {
    file: "prelude-kumar.mid",
    title: "Prelude (2005)",
    composer: "Ramana Kumar",
    id: 657,
    sheet: "prelude-kumar.pdf",
    edition: "Ramana Kumar · Contemporary original · Mutopia · CC BY-SA 3.0",
  },
  {
    file: "flat-kumar.mid",
    title: "Flat (2007)",
    composer: "Ramana Kumar",
    id: 1004,
    sheet: "flat-kumar.pdf",
    edition: "Ramana Kumar · Contemporary original · Mutopia · CC BY-SA 3.0",
  },
  {
    file: "variations-automne.mid",
    title: "Variations d’automne (2007)",
    composer: "Stéphane Magnenat",
    id: 973,
    sheet: "variations-automne.pdf",
    edition:
      "Stéphane Magnenat · Contemporary original · Mutopia · CC BY-SA 3.0",
  },
  {
    file: "canon-in-d.mid",
    title: "Canon in D · Ensemble score",
    composer: "Johann Pachelbel",
    id: 2047,
    sheet: "canon-in-d.pdf",
    edition: "Michael Fischer v. Mollard · Mutopia · CC BY 4.0",
    ensemble: true,
  },
  {
    file: "spring-1.mid",
    title: "The Four Seasons · Spring I. Allegro",
    composer: "Antonio Vivaldi",
    id: 301,
    sheet: "spring.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "spring-2.mid",
    title: "The Four Seasons · Spring II. Largo",
    composer: "Antonio Vivaldi",
    id: 301,
    sheet: "spring.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "spring-3.mid",
    title: "The Four Seasons · Spring III. Danza Pastorale",
    composer: "Antonio Vivaldi",
    id: 301,
    sheet: "spring.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "summer-1.mid",
    title: "The Four Seasons · Summer I. Allegro non molto",
    composer: "Antonio Vivaldi",
    id: 336,
    sheet: "summer.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "summer-2.mid",
    title: "The Four Seasons · Summer II. Adagio",
    composer: "Antonio Vivaldi",
    id: 336,
    sheet: "summer.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "summer-3.mid",
    title: "The Four Seasons · Summer III. Presto",
    composer: "Antonio Vivaldi",
    id: 336,
    sheet: "summer.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "autumn-1.mid",
    title: "The Four Seasons · Autumn I. Allegro",
    composer: "Antonio Vivaldi",
    id: 350,
    sheet: "autumn.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "autumn-2.mid",
    title: "The Four Seasons · Autumn II. Adagio molto",
    composer: "Antonio Vivaldi",
    id: 350,
    sheet: "autumn.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "autumn-3.mid",
    title: "The Four Seasons · Autumn III. Allegro",
    composer: "Antonio Vivaldi",
    id: 350,
    sheet: "autumn.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "winter-1.mid",
    title: "The Four Seasons · Winter I. Allegro non molto",
    composer: "Antonio Vivaldi",
    id: 351,
    sheet: "winter.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "winter-2.mid",
    title: "The Four Seasons · Winter II. Largo",
    composer: "Antonio Vivaldi",
    id: 351,
    sheet: "winter.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
  },
  {
    file: "winter-3.mid",
    title: "The Four Seasons · Winter III. Allegro",
    composer: "Antonio Vivaldi",
    id: 351,
    sheet: "winter.pdf",
    edition: "Anonymous · Mutopia · CC BY-SA 3.0 · Ensemble score",
    ensemble: true,
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
        tags: item.tags,
        warning:
          item.warning ??
          (item.ensemble
            ? "Ensemble score: enable Original MIDI instruments for the written voices. Not a two-hand piano arrangement; hand practice unavailable. Source MIDI timing retained."
            : "Complete Mutopia MIDI edition · notation-generated timing, not a live performance."),
        source: {
          url:
            item.url ??
            `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${item.id}`,
          sheetUrl: item.sheet
            ? `${import.meta.env.BASE_URL}music/${item.sheet}`
            : undefined,
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
