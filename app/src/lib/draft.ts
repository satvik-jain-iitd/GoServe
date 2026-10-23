// The customer's unfinished order: which screen, the cart (dish id to quantity) and the address. Kept in this browser so a refresh does not lose it (story B1).
// The tracker screen is saved as the menu: after a refresh the open order is found again from the server instead (resume.ts).
import type { Cart } from "./cart";

export type DraftStep = "menu" | "cart" | "bill";
export type Draft = { step: DraftStep | "placed" | "orders"; cart: Cart; address: string; name: string; phone: string };

const KEY = "gs-draft";
const EMPTY: Draft = { step: "menu", cart: {}, address: "", name: "", phone: "" };

export function loadDraft(store: Storage = window.localStorage): Draft {
  try {
    const raw = JSON.parse(store.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return EMPTY;
    const cart: Cart = {};
    for (const [id, qty] of Object.entries(raw.cart ?? {})) if (typeof qty === "number" && qty > 0) cart[id] = qty;
    return { step: raw.step === "cart" || raw.step === "bill" ? raw.step : "menu", cart, address: typeof raw.address === "string" ? raw.address : "", name: typeof raw.name === "string" ? raw.name : "", phone: typeof raw.phone === "string" ? raw.phone : "" };
  } catch {
    return EMPTY;   // storage blocked or damaged: start fresh
  }
}

export function saveDraft(d: Draft, store: Storage = window.localStorage): void {
  try {
    store.setItem(KEY, JSON.stringify({ step: d.step === "placed" || d.step === "orders" ? "menu" : d.step, cart: d.step === "placed" ? {} : d.cart, address: d.address, name: d.name, phone: d.phone }));
  } catch { /* storage blocked: nothing is kept */ }
}

export function clearDraft(store: Storage = window.localStorage): void {
  try {
    store.removeItem(KEY);
  } catch { /* nothing to clear */ }
}
