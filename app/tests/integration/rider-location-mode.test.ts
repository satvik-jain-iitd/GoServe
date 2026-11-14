// Story 1498, against goserve-dev (skipped when the dev keys are not set; CI has none). Run as in supabase.test.ts, after the migration is on dev.
// Any visitor can read the mode (an open customer app must); only an admin may set it; the row holds one of off, link, map; a tap on another person's order counts nothing.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");   // never production

describe.skipIf(!isDev || !anon || !service)("rider location mode on goserve-dev", () => {
  let admin: SupabaseClient;
  const users: string[] = [];
  beforeAll(() => { admin = createClient(url!, service!, { auth: { persistSession: false } }); });
  afterAll(async () => { for (const id of users) await admin.auth.admin.deleteUser(id); });

  it("a visitor reads the mode, cannot read another setting, and cannot set the mode", async () => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data: rows } = await client.from("settings").select("name, value");
    expect((rows ?? []).map((r) => r.name).sort()).toEqual(["otp_login_on", "rider_location_mode"]);
    const { data } = await client.auth.signInAnonymously();
    users.push(data.user!.id);
    expect((await client.rpc("rider_location_mode_set_v2", { p_mode: "off" })).error?.code).toBe("42501");
    expect((await client.rpc("rider_location_mode_get_v2")).error?.code).toBe("42501");
  });

  it("the row holds one of off, link, map", async () => {
    const { data } = await admin.from("settings").select("value").eq("name", "rider_location_mode").single();
    expect(["off", "link", "map"]).toContain((data!.value as { mode: string }).mode);
    expect((await admin.from("settings").update({ value: { mode: "satellite" } }).eq("name", "rider_location_mode")).error).not.toBeNull();   // the check refuses it
  });

  it("a tap on an order that is not the caller's counts nothing and raises nothing", async () => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await client.auth.signInAnonymously();
    users.push(data.user!.id);
    const order = "00000000-0000-4000-8000-000000001498";
    expect((await client.rpc("rider_row_tap", { p_order: order, p_mode: "link" })).error).toBeNull();
    const { count } = await admin.from("order_events").select("id", { count: "exact", head: true }).eq("order_id", order);
    expect(count).toBe(0);
  });
});
