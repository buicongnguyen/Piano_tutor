// Contour lane mapping for the arcade chart: melody pitches become N lanes so a
// laptop or phone player can feel the tune's shape. Rising pitch moves right,
// falling moves left, repeated pitch stays put, and each passage is normalised
// to its local range so the whole width of the road gets used.

export type LaneGroup = { pitches: number[] }; // one onset: melody note plus chord tones

const WINDOW = 6; // groups either side used for the local range

export function contourLanes(groups: LaneGroup[], lanes: number): number[][] {
  const tops = groups.map((g) => Math.max(...g.pitches));
  const out: number[][] = [];
  let prevLane = Math.floor((lanes - 1) / 2);
  for (let i = 0; i < groups.length; i++) {
    const p = tops[i];
    const around = tops.slice(Math.max(0, i - WINDOW), i + WINDOW + 1);
    const lo = Math.min(...around),
      hi = Math.max(...around);
    let lane: number;
    if (hi - lo <= lanes - 1) {
      // Narrow passage: one semitone step per lane, centred in the road.
      const offset = Math.round((lanes - 1 - (hi - lo)) / 2);
      lane = p - lo + offset;
    } else lane = Math.round(((p - lo) / (hi - lo)) * (lanes - 1));
    if (i > 0) {
      const prev = tops[i - 1];
      if (p === prev) lane = prevLane;
      else if (p > prev && lane <= prevLane) lane = Math.min(lanes - 1, prevLane + 1);
      else if (p < prev && lane >= prevLane) lane = Math.max(0, prevLane - 1);
      // A step (1–2 semitones) should look like a step, not a leap.
      const interval = Math.abs(p - prev);
      const maxJump = interval <= 2 ? 1 : interval <= 5 ? 2 : lanes;
      if (Math.abs(lane - prevLane) > maxJump)
        lane = prevLane + Math.sign(lane - prevLane) * maxJump;
    }
    lane = Math.max(0, Math.min(lanes - 1, lane));
    prevLane = lane;
    out.push(chordLanes(groups[i].pitches, lane, lanes));
  }
  return out;
}

// The top pitch takes `top`; lower chord tones take distinct lanes to its left,
// shifting the whole shape right if it would fall off the road.
export function chordLanes(pitches: number[], top: number, lanes: number): number[] {
  const sorted = [...new Set(pitches)].sort((a, b) => b - a).slice(0, lanes);
  if (sorted.length === 1) return [top];
  const result = [top];
  for (let k = 1; k < sorted.length; k++) {
    const gap = sorted[k - 1] - sorted[k] >= 7 ? 2 : 1;
    result.push(result[k - 1] - gap);
  }
  const shift = Math.max(0, -Math.min(...result));
  const shifted = result.map((l) => l + shift);
  if (Math.max(...shifted) <= lanes - 1) return shifted;
  // Wide chords on a narrow road: fall back to adjacent lanes under the top.
  const highest = Math.max(sorted.length - 1, Math.min(lanes - 1, top));
  return sorted.map((_, k) => highest - k);
}
