import type { BufferAttribute } from "three";

/** Keep a bounded union: a culled buffer may still have an older pending upload. */
function dirtyRange(attribute: BufferAttribute, start: number, count: number) {
  let end = start + count;
  for (const range of attribute.updateRanges) {
    start = Math.min(start, range.start);
    end = Math.max(end, range.start + range.count);
  }
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(start, end - start);
  attribute.needsUpdate = true;
}

/** Upload only populated items of a pooled buffer, not its entire capacity. */
export function uploadPrefix(attribute: BufferAttribute, count: number) {
  if (count <= 0) return;
  dirtyRange(attribute, 0, count * attribute.itemSize);
}

const previous = new WeakMap<
  BufferAttribute,
  { source: BufferAttribute["array"]; values: Float64Array }
>();
/** Compare the written typed-array values, not doubles before Float32 rounding.
 * Keep the last submitted contents even beyond a shrinking live prefix. */
export function uploadChangedPrefix(attribute: BufferAttribute, count: number) {
  const end = Math.min(attribute.array.length, count * attribute.itemSize);
  if (end <= 0) return;
  let state = previous.get(attribute);
  if (!state || state.source !== attribute.array) {
    state = {
      source: attribute.array,
      values: new Float64Array(attribute.array.length).fill(NaN),
    };
    previous.set(attribute, state);
  }
  let first = end,
    last = -1;
  for (let i = 0; i < end; i++)
    if (state.values[i] !== attribute.array[i]) {
      first = Math.min(first, i);
      last = i;
      state.values[i] = attribute.array[i];
    }
  if (last >= first) dirtyRange(attribute, first, last - first + 1);
}
