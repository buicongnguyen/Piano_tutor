import { exercise, parseXml, type Piece } from "./music";

// Original Stillnote exercises, shared by the classic studio and Encore.

/** Morning light: a right-hand melody over sustained left-hand chords (two staves). */
export function morningLight(): Piece {
  const base = exercise(
    "Morning light",
    [
      60, 64, 67, 72, 71, 67, 64, 62, 60, 65, 69, 72, 74, 69, 65, 62, 59, 62, 67, 71, 74, 71, 67,
      62, 60, 64, 67, 72, 67, 64, 62, 60,
    ],
    84,
  );
  // Two independent staves: sustained left-hand chords under the right-hand melody.
  let duet = base.xml!.replace("<staves>2</staves>", "");
  duet = duet
    .replace("<clef>", '<staves>2</staves><clef number="1">')
    .replace("</clef>", '</clef><clef number="2"><sign>F</sign><line>4</line></clef>');
  let measure = 0;
  duet = duet.replace(/<\/measure>/g, () => {
    const roots = [48, 53, 43, 48, 48, 53, 43, 48];
    const root = roots[measure++];
    return `<backup><duration>4</duration></backup>${[root, root + 7]
      .map(
        (m, i) =>
          `<note>${i ? "<chord/>" : ""}<pitch><step>${["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"][m % 12]}</step><octave>${Math.floor(m / 12) - 1}</octave></pitch><duration>4</duration><voice>2</voice><type>whole</type><staff>2</staff></note>`,
      )
      .join("")}</measure>`;
  });
  return parseXml(duet);
}

/** A little room to breathe: a gentle one-hand melody study. */
export function roomToBreathe(): Piece {
  return exercise(
    "A little room to breathe",
    [64, 67, 69, 67, 62, 65, 69, 65, 60, 64, 67, 64, 59, 62, 67, 62],
    72,
  );
}
