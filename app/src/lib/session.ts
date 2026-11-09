// Which session a device works in: always its own (story #938 retired joining by link).
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSession } from "./supabase";

const JOINED_KEY = "gs-joined-session";

// Story #938: a link can no longer choose a device's session. Older versions saved one in this key; remove it.
export const dropOldJoin = (store: Storage = window.localStorage): void => {
  try {
    store.removeItem(JOINED_KEY);
  } catch { /* storage blocked: nothing was saved */ }
};

// The session id for reads and new orders: always this device's own.
export const currentSession = async (): Promise<string> => ensureSession();

// Story S-M5: a kitchen worker (a Google user listed in kitchen_staff) reads every order of the kitchen; anyone else reads one session.
export type Scope = { column: "kitchen_id" | "session_id" | "rider_id"; value: string };
export const scopeFor = (kitchenId: string | null, session: string): Scope =>
  kitchenId ? { column: "kitchen_id", value: kitchenId } : { column: "session_id", value: session };

// A rider (story A5) reads the orders assigned to them, wherever the kitchen is.
export const riderScope = (userId: string): Scope => ({ column: "rider_id", value: userId });

// An admin can read every staff row (RLS), so the query must ask for this user's row. A failed read counts as "not staff". One kitchen per user (migration 0023).
export async function myKitchen(client: Pick<SupabaseClient, "from">, userId: string): Promise<string | null> {
  const { data, error } = await client.from("kitchen_staff").select("kitchen_id").eq("user_id", userId).limit(1);
  return error ? null : ((data?.[0] as { kitchen_id?: string } | undefined)?.kitchen_id ?? null);
}
