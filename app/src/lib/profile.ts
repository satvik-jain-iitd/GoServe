// The customer's saved details, the delivery estimate and the order summary (story B3).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "./kitchen";

export type Profile = { name: string; phone: string; address: string };

export const isPhone = (text: string): boolean => /^\d{10}$/.test(text);

// Cooking 15 minutes, then 1.5 minutes a kilometre, never under 20. The distance is not known yet (the customer's place is not collected),
// so the answer is the minimum until it is. (ponytail: pass km when coordinates exist.)
export const etaMinutes = (km?: number): number => Math.max(20, Math.round(15 + (km ?? 0) * 1.5));

export const orderSummary = (o: Pick<Order, "items">): string => o.items.map((i) => `${i.qty} × ${i.name}`).join(", ");

type Client = Pick<SupabaseClient, "from">;
export async function loadProfile(c: Client): Promise<Profile | null> {
  const { data, error } = await c.from("customers").select("name, phone, address").limit(1);   // row level security: only the user's own row
  if (error || !data?.[0]) return null;
  const r = data[0] as Partial<Profile>;
  return { name: r.name ?? "", phone: r.phone ?? "", address: r.address ?? "" };
}

export async function saveProfile(c: Client, userId: string, p: Profile & { pin: string | null }): Promise<boolean> {
  const { error } = await c.from("customers").upsert({ user_id: userId, name: p.name.trim(), phone: p.phone, address: p.address.trim(), pin_code: p.pin, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return !error;
}
