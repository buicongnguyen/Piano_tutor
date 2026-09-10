export const fireworkStyles = [
  "firework-bloom",
  "firework-willow",
  "firework-spiral",
];
/** Project a spherical burst into the key's screen plane; depth changes spark size. */
export function fireworkSpark(
  style: string,
  index: number,
  count: number,
  seed: number,
) {
  const angle = (index * Math.PI * 2) / count + seed * 0.17;
  const depth = Math.sin(index * 2.4 + seed);
  const radius = 32 + (depth + 1) * 15;
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius * 0.65 - 48,
    fall: style === "firework-willow" ? 40 : 8,
    size: 7 + (depth + 1) * 3,
    hue: (seed * 47 + index * 27) % 360,
    twist: style === "firework-spiral" ? 180 : 0,
  };
}
