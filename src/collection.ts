export function musicMatches(
  title: string,
  composer: string,
  query: string,
  tags = "",
) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/\brivers\b/g, "river")
      .replace(/\bflows\b/g, "flow")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const text = normalize(`${title} ${composer} ${tags}`);
  return normalize(query)
    .split(/\s+/)
    .every((word) => text.includes(word));
}
