// The menu is read from Supabase and a copy is kept on the phone, so it still shows with the network off (story #48, S2).
export type Dish = { id: string; name: string; price_paise: number; image_url: string | null; image_credit: string | null };
export type KeyValue = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export const MENU_KEY = "gs.menu.v1";
const NOT_AVAILABLE = "The menu is not available. Connect once to load it.";

const readCopy = (storage: KeyValue): Dish[] | null => {
  try {
    const saved = JSON.parse(storage.getItem(MENU_KEY) ?? "null");
    const ok = Array.isArray(saved) && saved.length > 0 && saved.every((d) => d && typeof d.id === "string" && typeof d.name === "string" && typeof d.price_paise === "number");
    return ok ? saved : null;
  } catch {
    return null;
  }
};

export async function loadMenu(fetchRows: () => Promise<Dish[]>, storage: KeyValue): Promise<{ dishes: Dish[]; fromCache: boolean }> {
  try {
    const dishes = await fetchRows();
    if (dishes.length > 0) {   // an empty answer never replaces a good copy
      storage.setItem(MENU_KEY, JSON.stringify(dishes));
      return { dishes, fromCache: false };
    }
  } catch {
    // fall through to the saved copy
  }
  const saved = readCopy(storage);
  if (saved) return { dishes: saved, fromCache: true };
  throw new Error(NOT_AVAILABLE);
}
