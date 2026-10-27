// Story #588: the bill from POST /quote (the only bill math, backend story #345). The Bill shows these numbers and adds none of its own.
// Behind VITE_OFFERS=1 until the order goes through POST /orders (#590); a quote that cannot be had leaves the Bill as it was.
import { getClient } from "./supabase";

export type Offer = { code: string; title: string; saves_paise: number };
export type Quote = {
  item_total_paise: number; fees: { delivery_paise: number; packaging_paise: number; total_paise: number };
  discount_paise: number; coupon: { code: string; title: string } | null; tax_paise: number; tax_mode: "inclusive" | "exclusive"; to_pay_paise: number; offers: Offer[];
};
export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string; message: string };
export const OFFERS_ON = import.meta.env.VITE_OFFERS === "1";

export async function fetchQuote(input: { kitchenId: string; pin: string; items: { menu_item_id: string; qty: number }[]; code: string | null }): Promise<QuoteResult> {
  const down: QuoteResult = { ok: false, error: "network", message: "Could not reach GoServe. Try again." };
  try {
    const token = (await getClient().auth.getSession()).data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote`, {
      method: "POST", headers: { "content-type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
      body: JSON.stringify({ kitchen_id: input.kitchenId, lines: input.items.map((i) => ({ ...i, option_ids: [] })), address: { pin_code: input.pin }, ...(input.code ? { coupon_code: input.code } : {}) }),
    });
    const a = await res.json().catch(() => null);
    if (res.ok && a?.ok && Number.isInteger(a.to_pay_paise)) return { ok: true, quote: { ...a, offers: Array.isArray(a.offers) ? a.offers : [] } };
    if (a?.ok === false && typeof a.error === "string" && typeof a.message === "string") return { ok: false, error: a.error, message: a.message };
    return down;   // a 502 or anything outside the contract: no detail is shown
  } catch {
    return down;
  }
}
