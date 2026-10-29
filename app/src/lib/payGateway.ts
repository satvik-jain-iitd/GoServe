// Story #552: the payment sheet of the gateway, and the test helper that stands in for the gateway's webhook.
// PLACEHOLDER (owner click): Razorpay — this app opens no real payment sheet yet. When the owner's Razorpay KYC is done: open Razorpay Checkout with the
// provider_order_id in `openGateway` (this file), set VITE_PAYMENTS_PROVIDER=razorpay and VITE_RAZORPAY_KEY_ID, set `gatewayBuilt` to true.
// The backend half is supabase/functions/_shared/razorpay.ts. Both are listed under the Razorpay row of docs/product/founder-checklist.md ("code seam").
type Env = { VITE_PAYMENTS_PROVIDER?: string; VITE_PAYMENTS_PLACEHOLDER?: string; VITE_PAYMENTS_DEV_SECRET?: string };
export type Created = { provider: string; provider_order_id: string; amount_paise: number };

const gatewayBuilt = false;

// The provider is switched on in the environment but this file still holds the placeholder: a customer would wait for a sheet that never opens.
export const placeholderLeft = (env: Env): boolean => env.VITE_PAYMENTS_PROVIDER === "razorpay" && !gatewayBuilt;

// Opens the real sheet; the placeholder opens nothing and the screen says "Test payment: no money moves."
export async function openGateway(_created: Created, env: Env): Promise<"placeholder" | "opened"> {
  if (env.VITE_PAYMENTS_PROVIDER !== "razorpay") return "placeholder";
  if (!gatewayBuilt) throw new Error("razorpay sheet not built yet: owner click pending");
  return "opened";
}

// The dev helper (a button on the waiting panel) exists only when VITE_PAYMENTS_PLACEHOLDER=1 and a dev secret is set. The secret is a dev value, public by design,
// like the simulator token: it signs for the test double only. A real build never sets it.
export const devHelperOn = (env: Env): boolean => env.VITE_PAYMENTS_PLACEHOLDER === "1" && !!env.VITE_PAYMENTS_DEV_SECRET;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function signWebhook(secret: string, providerOrderId: string, providerPaymentId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${providerOrderId}|${providerPaymentId}`)));
}
