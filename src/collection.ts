export function musicMatches(title: string, composer: string, query: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\brivers\b/g, "river")
      .replace(/\bflows\b/g, "flow")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const text = normalize(`${title} ${composer}`);
  return normalize(query)
    .split(/\s+/)
    .every((word) => text.includes(word));
}
