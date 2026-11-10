// Story #1192: nearest_pin gave "permission denied for function distance_m" (42501) to every caller, and once that was granted it gave a WRONG pin for 7 of 8 Delhi places
// (the GeoNames centroids are coarse: 27 Delhi pins share one point). The rule now: the right pin, or null. It runs against goserve-dev only; skipped when the dev keys are not set.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_GOSERVE_DEV_URL;
const anon = process.env.SUPABASE_GOSERVE_DEV_ANON_KEY;
const isDev = !!url && url.includes("tmxyizmkpwwfyazvrfhw");

// Public landmarks and the pin codes they really sit in (the reviewer's table, 10 Nov).
const PLACES: { name: string; lat: number; lng: number; real: string[] }[] = [
  { name: "Connaught Place", lat: 28.6315, lng: 77.2167, real: ["110001"] },
  { name: "India Gate", lat: 28.6129, lng: 77.2295, real: ["110001", "110003"] },
  { name: "AIIMS", lat: 28.5672, lng: 77.21, real: ["110029"] },
  { name: "Saket (Select Citywalk)", lat: 28.5286, lng: 77.2193, real: ["110017"] },
  { name: "Hauz Khas Village", lat: 28.5535, lng: 77.1943, real: ["110016"] },
  { name: "Lajpat Nagar market", lat: 28.5677, lng: 77.2432, real: ["110024"] },
  { name: "Noida Sector 18", lat: 28.57, lng: 77.3219, real: ["201301"] },
  { name: "Gurgaon Cyber Hub", lat: 28.495, lng: 77.089, real: ["122002"] },
];

describe.skipIf(!isDev || !anon)("nearest_pin on goserve-dev (story #1192)", () => {
  let c: SupabaseClient;
  beforeAll(() => { c = createClient(url!, anon!, { auth: { persistSession: false } }); });
  const ask = async (client: SupabaseClient, lat: number, lng: number) => {
    const { data, error } = await client.rpc("nearest_pin", { p_lat: lat, p_lng: lng });
    expect(error).toBeNull();
    return data as string | null;
  };

  it("S1 runs for the public key and for a signed-in user (no 42501)", async () => {
    await ask(c, 28.6129, 77.2295);
    const u = createClient(url!, anon!, { auth: { persistSession: false } });
    expect((await u.auth.signInAnonymously()).error).toBeNull();
    await ask(u, 28.6129, 77.2295);
  });
  for (const p of PLACES) {
    it(`S2 ${p.name}: the right pin or nothing, never a wrong pin`, async () => {
      const got = await ask(c, p.lat, p.lng);
      expect(got === null || p.real.includes(got), `${p.name} gave ${got}, real ${p.real.join(" or ")}`).toBe(true);
    });
  }
  it("S3 still answers where a centroid belongs to one pin and is close", async () => {
    const { data } = await c.from("pincodes").select("pin, lat, lng").limit(20000);
    const byPoint = new Map<string, string[]>();
    for (const r of data ?? []) byPoint.set(`${r.lat},${r.lng}`, [...(byPoint.get(`${r.lat},${r.lng}`) ?? []), r.pin]);
    const single = (data ?? []).find((r) => byPoint.get(`${r.lat},${r.lng}`)!.length === 1 && [...byPoint.keys()].every((k) => { const [la, ln] = k.split(",").map(Number); return k === `${r.lat},${r.lng}` || Math.hypot((la - r.lat) * 111, (ln - r.lng) * 98) > 5; }));
    expect(single, "no isolated single-pin centroid in the table").toBeTruthy();
    expect(await ask(c, single!.lat + 0.002, single!.lng + 0.002)).toBe(single!.pin);
  });
  it("S4 a point in the sea gives null", async () => {
    expect(await ask(c, 15.0, 70.0)).toBeNull();
  });
});
