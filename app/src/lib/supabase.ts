// The Supabase side of the phone: an anonymous session (its id is the session id, ADR-010) and the menu read.
// The client is made on first use, so a missing key shows a message instead of a blank page.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { wasSignedIn } from "./deviceOwner";
import type { Dish } from "./menu";

let client: SupabaseClient | null = null;
export const getClient = (): SupabaseClient => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("The app is not set up: missing Supabase keys.");
  return (client ??= createClient(url, key));
};

// Every Sign out button ends this phone's login only. The default scope is global and ends the same person's logins on every phone and app (story 1583).
// Only deleting the account signs out global: the account is gone everywhere.
export const signOutHere = (c: SupabaseClient = getClient()) => c.auth.signOut({ scope: "local" });

// Retries are off and the wait is short: with a bad network the saved menu should show in seconds, not after the library's retries.
const MENU_TIMEOUT_MS = 4000;
export async function fetchMenuRows(kitchenId?: string): Promise<Dish[]> {
  if (navigator.onLine === false) throw new Error("offline");
  let q = getClient().from("menu_items").select("id, name, price_paise, image_url, image_credit, veg, category, available, description");   // story #619: a sold-out dish comes too, with its flag
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
    if (res.error || !res.data.user) throw new Error("Could not connect. Check your internet and try again.");
    return res.data.user.id;
  })().finally(() => { starting = null; });
  return starting;
}

// Story 1586: the customer's sign-in ended (lost, refused, or the phone's login is only a guest). The customer app shows the wall; nothing is ordered as a guest.
export class SessionEnded extends Error {
  constructor() { super("The sign-in ended."); }
}
// The customer app's session: a real user, or SessionEnded when the phone's real owner lost the login. A guest login with no real owner on the phone (a first visit, or a phone-code
// customer, whose user stays anonymous with the phone attached) is left as before. A phone that never had a real user still gets a first login.
export async function ensureCustomerSession(): Promise<string> {
  const u = (await getClient().auth.getSession()).data.session?.user;
  if (u && !u.is_anonymous) return u.id;
  if (wasSignedIn()) throw new SessionEnded();   // a real user whose login is gone: the wall, not a guest
  return u ? u.id : ensureSession();
}

// The rider on a customer's order, once there is one (story D2). The database answers only for the caller's own order.
export type RiderCard = { name: string; phone: string };
export async function fetchRiderCard(orderId: string): Promise<RiderCard | null> {
  const { data, error } = await getClient().rpc("order_rider", { p_order: orderId });
  if (error || !Array.isArray(data) || !data[0]?.phone) return null;
  return { name: data[0].name || "Your rider", phone: data[0].phone };
}
