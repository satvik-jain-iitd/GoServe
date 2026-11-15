// Story #998: the customer's address words come from our geocode function (Ola Maps behind it), then from OpenStreetMap. The browser never holds an Ola key.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { findAddress } from "../../src/lib/locate";

const OLA = { ok: true, address: "Example Colony, Sampletown, Sample State", pin: "900001", locality: "Example Colony", town: "Sampletown" };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const deps = (handler: (url: string) => Response | Promise<Response>) => {
  const calls: string[] = [];
  const fetchFn = (async (u: string) => { calls.push(String(u)); return handler(String(u)); }) as unknown as typeof fetch;
  return { calls, d: { fetchFn, url: "https://t.supabase.co", anon: "anon", token: async () => "tok" } };
};

describe("findAddress", () => {
  it("uses Ola's words and pin and makes no OpenStreetMap call", async () => {
    const { calls, d } = deps(() => reply(200, OLA));
    expect(await findAddress(28.57, 77.24, d)).toEqual({ address: "Example Colony, Sampletown, Sample State", pin: "900001", from: "ola" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/functions/v1/geocode?lat=28.57&lng=77.24");
  });
  it("falls back to OpenStreetMap when our function says no (503, 429, 404, 502)", async () => {
    for (const status of [503, 429, 404, 502]) {
      const { calls, d } = deps((u) => u.includes("/functions/v1/geocode") ? reply(status, { ok: false }) : reply(200, { address: { road: "Link Road", village: "Sample Village", state: "Sample State", postcode: "900001" } }));
      const found = await findAddress(28.57, 77.24, d);
      expect([status, found?.from, calls.some((c) => c.includes("nominatim"))]).toEqual([status, "osm", true]);
    }
  });
  it("falls back to OpenStreetMap when the call itself fails", async () => {
    const { d } = deps((u) => { if (u.includes("/functions/v1/geocode")) throw new TypeError("network"); return reply(200, { address: { road: "Link Road", village: "Sample Village", state: "Sample State", postcode: "900001" } }); });
    expect((await findAddress(28.57, 77.24, d))?.from).toBe("osm");
  });
  it("is null when both fail", async () => {
    const { d } = deps(() => reply(500, {}));
    expect(await findAddress(28.57, 77.24, d)).toBeNull();
  });
});

describe("the browser holds no Ola key", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  it("no Ola host, key name or credential in the app source", () => {
    for (const f of walk(resolve(__dirname, "../../src")).filter((f) => /\.(ts|tsx|css|html)$/.test(f))) expect(readFileSync(f, "utf8"), f).not.toMatch(/api\.olamaps\.io|OLA_MAPS|olakrutrim/i);
  });
});
