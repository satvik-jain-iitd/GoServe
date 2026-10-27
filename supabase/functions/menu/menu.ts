// Story #343: the menu rules, pure. Rows come from menu_items; the answer is what every app shows. Nothing here talks to the network.
export type DishRow = {
  id: string; name: string; price_paise: number; available: boolean; veg: boolean; category: string | null; sort: number; image_url: string | null;
  badge: "bestseller" | "new" | "chef" | null; size_tag: "small" | "regular" | "large" | null; protein_g: number | null; back_soon_at: string | null; created_at: string;
};
export type Dish = {
  id: string; name: string; price_paise: number; veg: boolean; category: string; image_url: string | null; badge: DishRow["badge"]; size_tag: DishRow["size_tag"];
  protein_g: number | null; sold_out: boolean; back_soon: boolean; back_soon_at: string | null;
};
export type Menu = { categories: { name: string; dishes: Dish[] }[]; collections: { key: string; title: string; dish_ids: string[] }[] };

const NEW_DAYS = 14;
const UNDER_PAISE = 9900;   // "Under 99": 99 rupees or less

export function buildMenu(rows: DishRow[], now: Date): Menu {
  const dishes = [...rows].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const make = (r: DishRow): Dish => {
    const back = !r.available && r.back_soon_at !== null && Date.parse(r.back_soon_at) > now.getTime();
    return {
      id: r.id, name: r.name, price_paise: r.price_paise, veg: r.veg, category: r.category ?? "Other", image_url: r.image_url, badge: r.badge,
      size_tag: r.size_tag, protein_g: r.protein_g, sold_out: !r.available, back_soon: back, back_soon_at: back ? new Date(r.back_soon_at!).toISOString() : null,
    };
  };
  const categories: Menu["categories"] = [];
  for (const r of dishes) {
    const d = make(r);
    const name = d.category;
    (categories.find((c) => c.name === name) ?? categories[categories.push({ name, dishes: [] }) - 1]).dishes.push(d);
  }
  // "Other" is always last, whatever the sort says.
  categories.sort((a, b) => Number(a.name === "Other") - Number(b.name === "Other"));
  const open = dishes.filter((r) => r.available);
  const cutoff = now.getTime() - NEW_DAYS * 86_400_000;
  const sets = [
    { key: "bestsellers", title: "Bestsellers", ids: open.filter((r) => r.badge === "bestseller").map((r) => r.id) },
    { key: "under_99", title: "Under 99", ids: open.filter((r) => r.price_paise <= UNDER_PAISE).map((r) => r.id) },
    { key: "new", title: "New", ids: open.filter((r) => Date.parse(r.created_at) >= cutoff).map((r) => r.id) },
  ];
  return { categories, collections: sets.filter((s) => s.ids.length > 0).map((s) => ({ key: s.key, title: s.title, dish_ids: s.ids })) };
}
