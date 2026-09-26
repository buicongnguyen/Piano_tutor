// Tiny DOM helpers for the game UI.
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export const stars = (n: number, max = 3) =>
  Array.from({ length: max }, (_, i) => `<i class="star${i < n ? " on" : ""}" aria-hidden="true">★</i>`).join("");

export function show(e: HTMLElement, visible: boolean) {
  e.hidden = !visible;
  e.classList.toggle("visible", visible);
}
