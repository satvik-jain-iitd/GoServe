// Stories 1443 and 1438: only an admin may save the incentive, against goserve-dev (skipped when the dev keys are not set; CI has none).
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");   // never production

describe.skipIf(!isDev || !anon || !service)("rider incentive on goserve-dev", () => {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const users: string[] = [];
  afterAll(async () => { for (const id of users) await admin.auth.admin.deleteUser(id); });

  it("a person who is not an admin is refused, and a stranger cannot read the rates", async () => {
    const c = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await c.auth.signInAnonymously();
    users.push(data.user!.id);
    expect((await c.rpc("rider_incentive_set_v2", { p_on: true, p_amount_paise: 1000 })).error?.code).toBe("42501");
    expect((await c.rpc("rider_incentive_rates")).error?.code).toBe("42501");
  });
});
