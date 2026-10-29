import { NO_INTERNET } from "./errorLines";
// The menu is read from Supabase and a copy is kept on the phone, so it still shows with the network off (story #48, S2).
export type Dish = { id: string; name: string; price_paise: number; image_url: string | null; image_credit: string | null; veg?: boolean; category?: string | null };
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
export async function loadMenu(fetchRows: () => Promise<Dish[]>, storage: KeyValue, key: string = MENU_KEY): Promise<{ dishes: Dish[]; fromCache: boolean }> {
  try {
    const dishes = await fetchRows();
    if (dishes.length > 0) {   // an empty answer never replaces a good copy
      storage.setItem(key, JSON.stringify(dishes));
      return { dishes, fromCache: false };
    }
  } catch {
    // fall through to the saved copy
  }
  const saved = readCopy(storage, key);
  if (saved) return { dishes: saved, fromCache: true };
  throw new Error(NOT_AVAILABLE);
}

// "File:Butter chicken.jpg, Wikimedia Commons, CC BY-SA 4.0" becomes "Photo: Wikimedia Commons, CC BY-SA 4.0" (story #274).
export const creditLine = (credit: string): string => `Photo: ${credit.replace(/^File:[^,]*,\s*/, "")}`;

// A CC BY credit ("Title" by Creator, CC BY 2.0): the licence name links to its text, as the licence asks (story #292). Other credits show as plain text.
export const creditLicence = (credit: string): { before: string; label: string; href: string } | null => {
  const m = /^(.*, )(CC BY (\d\.\d))$/.exec(credit);
  return m ? { before: m[1], label: m[2], href: `https://creativecommons.org/licenses/by/${m[3]}/` } : null;
};
