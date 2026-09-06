import type { Note } from "./music";
import { keyboardLayout } from "./keyboard";
export const effects = ["ripple", "flow", "sparkles", "glow", "none"] as const;
export function validEffect(value: string | null) {
  return effects.find((effect) => effect === value) ?? "ripple";
}

export function fallingBar(
  note: Note,
  time: number,
  height: number,
  horizon = 3,
) {
  const scale = height / horizon;
  return {
    bottom: height - (note.time - time) * scale,
    length: note.duration * scale,
  };
}

export function mountWaterfall() {
  const canvas = document.querySelector<HTMLCanvasElement>("#waterfall")!;
  const keyboard = document.querySelector<HTMLElement>("#keyboard")!;
  const toggle =
    document.querySelector<HTMLButtonElement>("#waterfall-toggle")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const selector = document.querySelector<HTMLSelectElement>("#note-effect")!;
  let effect = validEffect(null);
  let enabled = !reduced.matches;
  try {
    effect = validEffect(localStorage.getItem("stillnote-effect"));
    const saved = localStorage.getItem("stillnote-waterfall");
    if (saved !== null) enabled = saved === "true";
  } catch {
    /* Optional preferences. */
  }
  selector.value = effect;
  const remember = () => {
    try {
      localStorage.setItem("stillnote-effect", effect);
      localStorage.setItem("stillnote-waterfall", String(enabled));
    } catch {
      /* Switching works without storage. */
    }
  };
  selector.onchange = () => {
    effect = validEffect(selector.value);
    keyboard.parentElement!.dataset.effect = effect;
    remember();
  };
  const apply = () => {
    canvas.hidden = !enabled;
    keyboard.parentElement!.dataset.effect = effect;
    toggle.setAttribute("aria-pressed", String(enabled));
  };
  toggle.onclick = () => {
    enabled = !enabled;
    apply();
    remember();
  };
  apply();
  return (notes: Note[], time: number, playing: boolean) => {
    if (!enabled) return;
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = devicePixelRatio;
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#050d14";
    ctx.fillRect(0, 0, width, height);
    const full = keyboard.classList.contains("full-range");
    const layout = keyboardLayout(full ? 21 : 36, full ? 108 : 84);
    const lanes = new Map(layout.keys.map((k) => [k.midi, k]));
    const whiteWidth = width / layout.whiteCount;
    for (const key of layout.keys)
      if (!key.black) {
        ctx.fillStyle = "#173041";
        ctx.fillRect((key.left / 100) * width, 0, 0.5, height);
      }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    for (const note of notes) {
      const lane = lanes.get(note.midi);
      if (
        !lane ||
        note.time > time + 3 ||
        note.time + note.duration < time - 0.65
      )
        continue;
      const x = (lane.left / 100) * width + 2;
      const w = Math.max(2, whiteWidth * (lane.black ? 0.64 : 1) - 4);
      const bar = fallingBar(note, time, height);
      const top = Math.max(0, bar.bottom - bar.length);
      const bottom = Math.min(height, bar.bottom);
      if (bottom > top) {
        const gradient = ctx.createLinearGradient(x, top, x + w, bottom);
        gradient.addColorStop(0, "#1678c8");
        gradient.addColorStop(1, "#7ceaff");
        ctx.fillStyle = gradient;
        ctx.shadowColor = "#29c9ff";
        ctx.shadowBlur = playing && effect !== "none" ? 8 : 0;
        ctx.beginPath();
        ctx.roundRect(
          x,
          top,
          w,
          bottom - top,
          Math.min(4, (bottom - top) / 2, w / 2),
        );
        ctx.fill();
      }
      const age = time - note.time;
      if (
        playing &&
        effect === "flow" &&
        age >= 0 &&
        age < note.duration + 0.65 &&
        !reduced.matches
      ) {
        const fade = Math.max(0, 1 - Math.max(0, age - note.duration) / 0.65);
        ctx.globalCompositeOperation = "lighter";
        const glow = ctx.createRadialGradient(
          x + w / 2,
          height,
          0,
          x + w / 2,
          height,
          30,
        );
        glow.addColorStop(0, `rgba(170,249,255,${fade * 0.8})`);
        glow.addColorStop(1, "rgba(20,170,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 30, height - 30, w + 60, 30);
        for (let particle = 0; particle < 16; particle++) {
          const phase = particle * 0.041;
          if (age < phase) continue;
          const life = (age - phase) % 0.65;
          const spread = Math.sin(particle * 12.7 + note.midi) * 20;
          const px =
            x + w / 2 + spread * life + Math.sin(life * 8 + particle) * 4;
          const py = height - 3 - life * (45 + particle * 2);
          ctx.strokeStyle = `rgba(80,218,255,${(1 - life / 0.65) * fade * 0.65})`;
          ctx.lineWidth = particle % 4 === 0 ? 1.5 : 0.7;
          ctx.beginPath();
          ctx.moveTo(px - Math.sin(life * 8 + particle) * 2, py + 5);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.fillStyle = `rgba(170,245,255,${(1 - life / 0.65) * fade})`;
          ctx.fillRect(px, py, 1.4, 1.4);
        }
        ctx.globalCompositeOperation = "source-over";
      }
      if (playing && effect === "glow" && age >= 0 && age < note.duration) {
        const glow = ctx.createRadialGradient(
          x + w / 2,
          height,
          0,
          x + w / 2,
          height,
          whiteWidth * 1.3,
        );
        glow.addColorStop(0, "rgba(128,232,255,0.8)");
        glow.addColorStop(1, "rgba(30,145,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(
          x - whiteWidth,
          height - whiteWidth * 1.3,
          whiteWidth * 3,
          whiteWidth * 1.3,
        );
      }
      if (
        playing &&
        effect === "sparkles" &&
        age >= 0 &&
        age < 0.65 &&
        !reduced.matches
      ) {
        ctx.fillStyle = `rgba(168,239,255,${1 - age / 0.65})`;
        for (let particle = 0; particle < 6; particle++) {
          const angle = Math.PI * (0.15 + particle * 0.14);
          const distance = age * (45 + particle * 5);
          const px = x + w / 2 + Math.cos(angle) * distance;
          const py = height - 4 - Math.sin(angle) * distance + age * age * 18;
          ctx.fillRect(px - 1, py - 3, 2, 6);
          ctx.fillRect(px - 3, py - 1, 6, 2);
        }
      }
      if (
        playing &&
        effect === "ripple" &&
        age >= 0 &&
        age < 0.65 &&
        !reduced.matches
      ) {
        ctx.shadowBlur = 10;
        ctx.strokeStyle = `rgba(112,226,255,${1 - age / 0.65})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(
          x + w / 2,
          height - 3,
          3 + age * 32,
          2 + age * 14,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.fillStyle = "#69ddff";
    ctx.fillRect(0, height - 2, width, 2);
  };
}
