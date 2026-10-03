/** Index of the last beat at/before time; works across seeks and rewinds. */
export function beatIndexAt(beats: readonly number[], time: number): number {
  let lo = 0, hi = beats.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (beats[mid] <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}
