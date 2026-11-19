// Story #1626 against goserve-dev (skipped when the dev keys are not set; CI has none). Run as in kitchen.test.ts.
// T16: a tap in search keeps a recent row for the signed-in customer: not confirmed, no postal code, read back from the database.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keepRecent, listRecents } from "../../src/lib/recents";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");   // never production

describe.skipIf(!isDev || !anon || !service)("recent on tap on goserve-dev", () => {
  let admin: SupabaseClient;
  const users: string[] = [];
  beforeAll(() => { admin = createClient(url!, service!, { auth: { persistSession: false } }); });
  afterAll(async () => { for (const id of users) await admin.auth.admin.deleteUser(id); });

  it("T16: a tapped point is kept as one recent row, not confirmed, with no postal code", async () => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await client.auth.signInAnonymously();
    users.push(data.user!.id);
    const row = await keepRecent(client, [], { name: "Integration Tap T16", address: "Integration Tap T16, Test Town", pin: "", lat: 24.9164, lng: 79.5812, house: "", landmark: "", source: "ola" }, false);
    expect(row).not.toBeNull();
    const rows = await listRecents(client);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Integration Tap T16", confirmed: false, pin: "", lat: 24.9164, lng: 79.5812 });
    await client.from("recent_places").delete().eq("id", rows[0].id);
    expect(await listRecents(client)).toHaveLength(0);
  });
});
