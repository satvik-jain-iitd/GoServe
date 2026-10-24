// Story H10 (#193) and #225: Day and Night. Day is the default at any hour (owner, 24 Oct 2026); a person can pin Night in You > Look (kept in this browser).
// index.html carries the same rule in a few lines so the first paint is already right; this file is the tested copy.
export type Theme = "day" | "night";
export const THEME_KEY = "gs-theme";
export const DEFAULT_THEME: Theme = "day";   // #225: the clock no longer picks Night
export const parseTheme = (v: string | null | undefined): Theme | null => (v === "day" || v === "night" ? v : null);
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readPin(store: Store | null): Theme | null {
  try { return parseTheme(store?.getItem(THEME_KEY)); } catch { return null; }   // storage can be blocked
}
export const resolveTheme = (pin: Theme | null): Theme => pin ?? DEFAULT_THEME;
/** Pin Day or Night, or pass null to go back to the default (Day). */
export function pinTheme(store: Store | null, doc: Document, theme: Theme | null): Theme {
  try { if (theme) store?.setItem(THEME_KEY, theme); else store?.removeItem(THEME_KEY); } catch { /* the pin lasts for this visit only */ }
  return applyTheme(store, doc, theme);
}
export function applyTheme(store: Store | null, doc: Document, pin: Theme | null = readPin(store)): Theme {
  const theme = resolveTheme(pin);
  doc.documentElement.dataset.theme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "night" ? "#0b1220" : "#e4e6d9");
  return theme;
}
