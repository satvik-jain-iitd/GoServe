// Story #590: place the order with POST /orders (backend v2, story #347) instead of the v1 n8n `place` action.
// Story #940: this is the only way to place an order. The v1 webhook place route is gone, so the order is always placed as the signed-in user.
// The body carries the price the customer saw. If the server's price is different it answers 409 price_changed with the new quote: nothing is ordered until the customer taps again.
import { DEFAULT_CFG, type ConfirmCfg } from "./confirm";
import { customerLine, NO_INTERNET } from "./errorLines";
import { PlaceError, type PlacedOrder } from "./orders";
import { ensureSession, getClient } from "./supabase";
import type { Quote } from "./quote";

export const PRICE_CHANGED_LINE = "The price changed. Check the new total, then tap Place order.";
export class PriceChanged extends Error {
  constructor(public quote: Quote) { super(PRICE_CHANGED_LINE); }
}

export type V2Deps = { fetchFn: typeof fetch; token: (fresh?: boolean) => Promise<string>;   // story 1580: fresh = refresh the sign-in first (after a 401)
   url: string; anon: string };
// Story 1580: always a signed-in user's token, never the anon key (a bearer that is no user is a 401 on every order until the app is reopened).
export async function userToken(fresh = false): Promise<string> {
  const c = getClient();
  if (fresh && (await c.auth.refreshSession()).error) await ensureSession();
  await ensureSession();   // signs in anonymously when the phone lost its session
  const t = (await c.auth.getSession()).data.session?.access_token;
  if (!t) throw new Error("Could not connect. Check your internet and try again.");
  return t;
}
export const v2Deps = (): V2Deps => ({
  fetchFn: fetch.bind(window), url: import.meta.env.VITE_SUPABASE_URL, anon: import.meta.env.VITE_SUPABASE_ANON_KEY,
  token: userToken,
});

export type PlaceV2Input = { kitchenId: string; pin: string; items: { menu_item_id: string; qty: number; swap?: boolean }[]; address: string; key: string; expectedPaise: number; code: string | null; none: boolean; drop: { lat: number; lng: number }; instructions?: string };   // story 1528: the point is not optional; story 935: one optional note for the kitchen

export async function placeOrderV2(input: PlaceV2Input, deps: V2Deps): Promise<{ order: PlacedOrder; created: boolean; confirm: ConfirmCfg }> {
  let res: Response;
  const send = async (fresh: boolean) => deps.fetchFn(`${deps.url}/functions/v1/orders`, {
      method: "POST", headers: { "content-type": "application/json", apikey: deps.anon, authorization: `Bearer ${await deps.token(fresh)}` },
      body: JSON.stringify({ kitchen_id: input.kitchenId, lines: input.items.map((i) => ({ ...i, option_ids: [] })), address: { pin_code: input.pin, text: input.address.trim(), lat: input.drop.lat, lng: input.drop.lng },   // story 1528: every order carries the exact point
        ...(input.code ? { coupon_code: input.code } : {}), ...(input.none ? { no_coupon: true } : {}), idempotency_key: input.key, expected_to_pay_paise: input.expectedPaise, ...(input.instructions?.trim() ? { instructions: input.instructions.trim() } : {}) }),
    });
  try {
    res = await send(false);
    if (res.status === 401) res = await send(true);   // story 1580: refresh once and retry once; the same idempotency key makes it one order
  } catch {
    throw new PlaceError(NO_INTERNET, "network");
  }
  const a = await res.json().catch(() => null);
  if (res.ok && a?.ok && a.order?.id) {
    const o = a.order;   // the confirm times are optional in the answer: the defaults stand until the server sends them
    const num = (v: unknown, d: number) => (typeof v === "number" && v >= 0 ? v : d);
    return { order: { id: o.id, status: o.status, total_paise: o.total_paise, updated_at: o.created_at, paid_by: null, bill: o.bill && typeof o.bill === "object" ? o.bill : null }, created: a.created === true,
      confirm: { afterReadyMin: num(a.confirm_after_ready_min, DEFAULT_CFG.afterReadyMin), afterPlaceMin: num(a.confirm_after_place_min, DEFAULT_CFG.afterPlaceMin) } };
  }
  if (res.status === 409 && a?.error === "price_changed" && a.quote && Number.isInteger(a.quote.to_pay_paise)) {
    throw new PriceChanged({ ...a.quote, offers: Array.isArray(a.quote.offers) ? a.quote.offers : [] });
  }
  const code = typeof a?.error === "string" ? a.error : "unknown";
  throw new PlaceError(customerLine("place", code, typeof a?.message === "string" ? a.message : "", a?.opens_at, res.status) ?? "Already done.", code);
}
