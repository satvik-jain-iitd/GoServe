// Story 1448: the server rule for Change on the rider's Delivered slip, against goserve-dev (skipped when the dev keys are not set; CI has none).
// Only the order's own rider, only cash or UPI at the door, only before the night's hand-over. Run as in supabase.test.ts.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const KITCHEN = "11111111-1111-1111-1111-111111111111";
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");   // never production

describe.skipIf(!isDev || !anon || !service)("rider_change_paid on goserve-dev", () => {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const keys: string[] = [];
  const users: string[] = [];
  const rider = async (): Promise<{ client: SupabaseClient; id: string }> => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await client.auth.signInAnonymously();
    users.push(data.user!.id);
    return { client, id: data.user!.id };
  };
  const delivered = async (riderId: string, extra: Record<string, unknown> = {}): Promise<string> => {
    const key = `cp-${crypto.randomUUID()}`;
    keys.push(key);
    const { data, error } = await admin.from("orders").insert({ kitchen_id: KITCHEN, session_id: riderId, client_order_key: key, items: [], total_paise: 100, address: "test", status: "delivered", rider_id: riderId, paid_by: "cash", ...extra }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  };
  afterAll(async () => {
    if (keys.length) await admin.from("orders").delete().in("client_order_key", keys);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  it("the order's own rider changes cash to UPI before the hand-over", async () => {
    const r = await rider();
    const id = await delivered(r.id);
    expect((await r.client.rpc("rider_change_paid", { p_order: id, p_method: "upi_door" })).data).toEqual({ ok: true, paid_by: "upi_door" });
    expect((await admin.from("orders").select("paid_by").eq("id", id).single()).data).toEqual({ paid_by: "upi_door" });
  });

  it("another rider is refused, and so is a method that is not cash or UPI", async () => {
    const r = await rider();
    const other = await rider();
    const id = await delivered(r.id);
    expect((await other.client.rpc("rider_change_paid", { p_order: id, p_method: "upi_door" })).data).toEqual({ ok: false, error: "order_not_found" });
    expect((await r.client.rpc("rider_change_paid", { p_order: id, p_method: "card" })).data).toEqual({ ok: false, error: "bad_method" });
  });

  it("after the night's hand-over the server refuses a change, even on a UPI order", async () => {
    const r = await rider();
    const upi = await delivered(r.id, { paid_by: "upi_door" });
    await delivered(r.id, { cash_handed_at: new Date(Date.now() + 1000).toISOString() });
    expect((await r.client.rpc("rider_change_paid", { p_order: upi, p_method: "cash" })).data).toEqual({ ok: false, error: "handed_over" });
  });
});
