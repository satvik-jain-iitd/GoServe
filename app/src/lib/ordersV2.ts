// Story #590: place the order with POST /orders (backend v2, story #347) instead of the v1 n8n `place` action.
// OFF by default: VITE_ORDERS_V2=1 in a build, or gs-orders-v2=1 on one phone (how the tests and a dev phone try it). The deploy workflows do not set it.
// The body carries the price the customer saw. If the server's price is different it answers 409 price_changed with the new quote: nothing is ordered until the customer taps again.
import { DEFAULT_CFG, type ConfirmCfg } from "./confirm";
import { customerLine, NO_INTERNET } from "./errorLines";
import { PlaceError, type PlacedOrder } from "./orders";
import { getClient } from "./supabase";
import type { Quote } from "./quote";

type Env = { VITE_ORDERS_V2?: string };
export const ordersV2On = (env: Env, storage?: Pick<Storage, "getItem">): boolean => {
  if (env.VITE_ORDERS_V2 === "1") return true;
  try { return storage?.getItem("gs-orders-v2") === "1"; } catch { return false; }   // blocked storage: off
};

export const PRICE_CHANGED_LINE = "The price changed. Check the new total, then tap Place order.";
export class PriceChanged extends Error {
  constructor(public quote: Quote) { super(PRICE_CHANGED_LINE); }
}

export type V2Deps = { fetchFn: typeof fetch; token: () => Promise<string>; url: string; anon: string };
export const v2Deps = (): V2Deps => ({
  fetchFn: fetch.bind(window), url: import.meta.env.VITE_SUPABASE_URL, anon: import.meta.env.VITE_SUPABASE_ANON_KEY,
  token: async () => (await getClient().auth.getSession()).data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export type PlaceV2Input = { kitchenId: string; pin: string; items: { menu_item_id: string; qty: number; swap?: boolean }[]; address: string; key: string; expectedPaise: number; code: string | null; none: boolean };

export async function placeOrderV2(input: PlaceV2Input, deps: V2Deps): Promise<{ order: PlacedOrder; created: boolean; confirm: ConfirmCfg }> {
  let res: Response;
  try {
    res = await deps.fetchFn(`${deps.url}/functions/v1/orders`, {
      method: "POST", headers: { "content-type": "application/json", apikey: deps.anon, authorization: `Bearer ${await deps.token()}` },
      body: JSON.stringify({ kitchen_id: input.kitchenId, lines: input.items.map((i) => ({ ...i, option_ids: [] })), address: { pin_code: input.pin, text: input.address.trim() },
        ...(input.code ? { coupon_code: input.code } : {}), ...(input.none ? { no_coupon: true } : {}), idempotency_key: input.key, expected_to_pay_paise: input.expectedPaise }),
    });
  } catch {
    throw new PlaceError(NO_INTERNET, "network");
  }
  const a = await res.json().catch(() => null);
  if (res.ok && a?.ok && a.order?.id) {
    const o = a.order;   // v2 sends no confirm times: the defaults stand until the server sends them
    return { order: { id: o.id, status: o.status, total_paise: o.total_paise, updated_at: o.created_at, paid_by: null }, created: a.created === true, confirm: DEFAULT_CFG };
  }
  if (res.status === 409 && a?.error === "price_changed" && a.quote && Number.isInteger(a.quote.to_pay_paise)) {
    throw new PriceChanged({ ...a.quote, offers: Array.isArray(a.quote.offers) ? a.quote.offers : [] });
  }
  const code = typeof a?.error === "string" ? a.error : "unknown";
  throw new PlaceError(customerLine("place", code, typeof a?.message === "string" ? a.message : "", a?.opens_at) ?? "Already done.", code);
}
