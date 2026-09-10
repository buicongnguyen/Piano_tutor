/** Blender-rendered sprites; uses the existing display loop, never the audio clock. */
import { fireworkSpark, fireworkStyles } from "./fireworks";
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
    const effect = selector.value;
    if (
      !["crystal", "concert", "rings3d", "orbs3d", ...fireworkStyles].includes(
        effect,
      ) ||
      reduced.matches ||
      document.hidden
    ) {
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
      const fireworks = fireworkStyles.includes(effect);
      const count = fireworks ? 12 : 4;
      const seed =
        Number((key as HTMLElement).dataset.midi) || Math.round(x / 20);
      for (let i = 0; i < count && layer.childElementCount < 64; i++) {
        const sprite = document.createElement("img");
        const kind = fireworks
          ? "orb"
          : effect === "rings3d"
            ? "ring"
            : effect === "orbs3d"
              ? "orb"
              : effect === "concert"
                ? ["ring", "crystal", "orb", "crystal"][i]
                : "crystal";
        sprite.src = `${import.meta.env.BASE_URL}art/note-${kind}.png`;
        sprite.alt = "";
        sprite.className = `note-crystal burst-${kind}`;
        sprite.style.left = `${x}px`;
        sprite.style.top = `${y}px`;
        sprite.style.setProperty("--dx", `${(i - 1.5) * 24}px`);
        sprite.style.setProperty("--rise", `${48 + (i % 2) * 28}px`);
        sprite.style.setProperty("--spin", `${(i - 1.5) * 85}deg`);
        sprite.style.setProperty("--size", `${18 + i * 5}px`);
        if (fireworks) {
          const spark = fireworkSpark(effect, i, count, seed);
          sprite.className = `note-crystal firework-spark ${effect}`;
          sprite.style.setProperty("--dx", `${spark.dx}px`);
          sprite.style.setProperty("--dy", `${spark.dy}px`);
          sprite.style.setProperty("--fall", `${spark.fall}px`);
          sprite.style.setProperty("--size", `${spark.size}px`);
          sprite.style.setProperty("--hue", `${spark.hue}deg`);
          sprite.style.setProperty("--twist", `${spark.twist}deg`);
        }
        layer.append(sprite);
        sprite.addEventListener("animationend", () => sprite.remove(), {
          once: true,
        });
        // Also expire if animations are suppressed by user styles.
        setTimeout(() => sprite.remove(), fireworks ? 1450 : 950);
      }
    }
    previous = active;
  };
}
