// Loads the Piece behind a stage (bundled MIDI or original exercise), with a cache.
import { morningLight, roomToBreathe } from "../exercises";
import { parseMidi, type Piece } from "../music";
import { repertoire } from "../repertoire";
import type { SongRef, Stage } from "./campaign";

const cache = new Map<string, Promise<Piece>>();

export function songKey(ref: SongRef) {
  return "file" in ref ? ref.file : ref.exercise;
}

export function pieceFromBytes(ref: SongRef, bytes: ArrayBuffer, stage?: Stage): Piece {
  if (!("file" in ref)) throw Error("Not a MIDI song");
  const e = repertoire.find((r) => r.file === ref.file);
  const piece = parseMidi(bytes, stage?.title ?? e?.title ?? ref.file);
  return {
    ...piece,
    id: ref.file,
    title: stage?.title ?? e?.title ?? piece.title,
    composer: e?.composer ?? piece.composer,
    source: e
      ? {
          url: e.url ?? `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${e.id}`,
          fileUrl: `${import.meta.env.BASE_URL}music/${e.file}`,
          sheetUrl: e.sheet ? `${import.meta.env.BASE_URL}music/${e.sheet}` : undefined,
          edition: e.edition,
        }
      : undefined,
  };
}

export function loadSong(stage: Stage): Promise<Piece> {
  const key = songKey(stage.song);
  let pending = cache.get(key);
  if (!pending) {
    const ref = stage.song;
    pending =
      "exercise" in ref
        ? Promise.resolve({
            ...(ref.exercise === "morning-light" ? morningLight() : roomToBreathe()),
            id: ref.exercise,
            title: stage.title,
            composer: stage.composer,
          })
        : fetch(`${import.meta.env.BASE_URL}music/${ref.file}`).then(async (response) => {
            if (!response.ok) throw Error(`Could not load ${stage.title}`);
            return pieceFromBytes(ref, await response.arrayBuffer(), stage);
          });
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/** Register an imported score as a playable stage. */
export function importedStage(piece: Piece): { stage: Stage; piece: Piece } {
  // Hash the whole key (file name + size) so similar names never collide.
  let h = 2166136261;
  for (let i = 0; i < piece.id.length; i++) h = Math.imul(h ^ piece.id.charCodeAt(i), 16777619);
  const id = "my-" + (h >>> 0).toString(36);
  const stage: Stage = {
    id,
    song: { file: `${id}.mid` },
    title: piece.title,
    composer: piece.composer,
    blurb: "Your own score, charted automatically.",
  };
  cache.set(songKey(stage.song), Promise.resolve(piece));
  return { stage, piece };
}
