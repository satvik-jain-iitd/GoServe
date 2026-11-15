// The cart is plain data: dish id to quantity. It holds no price; the price comes from the menu, and the server checks it again.
import type { Dish } from "./menu";

export type Cart = Record<string, number>;
export const MAX_QTY = 20;   // same limit as place_order in the database

export const changeQty = (cart: Cart, id: string, delta: number): Cart => {
  const qty = Math.min(MAX_QTY, (cart[id] ?? 0) + delta);
  const { [id]: _old, ...rest } = cart;
  return qty > 0 ? { ...rest, [id]: qty } : rest;
};
export const addDish = (cart: Cart, id: string): Cart => changeQty(cart, id, +1);

export type Line = { dish: Dish; qty: number; line_paise: number; was_paise?: number; gone?: true };   // story 1540: was_paise = what the line cost at the kitchen before; gone = the kitchen of the place now does not make it
export const cartLines = (cart: Cart, menu: Dish[]): Line[] =>
  menu.filter((d) => cart[d.id] > 0).map((dish) => ({ dish, qty: cart[dish.id], line_paise: dish.price_paise * cart[dish.id] }));
export const cartTotal = (lines: Line[]): number => lines.reduce((sum, l) => sum + l.line_paise, 0);

// What the server receives: ids and quantities only.
export const toOrderItems = (cart: Cart) => Object.entries(cart).map(([menu_item_id, qty]) => ({ menu_item_id, qty }));
// Story #977: Order again. Dishes that are on today's menu and not sold out go back in the cart (quantity kept within the limit); the others are named, so the customer knows.
export const reorderCart = (items: { menu_item_id: string; name: string; qty: number }[], menu: Dish[]): { cart: Cart; left: string[] } => {
  const cart: Cart = {};
  const left: string[] = [];
  for (const i of items) {
    const dish = menu.find((d) => d.id === i.menu_item_id);
    if (!dish || dish.available === false) left.push(i.name);
    else cart[dish.id] = Math.min(MAX_QTY, (cart[dish.id] ?? 0) + i.qty);
  }
  return { cart, left };
};
// Story 1540: the delivery place changed and another kitchen serves it. The cart moves to that kitchen's own dishes: the same id, else the same name (each kitchen has its
// own rows, so the ids differ). `was` keeps the old unit price of each dish whose price differs (by the new id); `gone` are the dishes the new kitchen does not make.
// A match that is sold out there goes in the cart like any other, so the Bill's sold-out pattern takes it.
export type Held = { id: string; name: string; qty: number; price_paise: number; veg?: boolean };
const nameKey = (name: string) => name.trim().toLowerCase();
// ponytail: the name is a heuristic for "the same dish". Guards (reviewer, 15 Nov 2026): exactly one dish of the new kitchen carries the name, and the veg mark is the same.
// Ceiling: two kitchens that name one dish differently, or one name for two different dishes. Upgrade: a shared dish key across kitchens (a follow-up story).
const sameDish = (h: Held, menu: Dish[]): Dish | undefined => {
  const named = menu.filter((d) => nameKey(d.name) === nameKey(h.name));
  return named.length === 1 && named[0].veg === h.veg ? named[0] : undefined;
};
export function moveCart(held: Held[], menu: Dish[]): { cart: Cart; was: Record<string, number>; gone: Held[] } {
  const cart: Cart = {}, was: Record<string, number> = {}, gone: Held[] = [];
  for (const h of held) {
    const dish = menu.find((d) => d.id === h.id) ?? sameDish(h, menu);
    if (!dish) { gone.push(h); continue; }
    cart[dish.id] = Math.min(MAX_QTY, (cart[dish.id] ?? 0) + h.qty);
    if (dish.price_paise !== h.price_paise) was[dish.id] = h.price_paise;
  }
  return { cart, was, gone };
}
// The lines the customer reads. The menu's line is one short line in the greeting box and names no dish and no price; on the Bill each dish that left is a row with "Take it out".
// The Bill's line is short: it is one line under the title, in the header, so no part of the Bill moves (owner's rule 23).
// "Prices are new" is said only when a price differs for this customer (review of PR 1546, note 11).
export const kitchenChangedBill = (priced: boolean): string => (priced ? "The kitchen changed. Prices are new." : "The kitchen changed.");
export const KITCHEN_CHANGED_MENU = "The kitchen changed. See your bill.";
export const notMadeLine = (name: string): string => `${name} is not made by this kitchen.`;
export const BILL_CLEARED_LINE = "Place changed. Your bill was cleared.";
