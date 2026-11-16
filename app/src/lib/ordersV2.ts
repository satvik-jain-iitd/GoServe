// Story #590: place the order with POST /orders (backend v2, story #347) instead of the v1 n8n `place` action.
// Story #940: this is the only way to place an order. The v1 webhook place route is gone, so the order is always placed as the signed-in user.
// The body carries the price the customer saw. If the server's price is different it answers 409 price_changed with the new quote: nothing is ordered until the customer taps again.
import { DEFAULT_CFG, type ConfirmCfg } from "./confirm";
import { customerLine, NO_INTERNET, PRICE_CHANGED_LINE } from "./errorLines";
import { PlaceError, type PlacedOrder } from "./orders";
import { ensureCustomerSession, ensureSession, getClient, SessionEnded } from "./supabase";
import type { Quote } from "./quote";

export { PRICE_CHANGED_LINE };
export class PriceChanged extends Error {
  constructor(public quote: Quote) { super(PRICE_CHANGED_LINE); }
}

// renew: after a 401 the caller renews the sign-in (true = a session is there to try again). It belongs to the caller because a new guest needs saveProfile again first.
export type V2Deps = { fetchFn: typeof fetch; token: () => Promise<string>; url: string; anon: string; renew?: () => Promise<boolean> };
// Story 1580: the Place order token. It signs in first when the phone has no session, so a request never carries the anon key.
// Story 1586: in the customer app (`customer`) a guest or a lost sign-in throws SessionEnded instead of making a guest.
export async function userToken(customer = false): Promise<string> {
  await (customer ? ensureCustomerSession() : ensureSession());
  const t = (await getClient().auth.getSession()).data.session?.access_token;
  if (!t) throw new Error("Could not connect. Check your internet and try again.");
  return t;
}
// Story 1580: renew the sign-in after a 401. "same" = the refresh kept the same user (retry). "guest" = the guest's session was ended and a new guest was made
// (the caller must save the profile under the new id before the retry). "gone" = nothing to retry with: a phone user's ended session is never turned into a guest,
// and a dead network is not a refusal.
export async function renewSession(customer = false): Promise<"same" | "guest" | "gone"> {
  const c = getClient();
  const old = (await c.auth.getSession()).data.session;
  const { data, error } = await c.auth.refreshSession();
  if (!error && data.session && data.session.user.id === old?.user.id) return "same";
  if (error?.name === "AuthRetryableFetchError") return "gone";
  if (customer && old && !old.user.is_anonymous) throw new SessionEnded();   // story 1586: a customer's refused sign-in is the wall, not an error line
  if (!old?.user.is_anonymous) return "gone";
  await c.auth.signOut({ scope: "local" });   // a refused refresh leaves the dead guest session in storage
  await (customer ? ensureCustomerSession() : ensureSession());
  return "guest";
}
// The shared deps (search, map, geocode) read the session and never make one: a search must not create a guest. Old behaviour, the anon key when there is none.
export const v2Deps = (): V2Deps => ({
  fetchFn: fetch.bind(window), url: import.meta.env.VITE_SUPABASE_URL, anon: import.meta.env.VITE_SUPABASE_ANON_KEY,
  token: async () => (await getClient().auth.getSession()).data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
});
// Place order only: signs in first, and on a 401 renews through `renew`.
export const placeDeps = (renew: () => Promise<boolean>, customer = false): V2Deps => ({ ...v2Deps(), token: () => userToken(customer), renew });

export type PlaceV2Input = { kitchenId: string; pin: string; items: { menu_item_id: string; qty: number; swap?: boolean }[]; address: string; key: string; expectedPaise: number; code: string | null; none: boolean; drop: { lat: number; lng: number }; instructions?: string };   // story 1528: the point is not optional; story 935: one optional note for the kitchen

export async function placeOrderV2(input: PlaceV2Input, deps: V2Deps): Promise<{ order: PlacedOrder; created: boolean; confirm: ConfirmCfg }> {
  let res: Response;
  const send = async () => deps.fetchFn(`${deps.url}/functions/v1/orders`, {
      method: "POST", headers: { "content-type": "application/json", apikey: deps.anon, authorization: `Bearer ${await deps.token()}` },
      body: JSON.stringify({ kitchen_id: input.kitchenId, lines: input.items.map((i) => ({ ...i, option_ids: [] })), address: { pin_code: input.pin, text: input.address.trim(), lat: input.drop.lat, lng: input.drop.lng },   // story 1528: every order carries the exact point
        ...(input.code ? { coupon_code: input.code } : {}), ...(input.none ? { no_coupon: true } : {}), idempotency_key: input.key, expected_to_pay_paise: input.expectedPaise, ...(input.instructions?.trim() ? { instructions: input.instructions.trim() } : {}) }),
    });
  try {
    res = await send();
    if (res.status === 401 && deps.renew && await deps.renew()) res = await send();   // story 1580: renew once and retry once; the same idempotency key makes it one order
  } catch (e) {
    if (e instanceof SessionEnded) throw e;   // story 1586: not a network problem; the caller shows the wall
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
