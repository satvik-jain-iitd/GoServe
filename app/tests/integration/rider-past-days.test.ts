// Story 1442, against goserve-dev (skipped when the dev keys are not set; CI has none). Run as in supabase.test.ts.
// Only an admin may set "Past days"; a stranger cannot read it; the number stays inside 0 to 30.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");   // never production

describe.skipIf(!isDev || !anon || !service)("rider past days on goserve-dev", () => {
  let admin: SupabaseClient;
  const users: string[] = [];
  beforeAll(() => { admin = createClient(url!, service!, { auth: { persistSession: false } }); });
  afterAll(async () => { for (const id of users) await admin.auth.admin.deleteUser(id); });

  it("a person who is not an admin cannot set it, and a stranger cannot read it", async () => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await client.auth.signInAnonymously();
    users.push(data.user!.id);
    expect((await client.rpc("rider_past_days_set_v2", { p_days: 3 })).error?.code).toBe("42501");
    expect((await client.rpc("rider_past_days")).error?.code).toBe("42501");
  });

  it("the setting row holds a whole number from 0 to 30", async () => {
    const { data } = await admin.from("settings").select("value").eq("name", "rider_past_days").single();
    const days = (data!.value as { days: number }).days;
    expect(Number.isInteger(days) && days >= 0 && days <= 30).toBe(true);
    expect((await admin.from("settings").update({ value: { days: 31 } }).eq("name", "rider_past_days")).error).not.toBeNull();   // the check refuses it
  });
});
