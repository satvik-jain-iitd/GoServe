// The admin app's data calls and input rules (story A2). Row level security lets only an admin write these tables; the people functions check it again.
import type { SupabaseClient } from "@supabase/supabase-js";

export type KitchenRow = { id: string; name: string; address: string | null; phone: string | null; pin_codes: string[]; open: boolean; active: boolean; opens_at?: string | null; closes_at?: string | null };
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
  no_such_user: "No admin account has that email yet. Ask them to sign in to the admin app with Google once, then add them.",   // a cook or rider with no account becomes an invite (story 875); only an admin must exist first
  last_admin: "This is the last admin. Add another admin first.",
  not_allowed: "Not allowed.",
  invalid_kind: "Pick a role, and a kitchen for kitchen staff.",
  reason_required: "Give a reason for the cancel.",
  cannot_cancel: "This order can no longer be cancelled.",
  already_staff: "This person already works for another kitchen. Remove them there first.",
  kitchens_pin_required: "Give the kitchen at least one pin code.",
  kitchens_phone_format: "The phone must be ten digits and start with 6, 7, 8 or 9.",
  kitchens_hours_differ: "The opening time and the closing time must be different.",
  kitchens_name_unique: "A kitchen with this name already exists.",
  menu_items_price_positive: "The price must be more than zero.",
  menu_items_name_unique: "This kitchen already has a dish with this name.",
};
export const adminMessage = (error: { message?: string; details?: string } | null): string | null => {
  if (!error) return null;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(error.message ?? "")) return "No connection. Check the network and try again.";   // story 880: offline is not a database refusal
  if (/violates foreign key constraint "orders_rider/i.test(error.message ?? "")) return "This rider still has orders on record. Try again after the update, or ask the builder.";   // story 880: the old rule, before the migration reaches a database
  if (error.message?.includes("already_staff") && error.details) return `This person already works for ${error.details}. Remove them there first.`;   // story 875: the database names the kitchen
  return Object.entries(MESSAGES).find(([code]) => error.message?.includes(code))?.[1] ?? "That did not work. Try again.";
};

type Client = Pick<SupabaseClient, "from" | "rpc">;
export const isAdmin = async (c: Client): Promise<boolean> => {
  const { data, error } = await c.rpc("is_admin");
  return !error && data === true;
};
export async function listKitchens(c: Client): Promise<KitchenRow[]> {
  const { data, error } = await c.from("kitchens").select("id, name, address, phone, pin_codes, open, active, opens_at, closes_at").order("name");
  if (error) throw error;
  return (data ?? []) as KitchenRow[];
}
export const addKitchen = async (c: Client, k: { name: string; address: string; phone: string; pins: string[]; opensAt?: string; closesAt?: string }) =>
  adminMessage((await c.from("kitchens").insert({ name: k.name, address: k.address || null, phone: k.phone || null, pin_codes: k.pins, opens_at: k.opensAt || null, closes_at: k.closesAt || null })).error);
export type RiderListRow = { user_id: string; name: string | null; phone: string | null; online: boolean; lat?: number | null; lng?: number | null; updated_at?: string };
export async function listRiders(c: Client): Promise<RiderListRow[]> {
  const { data, error } = await c.from("riders").select("user_id, name, phone, online, lat, lng, updated_at").order("name");
  if (error) throw error;
  return (data ?? []) as RiderListRow[];
}
export async function listPeople(c: Client): Promise<Person[]> {
  const { data, error } = await c.rpc("admin_people");
  if (error) throw error;
  return (data ?? []) as Person[];
}
/** invited true: the email has no account yet, so the database kept an invite that turns into the row on the first Google sign-in (story 875). */
export async function addPerson(c: Client, email: string, kind: PersonKind, kitchen: string | null): Promise<{ error: string | null; invited: boolean }> {
  const { data, error } = await c.rpc("admin_add_person", { p_email: email.trim(), p_kind: kind, p_kitchen: kind === "kitchen" ? kitchen : null });
  return error ? { error: adminMessage(error), invited: false } : { error: null, invited: (data as { invited?: boolean } | null)?.invited === true };
}
export type Invite = { id: string; email: string; kind: "kitchen" | "rider"; kitchen_id: string | null; kitchen_name: string | null; created_at: string };
export async function listInvites(c: Client): Promise<Invite[]> {
  const { data, error } = await c.rpc("admin_invites");
  if (error) throw error;
  return (data ?? []) as Invite[];
}
export const cancelInvite = async (c: Client, id: string) => adminMessage((await c.rpc("admin_cancel_invite", { p_id: id })).error);
/** The link an invited person opens: the kitchen app for a cook, the rider app for a rider. */
export const inviteLink = (kind: "kitchen" | "rider", origin: string): string => `${origin.replace(/\/$/, "")}/${kind}/`;
/** The gate's safety check (story 875): how many waiting invites this signed-in account just claimed. Any failure is 0 and the gate carries on. */
export async function claimInvites(c: Client): Promise<number> {
  try {
    const { data, error } = await c.rpc("claim_my_invites");
    return error || typeof data !== "number" ? 0 : data;
  } catch {
    return 0;
  }
}
/** Story #900: the admin removes a kitchen (deactivate, never delete). null when it worked, else a line in the admin's words. The database refuses while orders are open. */
export async function removeKitchen(c: Client, kitchenId: string): Promise<string | null> {
  const { data, error } = await c.rpc("kitchen_remove_v2", { p_kitchen: kitchenId });
  if (error) return error.message?.includes("not_allowed") ? "Only an admin can remove a kitchen." : "Could not remove the kitchen. Try again.";
  if (data?.ok === true) return null;
  return data?.error === "orders_open" ? "This kitchen still has orders to finish. Remove it when they are done." : "Could not remove the kitchen. Try again.";
}
export const removePerson = async (c: Client, p: Person) => adminMessage((await c.rpc("admin_remove_person", { p_kind: p.kind, p_user: p.user_id, p_kitchen: p.kitchen_id })).error);

// Menu (story A3). Prices are typed in rupees and kept in paise.
export const rupeesToPaise = (text: string): number | null => {
  const t = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const paise = Math.round(parseFloat(t) * 100);
  return paise > 0 ? paise : null;
};
const MAX_PHOTO = 3 * 1024 * 1024;
export const photoProblem = (f: { type: string; size: number }): string | null =>
  !f.type.startsWith("image/") ? "The photo must be a picture." : f.size > MAX_PHOTO ? "The photo must be 3 MB or less." : null;
export const photoPath = (kitchenId: string, fileName: string, id: string): string => {
  const ext = /\.(jpe?g|png|webp|gif)$/i.exec(fileName)?.[1].toLowerCase().replace("jpeg", "jpg") ?? "jpg";
  return `${kitchenId}/${id}.${ext}`;
};

export type DishRow = { id: string; name: string; price_paise: number; available: boolean; veg: boolean; category: string | null; image_url: string | null; description?: string | null };
export async function listDishes(c: Client, kitchenId: string): Promise<DishRow[]> {
  const { data, error } = await c.from("menu_items").select("id, name, price_paise, available, veg, category, image_url").eq("kitchen_id", kitchenId).order("sort").order("name");
  if (error) throw error;
  return (data ?? []) as DishRow[];
}
type Store = SupabaseClient["storage"];
export async function addDish(c: Client & { storage: Store }, d: { kitchenId: string; name: string; paise: number; veg: boolean; category: string; description?: string; photo: File | null }): Promise<string | null> {
  let image_url: string | null = null;
  if (d.photo) {
    const path = photoPath(d.kitchenId, d.photo.name, crypto.randomUUID());
    const up = await c.storage.from("menu").upload(path, d.photo, { contentType: d.photo.type });
    if (up.error) return "The photo could not be uploaded. Try again.";
    image_url = c.storage.from("menu").getPublicUrl(path).data.publicUrl;
  }
  return adminMessage((await c.from("menu_items").insert({ kitchen_id: d.kitchenId, name: d.name, price_paise: d.paise, veg: d.veg, category: d.category || null, description: d.description?.trim() || null, image_url })).error);
}
export const setDish = async (c: Client, id: string, change: { available?: boolean; price_paise?: number }) => adminMessage((await c.from("menu_items").update(change).eq("id", id)).error);
export const deleteDish = async (c: Client, id: string) => adminMessage((await c.from("menu_items").delete().eq("id", id)).error);

// Orders and the day's numbers (story A4). "Today" is the day in India, whatever the phone's own clock zone says.
export type AdminOrder = { id: string; kitchen_id: string; status: string; created_at: string; updated_at?: string; total_paise: number; items: { name: string; qty: number; price_paise?: number }[]; address: string; customer_name: string | null; customer_phone: string | null; cancel_reason: string | null; rider_id?: string | null };
export const LIVE = ["placed", "accepted", "preparing", "ready", "out_for_delivery"];
export const liveOrders = (orders: AdminOrder[]): AdminOrder[] => orders.filter((o) => LIVE.includes(o.status));
export const doneOrders = (orders: AdminOrder[]): AdminOrder[] => orders.filter((o) => !LIVE.includes(o.status));
export type DayNumbers = { kitchen_id: string; kitchen_name: string; orders: number; delivered: number; cancelled: number; cash_paise: number; day?: string };

export const istDayStart = (now: Date): string => {
  const IST = 330 * 60 * 1000;   // UTC+5:30, no daylight saving
  const local = new Date(now.getTime() + IST);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - IST).toISOString();
};
export const filterAdminOrders = (orders: AdminOrder[], kitchen: string, status: string): AdminOrder[] =>
  orders.filter((o) => (!kitchen || o.kitchen_id === kitchen) && (!status || o.status === status));
export const sumNumbers = (rows: DayNumbers[]) =>
  rows.reduce((t, r) => ({ orders: t.orders + r.orders, delivered: t.delivered + r.delivered, cancelled: t.cancelled + r.cancelled, cash_paise: t.cash_paise + Number(r.cash_paise) }), { orders: 0, delivered: 0, cancelled: 0, cash_paise: 0 });

export async function listTodayOrders(c: Client): Promise<AdminOrder[]> {
  const { data, error } = await c.from("orders").select("id, kitchen_id, status, created_at, updated_at, total_paise, items, address, customer_name, customer_phone, cancel_reason, rider_id")
    .gte("created_at", istDayStart(new Date())).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminOrder[];
}
export async function dayNumbers(c: Client): Promise<DayNumbers[]> {
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await c.from("day_numbers").select("day, kitchen_id, kitchen_name, orders, delivered, cancelled, cash_paise").eq("day", today).order("kitchen_name");
  if (error) throw error;
  return (data ?? []) as DayNumbers[];
}
export const cancelOrder = async (c: Client, id: string, reason: string) => adminMessage((await c.rpc("cancel_order", { p_order: id, p_reason: reason })).error);
