// Sign in with Google (story S-M1, ADR-016). The Google identity is linked to the anonymous user, so the session id stays the same.
import type { SupabaseClient } from "@supabase/supabase-js";

type UserLike = { is_anonymous?: boolean; email?: string; user_metadata?: Record<string, unknown> } | null | undefined;

export const signedInName = (u: UserLike): string | null =>
  !u || u.is_anonymous ? null : (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined) || u.email || null;

// The first name from the Google profile (story 527), or null while the user is still anonymous.
export const givenNameOf = (u: UserLike): string | null => {
  if (!u || u.is_anonymous) return null;
  const m = u.user_metadata;
  return ((m?.given_name as string | undefined) || ((m?.full_name as string | undefined) || (m?.name as string | undefined) || "").trim().split(/\s+/)[0]) || null;
};

// Returns null on success (the browser goes to Google), or a plain message.
// "link" (the customer app) keeps the anonymous user, so the session id stays. "signin" (kitchen, rider, ops; story S-M5) becomes the Google user
// that may already exist, because linking fails when that Google account belongs to another user.
type AuthLike = Pick<SupabaseClient["auth"], "linkIdentity"> & Partial<Pick<SupabaseClient["auth"], "signInWithOAuth">>;
export async function linkGoogle(client: { auth: AuthLike }, redirectTo: string, mode: "link" | "signin" = "link"): Promise<string | null> {
  const args = { provider: "google" as const, options: { redirectTo } };
  const { error } = mode === "signin" ? await client.auth.signInWithOAuth!(args) : await client.auth.linkIdentity(args);
  return error ? "Could not start Google sign-in. Try again." : null;
}

// A failed link comes back with ?error_description=... (or in the hash). Show it once, then clear it from the address.
export const authErrorFrom = (search: string, hash: string): string | null =>
  new URLSearchParams(search).get("error_description") ?? new URLSearchParams(hash.replace(/^#/, "")).get("error_description");

// Story #635: a Google identity that is already on another user is not shown as an error: say so kindly and sign in to that user.
// Any other failure gets our own line. The auth server's words never reach the screen.
export const ALREADY_IN_USE = "This Google account is already in use. Signing you in.";
export function friendlyAuth(search: string, hash: string): { message: string; signIn: boolean } | null {
  const q = new URLSearchParams(search), h = new URLSearchParams(hash.replace(/^#/, ""));
  const desc = q.get("error_description") ?? h.get("error_description"), code = q.get("error_code") ?? h.get("error_code");
  if (desc === null && code === null) return null;
  if (code === "identity_already_exists" || /already linked/i.test(desc ?? "")) return { message: ALREADY_IN_USE, signIn: true };
  return { message: "Could not sign in with Google. Try again.", signIn: false };
}

// Back from Google the app opens the screen the tap came from. Story #801: the welcome screen (O0, story #667) shows the same button to a
// first-time customer, and they came for the menu, not for an empty account page, so every caller says where it is and the default is the menu.
export type ReturnScreen = "account" | "menu";
const RETURN = "gs-return", TRIED = "gs-signin-tried";
export const rememberReturn = (to: ReturnScreen): void => { try { window.sessionStorage.setItem(RETURN, to); } catch { /* the menu opens */ } };
export const takeReturn = (): boolean => { try { const v = window.sessionStorage.getItem(RETURN) === "account"; window.sessionStorage.removeItem(RETURN); return v; } catch { return false; } };
// One automatic sign in per tap: if Google comes back with the same error after it, the line stays and nothing loops.
export const takeTried = (): boolean => { try { const v = window.sessionStorage.getItem(TRIED) === "1"; window.sessionStorage.removeItem(TRIED); return v; } catch { return false; } };
export const markTried = (): void => { try { window.sessionStorage.setItem(TRIED, "1"); } catch { /* no loop guard: one try per page load below */ } };

// Story 842: a tap on Continue with Google leaves a note on the phone. Back from Google with no session and no error in the address, the screen would stay silent
// (the owner's sign-out then sign-in loop on a phone showed the welcome screen again and nothing else). The note lets the screen say so. It is in localStorage, not
// session storage, because the sign-in can come back in another browser context on a phone. It ends at the first completed sign-in, and after ten minutes.
const STARTED = "gs-google-started";
export const DID_NOT_FINISH = "Google sign-in did not finish. Try again.";
export const markGoogleStarted = (): void => { try { window.localStorage.setItem(STARTED, String(Date.now())); } catch { /* no note: no message, never an error */ } };
export const clearGoogleStarted = (): void => { try { window.localStorage.removeItem(STARTED); } catch { /* blocked */ } };
export const takeGoogleStarted = (now = Date.now()): boolean => {
  try { const at = Number(window.localStorage.getItem(STARTED)); window.localStorage.removeItem(STARTED); return Number.isFinite(at) && at > 0 && now - at < 10 * 60_000; } catch { return false; }
};
