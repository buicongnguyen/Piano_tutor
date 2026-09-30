import { vi } from "./vi";
export type Language = "en" | "vi";
export const LANGUAGE_KEY = "encore-language";
export function readLanguage(
  storage?: Pick<Storage, "getItem">,
  browser = "en",
): Language {
  try {
    const saved = storage?.getItem(LANGUAGE_KEY);
    if (saved === "en" || saved === "vi") return saved;
  } catch {
    /* Optional storage. */
  }
  return browser.toLowerCase().startsWith("vi") ? "vi" : "en";
}
let language: Language = "en";
export function t(text: string, lang: Language = language): string {
  if (lang === "en") return text;
  const s = text.trim();
  let value = vi[s];
  if (!value) {
    // Buttons keep their icons; combined HUD badges keep their separators.
    const icon = /^([▶↺⌂⚙📖🎹🎮⌨️👆🎵＋✨🎯🔓]+[\s\u00a0]*)(.+)$/u.exec(s);
    if (icon) value = icon[1] + t(icon[2], lang);
    else if (s.includes(" · "))
      value = s
        .split(" · ")
        .map((part) => t(part, lang))
        .join(" · ");
    else
      value = s
        .replace(/^(\d+) notes$/, "$1 nốt")
        .replace(/^(\d+) lanes$/, "$1 làn")
        .replace(/^(\d+) assisted$/, "$1 nốt hỗ trợ")
        .replace(/^(\d+) COMBO!$/, "$1 NỐT LIÊN TIẾP!")
        .replace(/^Next: /, "Tiếp theo: ")
        .replace("◀ Left", "◀ Trái")
        .replace("Right ▶", "Phải ▶")
        .replace(/^Tap left & right$/, "Chạm trái và phải")
        .replace(/^Next stage ▶$/, "Màn tiếp theo ▶")
        .replace(
          /^(\d+) more ★ to open (.+)$/,
          (_, n, name) => `Cần thêm ${n} ★ để mở ${t(name, lang)}`,
        )
        .replace(/^♪ (\d+) stillnotes freed$/, "♪ Đã giải phóng $1 nốt nhạc")
        .replace(/^Connected: /, "Đã kết nối: ")
        .replace(/^You played all$/, "Bạn đã chơi đủ")
        .replace(
          /^notes\. When you're ready, play it for stars!$/,
          "nốt. Khi sẵn sàng, hãy chơi để giành sao!",
        )
        .replace(/^Best$/, "Kỷ lục")
        .replace(/^Top rank (S\+|[SABCD])$/, "Hạng cao nhất $1")
        .replace(/^(\d+) \/ (\d+) stars$/, "$1 / $2 sao")
        .replace(/^Island (\d+)/, "Đảo $1");
    value = value
      .replace(
        /^You tend to play (\d+) ms early\. Relax into the beat\.$/,
        "Bạn thường chơi sớm $1 ms. Hãy thả lỏng và theo nhịp.",
      )
      .replace(
        /^You tend to play (\d+) ms late\. Try watching the gems a little further up the road\.$/,
        "Bạn thường chơi muộn $1 ms. Hãy nhìn các viên ngọc từ xa hơn một chút.",
      )
      .replace(/^(\d+) WPM$/, "$1 từ/phút")
      .replace(/^song pace (\d+) WPM$/, "nhịp bài $1 từ/phút")
      .replace(
        /^(\d+) of (\d+) words typed perfectly$/,
        "Gõ đúng $1 trong $2 từ",
      )
      .replace(/^The song kept playing for you$/, "Bản nhạc luôn tiếp tục phát")
      .replace(/^Couldn't read that score: /, "Không đọc được bản nhạc: ")
      .replace(
        /^That stage couldn't start: /,
        "Không khởi động được màn chơi: ",
      )
      .replace(
        /^(.+), (\d+) of (\d+) stars$/,
        (_, name, n, total) => `${t(name, lang)}, ${n} trên ${total} sao`,
      )
      .replace(
        /^(.+), locked: needs (\d+) stars$/,
        (_, name, n) => `${t(name, lang)}, đang khóa: cần ${n} sao`,
      );
  }
  // A function replacement: "$&", "$$" etc. in titles must stay literal.
  return text.replace(s, () => value);
}

/** Translate only rendered UI text/accessible labels, never input values or game data.
 * Incremental observation supports existing dynamic renderers without changing IDs.
 */
export function mountLanguage(root: HTMLElement) {
  let storage: Storage | undefined;
  try {
    storage = localStorage;
  } catch {
    /* Private browsing. */
  }
  language = readLanguage(storage, navigator.language);
  const originals = new WeakMap<Node, { source: string; rendered: string }>();
  const attrs = new WeakMap<
    Element,
    Map<string, { source: string; rendered: string }>
  >();
  const excluded = (el: Element | null) =>
    !!el?.closest(
      '[translate="no"], .hud-words, .hud-song-title, .stage-info, .book-row b, .book-row small, .results-card h2, .dialogue [data-el="text"], script, style',
    );
  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (excluded(node.parentElement)) return;
      const current = node.nodeValue ?? "";
      const prior = originals.get(node);
      const source = prior?.rendered === current ? prior.source : current;
      const rendered = t(source);
      originals.set(node, { source, rendered });
      if (current !== rendered) node.nodeValue = rendered;
    } else if (node instanceof Element) {
      if (excluded(node)) return;
      for (const name of ["aria-label", "title", "placeholder"]) {
        const current = node.getAttribute(name);
        if (current === null) continue;
        const map = attrs.get(node) ?? new Map();
        attrs.set(node, map);
        const prior = map.get(name);
        const source = prior?.rendered === current ? prior.source : current;
        const rendered = t(source);
        map.set(name, { source, rendered });
        if (current !== rendered) node.setAttribute(name, rendered);
      }
      for (const child of node.childNodes) visit(child);
    }
  }
  function sync() {
    document.documentElement.lang = language;
    visit(root);
    root
      .querySelectorAll<HTMLSelectElement>("[data-language]")
      .forEach((e) => (e.value = language));
  }
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "childList") r.addedNodes.forEach(visit);
      else visit(r.target);
    }
    root.querySelectorAll<HTMLSelectElement>("[data-language]").forEach((e) => {
      if (e.value !== language) e.value = language;
    });
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "placeholder"],
  });
  root.addEventListener("change", (e) => {
    const select = e.target;
    if (
      !(select instanceof HTMLSelectElement) ||
      !select.hasAttribute("data-language")
    )
      return;
    language = select.value === "vi" ? "vi" : "en";
    try {
      storage?.setItem(LANGUAGE_KEY, language);
    } catch {
      /* Session preference still works. */
    }
    sync();
  });
  sync();
  return () => observer.disconnect();
}
export const languageControl =
  '<label class="language-control" translate="no">Language / Ngôn ngữ <select data-language aria-label="Language / Ngôn ngữ"><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>';
