import { NO_INTERNET } from "./errorLines";
// The menu is read from Supabase and a copy is kept on the phone, so it still shows with the network off (story #48, S2).
export type Dish = { id: string; name: string; price_paise: number; image_url: string | null; image_credit: string | null; veg?: boolean; category?: string | null; available?: boolean; description?: string | null };   // story #619: a sold-out dish stays on the menu with available false; an old saved menu has no flag (available)
export type KeyValue = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export const MENU_KEY = "gs.menu.v1";
const NOT_AVAILABLE = NO_INTERNET;

const readCopy = (storage: KeyValue, key: string): Dish[] | null => {
  try {
    const saved = JSON.parse(storage.getItem(key) ?? "null");
    const ok = Array.isArray(saved) && saved.length > 0 && saved.every((d) => d && typeof d.id === "string" && typeof d.name === "string" && typeof d.price_paise === "number");
    return ok ? saved : null;
  } catch {
    return null;
  }
};

// One saved copy per key: the customer app uses one key per kitchen (story B2).
// Story #930: "No connection" is shown only when there is none. fetchMenuRows throws "offline" when the phone says it is offline; any other failure
// (a timeout, a slow moment, a server error) keeps the saved copy on screen with no banner and reads again once. Only a second failure shows the banner.
export type Loaded = { dishes: Dish[]; fromCache: boolean; slow?: boolean };   // slow: the saved copy is shown because two reads failed while the phone says it is online
export type LoadOptions = { onLater?: (m: Loaded) => void; delayMs?: number };
const isOffline = (e: unknown) => e instanceof Error && e.message === "offline";

export async function loadMenu(fetchRows: () => Promise<Dish[]>, storage: KeyValue, key: string = MENU_KEY, opts: LoadOptions = {}): Promise<Loaded> {
  const read = async (): Promise<{ dishes: Dish[] } | { error: unknown }> => {
    try { return { dishes: await fetchRows() }; } catch (error) { return { error }; }
  };
  const keep = (dishes: Dish[]): Loaded | null => {
    if (dishes.length === 0) return null;   // an empty answer never replaces a good copy
    storage.setItem(key, JSON.stringify(dishes));
    return { dishes, fromCache: false };
  };
  const first = await read();
  if ("dishes" in first) {
    const fresh = keep(first.dishes);
    if (fresh) return fresh;
    const saved = readCopy(storage, key);
    return saved ? { dishes: saved, fromCache: true } : { dishes: [], fromCache: false };   // story #891: the server answered and has no dishes. That is a real answer, not "no internet".
  }
  const saved = readCopy(storage, key);
  if (isOffline(first.error)) {
    if (saved) return { dishes: saved, fromCache: true };
    throw new Error(NOT_AVAILABLE);
  }
  const later = async (): Promise<Loaded | null> => {
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 1500));
    const second = await read();
    if ("dishes" in second) return keep(second.dishes) ?? (saved ? { dishes: saved, fromCache: false } : { dishes: [], fromCache: false });
    return saved ? { dishes: saved, fromCache: true, slow: true } : null;
  };
  if (saved) {
    void later().then((m) => { if (m) opts.onLater?.(m); });
    return { dishes: saved, fromCache: false };   // the copy shows at once, with no banner
  }
  const again = await later();
  if (again) return again;
  throw new Error(NOT_AVAILABLE);
}

// "File:Butter chicken.jpg, Wikimedia Commons, CC BY-SA 4.0" becomes "Photo: Wikimedia Commons, CC BY-SA 4.0" (story #274).
export const creditLine = (credit: string): string => `Photo: ${credit.replace(/^File:[^,]*,\s*/, "")}`;

// A CC BY credit ("Title" by Creator, CC BY 2.0): the licence name links to its text, as the licence asks (story #292). Other credits show as plain text.
export const creditLicence = (credit: string): { before: string; label: string; href: string } | null => {
  const m = /^(.*, )(CC BY (\d\.\d))$/.exec(credit);
  return m ? { before: m[1], label: m[2], href: `https://creativecommons.org/licenses/by/${m[3]}/` } : null;
};
