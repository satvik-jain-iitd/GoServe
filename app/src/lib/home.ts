// What the Ink v3 home screen needs from the menu rows (story H10b, #193): the thali hero and the sections.
import type { Dish } from "./menu";

const isThali = (d: Dish) => /thali/i.test(d.category ?? "");

// The hero shows the veg and the non-veg thali when the kitchen has them (category "Thali"). No thali: no hero.
export const thalisOf = (dishes: Dish[]): { veg?: Dish; nonveg?: Dish } => ({
  veg: dishes.find((d) => isThali(d) && d.veg !== false),
  nonveg: dishes.find((d) => isThali(d) && d.veg === false),
});

export type Section = { id: string; title: string; dishes: Dish[] };

export const sectionsOf = (dishes: Dish[]): Section[] => {
  const out: Section[] = [];
  for (const d of dishes.filter((x) => !isThali(x))) {
    const title = d.category?.trim() ? d.category.trim().replace(/^./, (c) => c.toUpperCase()) : "Menu";
    const id = `sec-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const found = out.find((s) => s.id === id);
    if (found) found.dishes.push(d);
    else out.push({ id, title, dishes: [d] });
  }
  return out;
};
