// Which session a device works in (story #52, ADR-011): its own, or one it joined by a link. And the reset call.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSession } from "./supabase";

const JOINED_KEY = "gs-joined-session";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const joinCode = (search: string): string | null => {
  const id = new URLSearchParams(search).get("join");
  return id && ID.test(id) ? id : null;
};

// Storage can be blocked (private window); then the device simply stays in its own session.
export const rememberJoin = (id: string, store: Storage = window.localStorage) => {
  try {
    store.setItem(JOINED_KEY, id);
  } catch { /* stays in its own session */ }
};
export const activeSession = (own: string, store: Storage = window.localStorage): string => {
  try {
    return store.getItem(JOINED_KEY) ?? own;
  } catch {
    return own;
  }
};

export const joinLink = (here: string, session: string): string => {
  const u = new URL(here);
  u.search = "";
  u.hash = "";
  return `${u.toString()}?join=${session}`;
};

export async function joinSession(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("join_session", { p_session: id });
  if (error) throw new Error("Could not join that demo. Ask for a new link.");
}

export async function resetSession(client: Pick<SupabaseClient, "rpc">, session: string): Promise<void> {
  const { error } = await client.rpc("reset_session", { p_session: session });
  if (error) throw new Error("Could not reset. Try again.");
}

// The session id for reads and new orders: the joined one, or this device's own.
export const currentSession = async (): Promise<string> => activeSession(await ensureSession());

// Story S-M5: a kitchen worker (a Google user listed in kitchen_staff) reads every order of the kitchen; anyone else reads one session.
export type Scope = { column: "kitchen_id" | "session_id" | "rider_id"; value: string };
export const scopeFor = (kitchenId: string | null, session: string): Scope =>
  kitchenId ? { column: "kitchen_id", value: kitchenId } : { column: "session_id", value: session };

// A rider (story A5) reads the orders assigned to them, wherever the kitchen is.
export const riderScope = (userId: string): Scope => ({ column: "rider_id", value: userId });

// The user can read only their own staff row (RLS), so no filter is needed. A failed read counts as "not staff".
export async function myKitchen(client: Pick<SupabaseClient, "from">): Promise<string | null> {
  const { data, error } = await client.from("kitchen_staff").select("kitchen_id").limit(1);
  return error ? null : ((data?.[0] as { kitchen_id?: string } | undefined)?.kitchen_id ?? null);
}
