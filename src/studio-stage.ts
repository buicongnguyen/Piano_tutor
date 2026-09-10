export type StageMode = "cinematic" | "calm" | "off";
export function stageMode(saved: string | null, quiet: boolean): StageMode {
  return saved === "cinematic" || saved === "calm" || saved === "off"
    ? saved
    : quiet
      ? "calm"
      : "cinematic";
}
export function mountStudioStage(scene: HTMLElement, controls: HTMLElement) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("stillnote-stage-v1");
  } catch {
    /* Optional preference. */
  }
  const label = document.createElement("label");
  label.textContent = "Scenery ";
  const select = document.createElement("select");
  select.id = "stage-mode";
  select.setAttribute("aria-label", "Scenery");
  for (const [value, text] of [
    ["cinematic", "Cinematic"],
    ["calm", "Calm"],
    ["off", "Off"],
  ])
    select.add(new Option(text, value));
  select.value = stageMode(
    saved,
    reduced.matches || matchMedia("(max-width: 760px)").matches,
  );
  label.append(select);
  controls.append(label);
  const picture = document.createElement("picture");
  picture.className = "stage-art";
  const source = document.createElement("source");
  source.media = "(max-width: 760px)";
  const image = document.createElement("img");
  image.alt = "";
  image.width = 1600;
  image.height = 520;
  image.decoding = "async";
  picture.append(source, image);
  scene.prepend(picture);
  image.onload = () => scene.classList.add("art-loaded");
  image.onerror = () => scene.classList.remove("art-loaded");
  let timer: ReturnType<typeof setTimeout> | undefined;
  function apply() {
    const mode = select.value as StageMode;
    scene.dataset.stage =
      reduced.matches && mode === "cinematic" ? "calm" : mode;
    document.body.dataset.stage = scene.dataset.stage;
    scene.classList.remove("stage-hit", "stage-complete");
    clearTimeout(timer);
    picture.hidden = mode === "off";
    if (mode !== "off" && !image.hasAttribute("src")) {
      source.srcset = `${import.meta.env.BASE_URL}art/moonlit-piano-mobile.png`;
      image.src = `${import.meta.env.BASE_URL}art/moonlit-piano.png`;
    }
  }
  select.onchange = () => {
    apply();
    try {
      localStorage.setItem("stillnote-stage-v1", select.value);
    } catch {
      /* Keep current session usable. */
    }
  };
  reduced.addEventListener("change", apply);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      scene.classList.remove("stage-hit", "stage-complete");
    }
  });
  apply();
  return {
    pulse(complete = false) {
      if (scene.dataset.stage !== "cinematic" || document.hidden) return;
      scene.classList.remove("stage-hit", "stage-complete");
      scene.classList.add(complete ? "stage-complete" : "stage-hit");
      clearTimeout(timer);
      timer = setTimeout(
        () => scene.classList.remove("stage-hit", "stage-complete"),
        complete ? 1400 : 500,
      );
    },
  };
}
