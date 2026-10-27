// Story #552: online payment calls. /payments/create makes the payment for an order the caller placed (the amount comes from the order, never from here);
// /payments/switch-to-cash closes it and the order is paid in cash. The words of a refusal are the server's; a lost network gets our own line.
import { getClient } from "./supabase";
import { signWebhook, type Created } from "./payGateway";

export type PayResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; message: string };
export const PAY_METHODS = [{ id: "cod", label: "Cash on delivery" }, { id: "upi", label: "UPI" }, { id: "card", label: "Card" }] as const;
export type PayMethod = (typeof PAY_METHODS)[number]["id"];
const START_FAILED: PayResult<never> = { ok: false, error: "network", message: "Could not start the payment. Try again." };
const NETWORK: PayResult<never> = { ok: false, error: "network", message: "Could not reach GoServe. Try again." };
export const PAY_WINDOW_S = 15 * 60;   // the database expires an unpaid online order after this long (payment_expire_v2(15))

async function call(route: string, body: object, fail: PayResult<never>, auth = true): Promise<PayResult<any>> {
  try {
    const token = auth ? (await getClient().auth.getSession()).data.session?.access_token ?? "" : "";
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments/${route}`, {
      method: "POST", headers: { "content-type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, ...(auth ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    });
    const a = await res.json().catch(() => null);
    if (res.ok && a?.ok) return a;
    if (a?.ok === false && typeof a.error === "string" && typeof a.message === "string") return a;
    return fail;   // a 502 or anything outside the contract: no detail is shown
  } catch {
    return NETWORK;
  }
}

export const createPayment = (orderId: string) => call("create", { order_id: orderId }, START_FAILED) as Promise<PayResult<Created>>;
export const switchToCash = (orderId: string) => call("switch-to-cash", { order_id: orderId }, NETWORK);
// Dev helper only (see payGateway.ts): the gateway's webhook, signed with the dev secret.
export async function simulatePaid(secret: string, providerOrderId: string): Promise<boolean> {
  const providerPaymentId = `fake_pay_${providerOrderId.slice(-8)}`;
  const res = await call("webhook", { provider_order_id: providerOrderId, provider_payment_id: providerPaymentId, signature: await signWebhook(secret, providerOrderId, providerPaymentId) }, NETWORK, false);
  return res.ok;
}
