// Finding a dish on the loaded menu (story D2): category chips, a veg toggle and a search box. All local, no network.
import { openingClock } from "./area";
import type { Dish } from "./menu";

export type Filter = { category?: string | null; vegOnly?: boolean; query?: string };

export const categoriesOf = (dishes: Dish[]): string[] => [...new Set(dishes.map((d) => d.category).filter((c): c is string => !!c))];

export const filterDishes = (dishes: Dish[], f: Filter): Dish[] => {
  const q = (f.query ?? "").trim().toLowerCase();
  return dishes.filter((d) => (!f.category || d.category === f.category) && (!f.vegOnly || d.veg !== false) && (!q || d.name.toLowerCase().includes(q)));
};

export const openTill = (closesAt: string | null | undefined): string => (closesAt ? `Open till ${openingClock(closesAt)}` : "");
