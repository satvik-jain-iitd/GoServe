// Sign in with Google (story S-M1, ADR-016). The Google identity is linked to the anonymous user, so the session id stays the same.
import type { SupabaseClient } from "@supabase/supabase-js";

type UserLike = { is_anonymous?: boolean; email?: string; user_metadata?: Record<string, unknown> } | null | undefined;

export const signedInName = (u: UserLike): string | null =>
  !u || u.is_anonymous ? null : (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined) || u.email || null;

// Returns null on success (the browser goes to Google), or a plain message.
export async function linkGoogle(client: { auth: Pick<SupabaseClient["auth"], "linkIdentity"> }, redirectTo: string): Promise<string | null> {
  const { error } = await client.auth.linkIdentity({ provider: "google", options: { redirectTo } });
  return error ? "Could not start Google sign-in. Try again." : null;
}

// A failed link comes back with ?error_description=... (or in the hash). Show it once, then clear it from the address.
export const authErrorFrom = (search: string, hash: string): string | null =>
  new URLSearchParams(search).get("error_description") ?? new URLSearchParams(hash.replace(/^#/, "")).get("error_description");
