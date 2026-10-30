// Story #551: the phone code at checkout. /otp/send and /otp/verify link the number to the guest's own user.
// Story #802: a number that already has an account is answered `sign_in` by the server, on send, before any code is spent. The sheet then takes
// Supabase's own phone sign-in, so the customer gets ONE code, and /otp/claim moves the guest's orders to that account (story #558).
// The words of a refusal are the server's (the contract's). A server fault with an error word but no message gets our line for that word (story #786); only a lost network, or an answer that is not JSON, gets the network line.
import { getClient } from "./supabase";

// `signIn`: this number already has an account, so the sign-in path owns the code. Never set on a refusal.
export type OtpResult = { ok: true; phone?: string; signIn?: true } | { ok: false; error: string; message: string };
const NETWORK: OtpResult = { ok: false, error: "network", message: "Could not reach GoServe. Try again." };
const FAULTS: Record<string, string> = { otp_unavailable: "Codes are down for a moment. Try again in a minute." };
const FAULT = "Something went wrong on our side. Try again in a minute.";
export const toPhone = (digits: string) => `+91${digits}`;
export const showPhone = (d: string) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
export const isMobile = (d: string) => /^[6-9]\d{9}$/.test(d);

// The answer the server gave, as the sheet reads it. The whole contract in one place, so it can be tested without a network.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const readAnswer = (ok: boolean, a: any): OtpResult =>
  ok && a?.ok
    ? { ok: true, phone: typeof a.phone === "string" ? a.phone : undefined, ...(a.sign_in === true ? { signIn: true as const } : {}) }
    : a?.ok === false && typeof a.error === "string"
      ? { ok: false, error: a.error, message: typeof a.message === "string" ? a.message : FAULTS[a.error] ?? FAULT }
      : NETWORK;   // not JSON, or JSON outside the contract: the line says we could not reach the server

async function call(route: "send" | "verify" | "claim", body: object, token?: string): Promise<OtpResult> {
  try {
    const t = token ?? (await getClient().auth.getSession()).data.session?.access_token ?? "";
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/otp/${route}`, {
      method: "POST", headers: { "content-type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, authorization: `Bearer ${t}` }, body: JSON.stringify(body),
    });
    return readAnswer(res.ok, await res.json().catch(() => null));
  } catch {
    return NETWORK;
  }
}

export const sendCode = (phone: string) => call("send", { phone });
export const verifyCode = (phone: string, code: string) => call("verify", { phone, code });

// The returning customer: Supabase sends and checks its own code, the session becomes the old account's, then the guest's orders move.
export async function sendSignInCode(phone: string): Promise<OtpResult> {
  const { error } = await getClient().auth.signInWithOtp({ phone: toPhone(phone) });
  if (!error) return { ok: true };
  return error.status === 429 ? { ok: false, error: "too_many_sends", message: "Too many codes. Try again in a few minutes." } : NETWORK;
}
export async function finishSignIn(phone: string, code: string, guestToken: string): Promise<OtpResult> {
  const { data, error } = await getClient().auth.verifyOtp({ phone: toPhone(phone), token: code, type: "sms" });
  if (error || !data.session) return { ok: false, error: "wrong_code", message: "That code is not right." };
  const claimed = await call("claim", { guest_token: guestToken }, data.session.access_token);
  return claimed.ok ? { ok: true, phone } : claimed;
}
