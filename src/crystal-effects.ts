/** Blender-rendered sprites; uses the existing display loop, never the audio clock. */
export function mountCrystalEffects() {
  const selector = document.querySelector<HTMLSelectElement>("#note-effect")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const layer = document.createElement("div");
  layer.className = "crystal-effects";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  let previous = new Set<Element>();
  const clear = () => {
    layer.replaceChildren();
    previous.clear();
  };
  selector.addEventListener("change", clear);
  reduced.addEventListener("change", clear);
  document.addEventListener("visibilitychange", clear);
  window.addEventListener("scroll", clear, true);
  window.addEventListener("resize", clear);
  return () => {
    if (selector.value !== "crystal" || reduced.matches || document.hidden) {
      if (previous.size || layer.childElementCount) clear();
      return;
    }
    const active = new Set(
      document.querySelectorAll(
        "#keyboard .pressed, #keyboard .sounding, #keyboard .pc-held, #computer-keys .pc-active",
      ),
    );
    for (const key of active) {
      if (previous.has(key)) continue;
      const box = key.getBoundingClientRect();
      const x = box.left + box.width / 2,
        y = box.top + Math.min(18, box.height / 2);
      if (
        !box.width ||
        !box.height ||
        x < 0 ||
        x > innerWidth ||
        y < 0 ||
        y > innerHeight
      )
        continue;
      for (let i = 0; i < 4 && layer.childElementCount < 64; i++) {
        const sprite = document.createElement("img");
        sprite.src = `${import.meta.env.BASE_URL}art/note-crystal.png`;
        sprite.alt = "";
        sprite.className = "note-crystal";
        sprite.style.left = `${x}px`;
        sprite.style.top = `${y}px`;
        sprite.style.setProperty("--dx", `${(i - 1.5) * 24}px`);
        sprite.style.setProperty("--rise", `${48 + (i % 2) * 28}px`);
        sprite.style.setProperty("--spin", `${(i - 1.5) * 85}deg`);
        sprite.style.setProperty("--size", `${18 + i * 5}px`);
        layer.append(sprite);
        sprite.addEventListener("animationend", () => sprite.remove(), {
          once: true,
        });
        // Also expire if animations are suppressed by user styles.
        setTimeout(() => sprite.remove(), 950);
      }
    }
    previous = active;
  };
}
