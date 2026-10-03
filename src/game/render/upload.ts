import type { BufferAttribute } from "three";

/** Upload only populated items of a pooled buffer, not its entire capacity. */
export function uploadPrefix(attribute: BufferAttribute, count: number) {
  if (count <= 0) return;
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, count * attribute.itemSize);
  attribute.needsUpdate = true;
}
