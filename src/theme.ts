export type ThemePreference = "system" | "light" | "dark";
export function resolveTheme(preference: string | null, systemDark: boolean) {
  return preference === "dark" || (preference !== "light" && systemDark)
    ? "dark"
    : "light";
}
export function mountTheme(select: HTMLSelectElement) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  let preference: ThemePreference = "system";
  try {
    const saved = window.localStorage.getItem("stillnote-theme");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {
    /* Storage may be disabled; theme switching still works. */
  }
  select.value = preference;
  const apply = () => {
    document.documentElement.dataset.theme = resolveTheme(
      preference,
      media.matches,
    );
  };
  select.addEventListener("change", () => {
    preference = select.value as ThemePreference;
    try {
      window.localStorage.setItem("stillnote-theme", preference);
    } catch {
      /* Session-only preference. */
    }
    apply();
  });
  media.addEventListener("change", apply);
  apply();
}
