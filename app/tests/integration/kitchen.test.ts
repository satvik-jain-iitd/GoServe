// Story #49 against goserve-dev: the kitchen's live list. Skipped when the dev keys are not set (CI has none).
// Run: set -a; . ~/Desktop/Secrets/goserve/goserve.env; . ~/Desktop/Secrets/02_databases.env; set +a; npm run test:integration   (goserve.env holds the GoServe keys; 02_databases.env keeps SUPABASE_ACCESS_TOKEN)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { fetchOrders, watchOrders } from "../../src/lib/live";
import { scopeFor } from "../../src/lib/session";
import type { Order } from "../../src/lib/kitchen";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const KITCHEN = "11111111-1111-1111-1111-111111111111";

// Only the dev project: a wrong key in the environment must never run these against production.
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");
describe.skipIf(!isDev || !anon || !service)("kitchen live list on goserve-dev", () => {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const keys: string[] = [];
  const users: string[] = [];

  async function session(): Promise<{ client: SupabaseClient; id: string }> {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInAnonymously();
    expect(error).toBeNull();
    users.push(data.user!.id);
    return { client, id: data.user!.id };
  }
  const place = async (sessionId: string, key: string) => {
    keys.push(key);
    const dish = (await admin.from("menu_items").select("id").limit(1).single()).data!.id;
    const { data, error } = await admin.rpc("place_order", { p_session: sessionId, p_key: key, p_items: [{ menu_item_id: dish, qty: 1 }], p_address: "test" });
    expect(error).toBeNull();
    return data.order as Order;
  };

  afterAll(async () => {
    if (keys.length) {
      const { data } = await admin.from("orders").select("id").in("client_order_key", keys);
      const ids = (data ?? []).map((r) => r.id);
      // Orders with events cannot be deleted (order_events are frozen by design), so this delete fails quietly and the rows stay on dev.
      // They are test data on goserve-dev only (follow-up F71: a cleanup that needs the owner's yes).
      if (ids.length) await admin.from("orders").delete().in("id", ids);
    }
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  it("S1 a new order reaches the kitchen within 2 seconds, and its next step arrives too", async () => {
    const { client, id } = await session();
    const seen: Order[] = [];
    let ready!: () => void;
    const subscribed = new Promise<void>((r) => (ready = r));
    const stop = watchOrders(client, scopeFor(null, id), (o) => seen.push(o), ready);
    await subscribed;
    await new Promise((r) => setTimeout(r, 1500));   // the server needs about a second after SUBSCRIBED (LEARNINGS)
    const order = await place(id, `k-${id}`);   // the 2 seconds count from the moment this call has returned
    await expect.poll(() => seen.find((o) => o.id === order.id)?.status, { timeout: 2000, interval: 50 }).toBe("placed");
    const { error } = await admin.rpc("change_status", { p_order: order.id, p_session: id, p_to: "accepted", p_actor: "kitchen" });
    expect(error).toBeNull();
    await expect.poll(() => seen.filter((o) => o.id === order.id).pop()?.status, { timeout: 2000, interval: 50 }).toBe("accepted");
    stop();
    await client.removeAllChannels();
  }, 15000);

  it("the kitchen list holds only this session's orders", async () => {
    const a = await session();
    const b = await session();
    const oa = await place(a.id, `ka-${a.id}`);
    await place(b.id, `kb-${b.id}`);
    const list = await fetchOrders(a.client, scopeFor(null, a.id));
    expect(list.map((o) => o.id)).toEqual([oa.id]);
  }, 15000);
});
