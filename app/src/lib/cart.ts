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

export type Line = { dish: Dish; qty: number; line_paise: number };
export const cartLines = (cart: Cart, menu: Dish[]): Line[] =>
  menu.filter((d) => cart[d.id] > 0).map((dish) => ({ dish, qty: cart[dish.id], line_paise: dish.price_paise * cart[dish.id] }));
export const cartTotal = (lines: Line[]): number => lines.reduce((sum, l) => sum + l.line_paise, 0);

// What the server receives: ids and quantities only.
export const toOrderItems = (cart: Cart) => Object.entries(cart).map(([menu_item_id, qty]) => ({ menu_item_id, qty }));
