// Story #998: GET /geocode?lat=&lng=. Ola Maps reverse geocode behind our own function, so the browser never holds a key. The data sources are injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, mapReply, makeOla, type Deps } from "./index.ts";

const ola = (types: Record<string, string>, formatted = "Radio Colony, Chhatarpur, Madhya Pradesh 471001, India") => ({
  results: [{ formatted_address: formatted, address_components: Object.entries(types).map(([t, n]) => ({ types: [t], long_name: n, short_name: n })) }],
});
const COLONY = ola({ postal_code: "471001", sublocality: "Radio Colony", locality: "Chhatarpur", administrative_area_level_1: "Madhya Pradesh", country: "India" });
const OPEN_LAND = ola({ postal_code: "471001", locality: "Chhatarpur", administrative_area_level_1: "Madhya Pradesh", country: "India" }, "Chhatarpur, Madhya Pradesh 471001, India");

const deps = (over: Partial<Deps> = {}): Deps => ({ session: async () => "u1", provider: async () => "ola", allow: () => true, budget: async () => true, lookup: async () => COLONY, ...over });
const get = (d: Deps, q: string, method = "GET") => makeHandler(d)(new Request(`https://x.test/geocode${q}`, { method }));

Deno.test("mapReply: the pin is the postal code; the words are the sublocality, the town and the state", () => {
  assertEquals(mapReply(COLONY), { address: "Radio Colony, Chhatarpur, Madhya Pradesh", pin: "471001", locality: "Radio Colony", town: "Chhatarpur" });
});

Deno.test("mapReply: open land has the town only, never a made-up village", () => {
  assertEquals(mapReply(OPEN_LAND), { address: "Chhatarpur, Madhya Pradesh", pin: "471001", locality: "", town: "Chhatarpur" });
});

Deno.test("mapReply: a neighborhood stands in for a missing sublocality; a bad pin is dropped", () => {
  const r = mapReply(ola({ postal_code: "47100", neighborhood: "Toria Mohalla", locality: "Chhatarpur", administrative_area_level_1: "Madhya Pradesh" }));
  assertEquals([r?.locality, r?.pin], ["Toria Mohalla", ""]);
});

Deno.test("mapReply: an empty or odd reply is null", () => {
  assertEquals(mapReply({ results: [] }), null);
  assertEquals(mapReply(null), null);
  assertEquals(mapReply({ results: [{ address_components: [] }] }), null);
});

Deno.test("a place answers 200 with the words and the pin", async () => {
  const res = await get(deps(), "?lat=24.9&lng=79.58");
  assertEquals(res.status, 200);
  const a = await res.json();
  assertEquals([a.ok, a.pin, a.address], [true, "471001", "Radio Colony, Chhatarpur, Madhya Pradesh"]);
});

Deno.test("a missing or out-of-range place is 400 invalid_place; other methods are 405", async () => {
  for (const q of ["", "?lat=24.9", "?lat=x&lng=79", "?lat=91&lng=79", "?lat=24&lng=181"]) {
    const res = await get(deps(), q);
    assertEquals([q, res.status, (await res.json()).error], [q, 400, "invalid_place"]);
  }
  assertEquals((await get(deps(), "?lat=24&lng=79", "POST")).status, 405);
});

Deno.test("no login is 401", async () => {
  assertEquals((await get(deps({ session: async () => null }), "?lat=24.9&lng=79.58")).status, 401);
});

Deno.test("the provider switch set to osm answers 503 provider_off and calls nothing", async () => {
  let called = 0;
  const res = await get(deps({ provider: async () => "osm", lookup: async () => { called++; return COLONY; } }), "?lat=24.9&lng=79.58");
  assertEquals([res.status, (await res.json()).error, called], [503, "provider_off", 0]);
});

Deno.test("over the monthly cap is 503 over_cap and Ola is not called", async () => {
  let called = 0;
  const res = await get(deps({ budget: async () => false, lookup: async () => { called++; return COLONY; } }), "?lat=24.9&lng=79.58");
  assertEquals([res.status, (await res.json()).error, called], [503, "over_cap", 0]);
});

Deno.test("a caller over the rate limit is 429", async () => {
  assertEquals((await get(deps({ allow: () => false }), "?lat=24.9&lng=79.58")).status, 429);
});

Deno.test("when Ola fails the answer is 502 geocode_unavailable and no detail leaks", async () => {
  const res = await get(deps({ lookup: async () => { throw new Error("client_secret=abc"); } }), "?lat=24.9&lng=79.58");
  const text = await res.text();
  assertEquals(res.status, 502);
  assertEquals(text.includes("client_secret"), false);
});

Deno.test("a reply Ola gives with no address words is 404 not_found", async () => {
  assertEquals((await get(deps({ lookup: async () => ({ results: [] }) }), "?lat=24.9&lng=79.58")).status, 404);
});

Deno.test("makeOla gets one token for many lookups and a new one when it is about to end", async () => {
  const calls: string[] = [];
  let clock = 1_000_000;
  const jwt = (exp: number) => `x.${btoa(JSON.stringify({ exp })).replace(/=+$/, "")}.y`;
  const fetchFn = (async (url: string) => {
    calls.push(String(url).includes("/auth/v1/token") ? "token" : "reverse");
    return new Response(JSON.stringify(String(url).includes("/auth/v1/token") ? { access_token: jwt(Math.floor(clock / 1000) + 3600) } : COLONY), { status: 200 });
  }) as unknown as typeof fetch;
  const lookup = makeOla({ id: "i", secret: "s", fetchFn, now: () => clock });
  await lookup(24.9, 79.58); await lookup(24.9, 79.58);
  assertEquals(calls, ["token", "reverse", "reverse"]);
  clock += 3_560_000;   // inside the last 60 seconds of the token
  await lookup(24.9, 79.58);
  assertEquals(calls, ["token", "reverse", "reverse", "token", "reverse"]);
});
