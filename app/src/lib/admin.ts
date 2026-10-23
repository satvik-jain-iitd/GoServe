// The admin app's data calls and input rules (story A2). Row level security lets only an admin write these tables; the people functions check it again.
import type { SupabaseClient } from "@supabase/supabase-js";

export type KitchenRow = { id: string; name: string; address: string | null; phone: string | null; pin_codes: string[]; open: boolean; active: boolean };
export type PersonKind = "kitchen" | "rider" | "admin";
export type Person = { kind: PersonKind; user_id: string; email: string | null; kitchen_id: string | null; kitchen_name: string | null };

// Pin codes: six digits each, separated by commas or spaces; repeats are dropped; anything else is named back to the admin.
export function parsePins(text: string): { pins: string[]; bad: string[] } {
  const pins: string[] = [];
  const bad: string[] = [];
  for (const part of text.split(/[\s,]+/).filter(Boolean)) {
    if (!/^\d{6}$/.test(part)) bad.push(part);
    else if (!pins.includes(part)) pins.push(part);
  }
  return { pins, bad };
}

const MESSAGES: Record<string, string> = {
  no_such_user: "No Google user has that email yet. Ask them to open the app and sign in with Google once.",
  last_admin: "This is the last admin. Add another admin first.",
  not_allowed: "Not allowed.",
  invalid_kind: "Pick a role, and a kitchen for kitchen staff.",
};
export const adminMessage = (error: { message?: string } | null): string | null =>
  !error ? null : Object.entries(MESSAGES).find(([code]) => error.message?.includes(code))?.[1] ?? "That did not work. Try again.";

type Client = Pick<SupabaseClient, "from" | "rpc">;
export const isAdmin = async (c: Client): Promise<boolean> => {
  const { data, error } = await c.rpc("is_admin");
  return !error && data === true;
};
export async function listKitchens(c: Client): Promise<KitchenRow[]> {
  const { data, error } = await c.from("kitchens").select("id, name, address, phone, pin_codes, open, active").order("name");
  if (error) throw error;
  return (data ?? []) as KitchenRow[];
}
export const addKitchen = async (c: Client, k: { name: string; address: string; phone: string; pins: string[] }) =>
  adminMessage((await c.from("kitchens").insert({ name: k.name, address: k.address || null, phone: k.phone || null, pin_codes: k.pins })).error);
export async function listPeople(c: Client): Promise<Person[]> {
  const { data, error } = await c.rpc("admin_people");
  if (error) throw error;
  return (data ?? []) as Person[];
}
export const addPerson = async (c: Client, email: string, kind: PersonKind, kitchen: string | null) =>
  adminMessage((await c.rpc("admin_add_person", { p_email: email.trim(), p_kind: kind, p_kitchen: kind === "kitchen" ? kitchen : null })).error);
export const removePerson = async (c: Client, p: Person) => adminMessage((await c.rpc("admin_remove_person", { p_kind: p.kind, p_user: p.user_id, p_kitchen: p.kitchen_id })).error);
