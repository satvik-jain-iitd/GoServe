// Story #551: the phone code at checkout. /otp/send and /otp/verify link the number to the guest's own user; a number that belongs to someone else
// (phone_in_use) can sign in with Supabase's own phone sign-in, and /otp/claim then moves the guest's orders to that account (story #558).
// The words of a refusal are the server's (the contract's); only a lost network gets our own line.
import { getClient } from "./supabase";

export type OtpResult = { ok: true; phone?: string } | { ok: false; error: string; message: string };
const NETWORK: OtpResult = { ok: false, error: "network", message: "Could not reach GoServe. Try again." };
export const toPhone = (digits: string) => `+91${digits}`;
export const showPhone = (d: string) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
export const isMobile = (d: string) => /^[6-9]\d{9}$/.test(d);

async function call(route: "send" | "verify" | "claim", body: object, token?: string): Promise<OtpResult> {
  try {
    const t = token ?? (await getClient().auth.getSession()).data.session?.access_token ?? "";
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/otp/${route}`, {
      method: "POST", headers: { "content-type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, authorization: `Bearer ${t}` }, body: JSON.stringify(body),
    });
    const a = await res.json().catch(() => null);
    if (res.ok && a?.ok) return { ok: true, phone: typeof a.phone === "string" ? a.phone : undefined };
    if (a?.ok === false && typeof a.error === "string" && typeof a.message === "string") return { ok: false, error: a.error, message: a.message };
    return NETWORK;   // a 502 or anything outside the contract: no detail is shown
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
