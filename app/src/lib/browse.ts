// Finding a dish on the loaded menu (story D2): category chips, a veg toggle and a search box. All local, no network.
import { openingClock } from "./area";
import type { Dish } from "./menu";

export type Filter = { category?: string | null; categories?: string[]; vegOnly?: boolean; query?: string };

// Story #972: a category is the dish's category in lower case; a dish with none belongs to the "menu" group (the same grouping the sections use).
export const categoryKey = (d: Dish): string => d.category?.trim().toLowerCase() || "menu";

export const categoriesOf = (dishes: Dish[]): string[] => [...new Set(dishes.map((d) => d.category).filter((c): c is string => !!c))];

export const filterDishes = (dishes: Dish[], f: Filter): Dish[] => {
  const q = (f.query ?? "").trim().toLowerCase();
  return dishes.filter((d) => (!f.category || d.category === f.category) && (!f.categories?.length || f.categories.includes(categoryKey(d))) && (!f.vegOnly || d.veg !== false) && (!q || d.name.toLowerCase().includes(q)));
};

export const openTill = (closesAt: string | null | undefined): string => (closesAt ? `Open till ${openingClock(closesAt)}` : "");
