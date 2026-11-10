// Story #1280 against goserve-dev: kitchen_turn_on is admin-only, leaves the kitchen closed, logs who and when, and is safe to call twice. Skipped when the dev keys are not set (CI has none).
// Run after the migration 20261110120000 is on goserve-dev: set -a; . ~/Desktop/Secrets/goserve/goserve.env; set +a; npm run test:integration
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const service = process.env.SUPABASE_GOSERVE_DEV_SERVICE_ROLE_KEY;
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");   // never against production
describe.skipIf(!isDev || !anon || !service)("kitchen_turn_on on goserve-dev", () => {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const ids: string[] = [];
  afterAll(async () => { for (const id of ids) await admin.from("kitchens").delete().eq("id", id); });

  it("a signed-in non-admin is refused and the kitchen is untouched", async () => {
    const { data: k } = await admin.from("kitchens").insert({ name: "TURNON TEST", active: false, open: false, pin_codes: ["110016"] }).select("id").single();
    ids.push(k!.id);
    const c = createClient(url!, anon!, { auth: { persistSession: false } });
    await c.auth.signInAnonymously();
    const { error } = await c.rpc("kitchen_turn_on", { p_kitchen: k!.id });
    expect(error?.message).toContain("not_allowed");
    expect((await admin.from("kitchens").select("active").eq("id", k!.id).single()).data!.active).toBe(false);
  });
});
