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

export type DishRow = { id: string; name: string; price_paise: number; available: boolean; veg: boolean; category: string | null; image_url: string | null };
export async function listDishes(c: Client, kitchenId: string): Promise<DishRow[]> {
  const { data, error } = await c.from("menu_items").select("id, name, price_paise, available, veg, category, image_url").eq("kitchen_id", kitchenId).order("sort").order("name");
  if (error) throw error;
  return (data ?? []) as DishRow[];
}
type Store = SupabaseClient["storage"];
export async function addDish(c: Client & { storage: Store }, d: { kitchenId: string; name: string; paise: number; veg: boolean; category: string; photo: File | null }): Promise<string | null> {
  let image_url: string | null = null;
  if (d.photo) {
    const path = photoPath(d.kitchenId, d.photo.name, crypto.randomUUID());
    const up = await c.storage.from("menu").upload(path, d.photo, { contentType: d.photo.type });
    if (up.error) return "The photo could not be uploaded. Try again.";
    image_url = c.storage.from("menu").getPublicUrl(path).data.publicUrl;
  }
  return adminMessage((await c.from("menu_items").insert({ kitchen_id: d.kitchenId, name: d.name, price_paise: d.paise, veg: d.veg, category: d.category || null, image_url })).error);
}
export const setDish = async (c: Client, id: string, change: { available?: boolean; price_paise?: number }) => adminMessage((await c.from("menu_items").update(change).eq("id", id)).error);
export const deleteDish = async (c: Client, id: string) => adminMessage((await c.from("menu_items").delete().eq("id", id)).error);
