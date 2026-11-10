// Story #1192: nearest_pin gave "permission denied for function distance_m" (42501) to every caller on dev and prod, and locate.ts turned it into an empty pin.
// It runs against goserve-dev only; skipped when the dev keys are not set (CI has none). India Gate, Delhi: any caller must get a six digit pin.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");

describe.skipIf(!isDev || !anon)("nearest_pin on goserve-dev (story #1192)", () => {
  it("S1 answers a six digit pin to the public key", async () => {
    const c = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data, error } = await c.rpc("nearest_pin", { p_lat: 28.6129, p_lng: 77.2295 });
    expect(error).toBeNull();
    expect(data).toMatch(/^\d{6}$/);
  });
  it("S2 answers a six digit pin to a signed-in (anonymous) user", async () => {
    const c = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error: signIn } = await c.auth.signInAnonymously();
    expect(signIn).toBeNull();
    const { data, error } = await c.rpc("nearest_pin", { p_lat: 28.6129, p_lng: 77.2295 });
    expect(error).toBeNull();
    expect(data).toMatch(/^\d{6}$/);
  });
});
