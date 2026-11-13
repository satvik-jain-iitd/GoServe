// Stories 1443 and 1438, against goserve-dev (skipped when the dev keys are not set; CI has none). Run as in supabase.test.ts.
// Only an admin may save the incentive; and a delivery is priced at its delivery time, even after a real Change and a real hand-over.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { incentiveFor } from "../../src/lib/incentive";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const KITCHEN = "11111111-1111-1111-1111-111111111111";
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");   // never production

describe.skipIf(!isDev || !anon || !service)("rider incentive on goserve-dev", () => {
  let admin: SupabaseClient;   // made in beforeAll: without the dev keys the file is skipped, never crashes at load
  const users: string[] = [];
  const keys: string[] = [];
  beforeAll(() => { admin = createClient(url!, service!, { auth: { persistSession: false } }); });
  const session = async () => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await client.auth.signInAnonymously();
    users.push(data.user!.id);
    return { client, id: data.user!.id };
  };
  afterAll(async () => {
    if (keys.length) await admin.from("orders").delete().in("client_order_key", keys);
    await admin.from("kitchen_staff").delete().in("user_id", users);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  it("a person who is not an admin is refused, and a stranger cannot read the rates", async () => {
    const c = await session();
    expect((await c.client.rpc("rider_incentive_set_v2", { p_on: true, p_amount_paise: 1000 })).error?.code).toBe("42501");
    expect((await c.client.rpc("rider_incentive_rates")).error?.code).toBe("42501");
  });

  it("a cash delivery keeps its own rate after a real Change and a real kitchen hand-over", async () => {
    const r = await session();
    const k = await session();
    expect((await admin.from("kitchen_staff").insert({ kitchen_id: KITCHEN, user_id: k.id })).error).toBeNull();
    const key = `inc-${crypto.randomUUID()}`;
    keys.push(key);
    const { data } = await admin.from("orders").insert({ kitchen_id: KITCHEN, session_id: r.id, client_order_key: key, items: [], total_paise: 100, address: "test", status: "delivered", rider_id: r.id, paid_by: "cash" }).select("id, delivered_at").single();
    const delivered = data!.delivered_at as string;
    const log = [{ at: new Date(Date.parse(delivered) - 60_000).toISOString(), on: true, amount_paise: 1000 }, { at: new Date(Date.parse(delivered) + 1).toISOString(), on: true, amount_paise: 2000 }];
    await r.client.rpc("rider_change_paid", { p_order: data!.id, p_method: "upi_door" });
    await r.client.rpc("rider_change_paid", { p_order: data!.id, p_method: "cash" });
    expect((await k.client.rpc("kitchen_handover", { p_rider: r.id })).error).toBeNull();
    const row = (await admin.from("orders").select("updated_at, delivered_at, cash_handed_at").eq("id", data!.id).single()).data!;
    expect(row.cash_handed_at).not.toBeNull();
    expect(row.delivered_at).toBe(delivered);
    expect(incentiveFor([row], log)).toEqual({ count: 1, total_paise: 1000, amounts: [1000] });   // priced at the delivery, not at the hand-over
  });
});
