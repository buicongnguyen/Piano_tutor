// Key labels that match the player's real keyboard layout. Input uses physical
// positions (event.code), so on AZERTY the "A" lane is the key printed "Q".
// Chromium exposes the layout map; elsewhere the QWERTY label is kept.
let layout: Map<string, string> | undefined;

type KeyboardApi = { getLayoutMap?: () => Promise<Map<string, string>> };

export async function loadKeyboardLayout() {
  try {
    const api = (navigator as Navigator & { keyboard?: KeyboardApi }).keyboard;
    layout = api?.getLayoutMap ? await api.getLayoutMap() : undefined;
  } catch {
    layout = undefined; // not allowed (e.g. in an iframe): keep QWERTY labels
  }
}

/** The printed label for a physical key code, or `fallback` when unknown. */
export function keyLabel(code: string, fallback: string) {
  const ch = layout?.get(code);
  return ch && ch.length === 1 ? ch.toUpperCase() : fallback;
}

/** Test hook. */
export function setKeyboardLayout(map: Map<string, string> | undefined) {
  layout = map;
}
