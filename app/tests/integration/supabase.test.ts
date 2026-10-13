// Story #44, S1-S3, against goserve-dev. Skipped when the dev keys are not set (CI has none).
// Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; npm run test:integration
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const KITCHEN = "11111111-1111-1111-1111-111111111111";

describe.skipIf(!url || !anon || !service)("goserve-dev security and live data", () => {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const keys: string[] = [];
  const users: string[] = [];

  // Each browser gets its own anonymous user; its id is the session id (ADR-010).
  async function newSession(): Promise<{ client: SupabaseClient; id: string }> {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInAnonymously();
    expect(error).toBeNull();
    users.push(data.user!.id);
    return { client, id: data.user!.id };
  }

  async function insertOrder(session: string, key: string) {
    keys.push(key);
    const { error } = await admin.from("orders").insert({
      kitchen_id: KITCHEN, session_id: session, client_order_key: key, items: [], total_paise: 100, address: "test",
    });
    expect(error).toBeNull();
  }

  afterAll(async () => {
    if (keys.length) await admin.from("orders").delete().in("client_order_key", keys);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  });

  it("S1 sessions are isolated", async () => {
    const a = await newSession();
    const b = await newSession();
    await insertOrder(a.id, `t-${a.id}`);
    await insertOrder(b.id, `t-${b.id}`);
    const { data, error } = await a.client.from("orders").select("session_id");
    expect(error).toBeNull();
    expect(data).toEqual([{ session_id: a.id }]);
  });

  it("S1 the bare anon key (no sign-in) cannot write or read orders", async () => {
    const bare = createClient(url!, anon!, { auth: { persistSession: false } });
    const w = await bare.from("orders").insert({
      kitchen_id: KITCHEN, session_id: "x", client_order_key: "bare", items: [], total_paise: 1, address: "x",
    });
    expect(w.error).not.toBeNull();
    const r = await bare.from("orders").select("id");
    expect(r.data).toEqual([]);
  });

  it("S1 a signed-in session cannot write either", async () => {
    const a = await newSession();
    const { error } = await a.client.from("orders").insert({
      kitchen_id: KITCHEN, session_id: a.id, client_order_key: `w-${a.id}`, items: [], total_paise: 1, address: "x",
    });
    expect(error).not.toBeNull();
  });

  it("S2 a subscribed client gets a new order within 2 seconds", async () => {
    const a = await newSession();
    let sentAt = 0;
    const got = new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no event in 5s")), 5000);
      a.client
        .channel(`orders-${a.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `session_id=eq.${a.id}` }, () => {
          clearTimeout(timer);
          resolve(Date.now() - sentAt);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // The server needs about a second after SUBSCRIBED to start listening. In the app an order
            // comes seconds after the screen opens, so the 2 seconds are counted from the insert.
            await new Promise((r) => setTimeout(r, 1500));
            sentAt = Date.now();
            await insertOrder(a.id, `r-${a.id}`);
          }
        });
    });
    expect(await got).toBeLessThan(2000);
    await a.client.removeAllChannels();
  }, 10000);

  it("S3 the menu has 8 to 10 Delhi dishes with photos", async () => {
    const a = await newSession();
    const { data, error } = await a.client.from("menu_items").select("name, image_url, image_credit");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(8);
    expect(data!.length).toBeLessThanOrEqual(10);
    for (const d of data!) {
      expect(d.image_url).toMatch(/^https:\/\//);
      expect(d.image_credit).toBeTruthy();
    }
  });
});
