// The Supabase side of the phone: an anonymous session (its id is the session id, ADR-010) and the menu read.
// The client is made on first use, so a missing key shows a message instead of a blank page.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Dish } from "./menu";

let client: SupabaseClient | null = null;
export const getClient = (): SupabaseClient => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("The app is not set up: missing Supabase keys.");
  return (client ??= createClient(url, key));
};

// Retries are off and the wait is short: with a bad network the saved menu should show in seconds, not after the library's retries.
const MENU_TIMEOUT_MS = 4000;
export async function fetchMenuRows(kitchenId?: string): Promise<Dish[]> {
  if (navigator.onLine === false) throw new Error("offline");
  let q = getClient().from("menu_items").select("id, name, price_paise, image_url, image_credit").eq("available", true);
  if (kitchenId) q = q.eq("kitchen_id", kitchenId);
  const { data, error } = await q.order("name")
    .retry(false).abortSignal(AbortSignal.timeout(MENU_TIMEOUT_MS));
  if (error) throw error;
  return data ?? [];
}

// Two parts of the screen can ask at the same moment (the sign-in line and the order list): they share one request, so only one anonymous user is made.
let starting: Promise<string> | null = null;
export function ensureSession(): Promise<string> {
  starting ??= (async () => {
    const c = getClient();
    const { data } = await c.auth.getSession();
    if (data.session) return data.session.user.id;
    const res = await c.auth.signInAnonymously();
    if (res.error || !res.data.user) throw new Error("Could not start a session. Check your connection and try again.");
    return res.data.user.id;
  })().finally(() => { starting = null; });
  return starting;
}
