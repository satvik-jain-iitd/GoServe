// Sign in with Google (story S-M1, ADR-016). The Google identity is linked to the anonymous user, so the session id stays the same.
import type { SupabaseClient } from "@supabase/supabase-js";

type UserLike = { is_anonymous?: boolean; email?: string; user_metadata?: Record<string, unknown> } | null | undefined;

export const signedInName = (u: UserLike): string | null =>
  !u || u.is_anonymous ? null : (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined) || u.email || null;

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
