// Story H10 (#193): Day and Night. Night runs 18:00 to 06:00 by the clock; a person can pin one in You > Look (kept in this browser).
// index.html carries the same rule in a few lines so the first paint is already right; this file is the tested copy.
export type Theme = "day" | "night";
export const THEME_KEY = "gs-theme";
export const NIGHT = { from: 18, to: 6 } as const;   // index.html repeats these two numbers for the first paint
export const themeAtHour = (hour: number): Theme => (hour >= NIGHT.from || hour < NIGHT.to ? "night" : "day");
const h12 = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
/** The words on the "By the clock" chip, built from NIGHT so they never drift: "6 pm to 6 am". */
export const clockLabel = (): string => `${h12(NIGHT.from)} to ${h12(NIGHT.to)}`;
export const parseTheme = (v: string | null | undefined): Theme | null => (v === "day" || v === "night" ? v : null);
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readPin(store: Store | null): Theme | null {
  try { return parseTheme(store?.getItem(THEME_KEY)); } catch { return null; }   // storage can be blocked
}
export const resolveTheme = (pin: Theme | null, hour: number): Theme => pin ?? themeAtHour(hour);
/** Pin Day or Night, or pass null to follow the clock again. */
export function pinTheme(store: Store | null, doc: Document, theme: Theme | null, now = new Date()): Theme {
  try { if (theme) store?.setItem(THEME_KEY, theme); else store?.removeItem(THEME_KEY); } catch { /* the pin lasts for this visit only */ }
  return applyTheme(store, doc, now, theme);
}
export function applyTheme(store: Store | null, doc: Document, now = new Date(), pin: Theme | null = readPin(store)): Theme {
  const theme = resolveTheme(pin, now.getHours());
  doc.documentElement.dataset.theme = theme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "night" ? "#0b1220" : "#e4e6d9");
  return theme;
}
