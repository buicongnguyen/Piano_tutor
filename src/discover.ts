import { musicMatches } from "./collection";

// Metadata and retailer links only; no song data is bundled.
export const discoverSongs = [
  {
    title: "River Flows in You",
    artist: "Yiruma",
    tags: "contemporary piano",
    url: "https://synthesia.app/store/Song/11",
    sourceLabel: "Licensed MIDI at Synthesia",
    detail:
      "Piano MIDI source. Purchase availability depends on region; import your file to play and generate sheet music.",
  },
  {
    title: "Faded",
    artist: "Alan Walker",
    tags: "electronic EDM dance",
    url: "https://www.midi.com.au/alan-walker/faded-midi/",
    sourceLabel: "Licensed MIDI at Hit Trax",
    detail:
      "Paid MIDI backing track. Import your file and enable Original MIDI instruments for its arrangement.",
  },
  {
    title: "Someone Like You",
    artist: "Adele",
    tags: "pop piano ballad",
    url: "https://synthesiagame.com/store/Song/3",
    sourceLabel: "MIDI at Synthesia",
    detail:
      "Paid piano MIDI with melody, plus an accompaniment version. Store lists US licensing; check availability in your region.",
  },
  {
    title: "Rolling in the Deep",
    artist: "Adele",
    tags: "pop piano",
    url: "https://synthesiagame.com/store/Song/37",
    sourceLabel: "MIDI at Synthesia",
    detail:
      "Paid piano MIDI with backing instruments. Store lists US licensing; check availability in your region.",
  },
  {
    title: "Memories",
    artist: "Maroon 5",
    tags: "pop ballad",
    url: "https://www.midi.com.au/maroon-5/memories-midi/",
    sourceLabel: "MIDI at Hit Trax",
    detail: "Paid full-band MIDI backing track, not a solo-piano arrangement.",
  },
  {
    title: "Girls Like You",
    artist: "Maroon 5",
    tags: "pop",
    url: "https://www.midi.com.au/maroon-5/girls-like-you-midi/",
    sourceLabel: "MIDI at Hit Trax",
    detail: "Paid full-band MIDI backing track, not a solo-piano arrangement.",
  },
];

export function findDiscoverSongs(query: string) {
  return discoverSongs.filter((song) =>
    musicMatches(song.title, song.artist + " " + song.tags, query),
  );
}
