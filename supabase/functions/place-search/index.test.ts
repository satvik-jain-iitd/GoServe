// Story #1027, source changed by #1029: GET /place-search?q=. The places come from our own pincodes table (SQL function search_places), no third party.
// The Nominatim helpers (makeNominatim, mapHits) stay in the file, dormant, with their tests. The data sources are injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, mapHits, normalise, makeNominatim, type Deps, type Hit } from "./index.ts";

const NOMINATIM = [
  { name: "Green Park Metro Station", display_name: "Green Park Metro Station, Aurobindo Marg, Green Park, New Delhi, Delhi, 110016, India", lat: "28.5599", lon: "77.2065", address: { postcode: "110016" } },
  { display_name: "Green Park Extension, New Delhi, Delhi, India", lat: "28.5575", lon: "77.2060", address: {} },
  { display_name: "Broken Place, India", lat: "north", lon: "77.2", address: {} },
];
const HITS: Hit[] = [
  { name: "Green Park Metro Station", address: "Green Park Metro Station, Aurobindo Marg, Green Park, New Delhi, Delhi, 110016, India", lat: 28.5599, lng: 77.2065, pin: "110016" },
  { name: "Green Park Extension", address: "Green Park Extension, New Delhi, Delhi, India", lat: 28.5575, lng: 77.206, pin: "" },
];

const CAND = (pin: string, place: string, lat: number, state = "Delhi") => ({ pin, place, state, lat, lng: 77.2 });
const calls: string[] = [];
const deps = (over: Partial<Deps> = {}): Deps => ({
  session: async () => "u1", allow: () => true,
  lookup: async (q) => { calls.push(q); return [CAND("110016", "Green Park", 28.5599), CAND("110049", "Green Park Extension", 28.5575)]; },
  served: async (lat) => lat > 28.558, ...over,
});
const get = (d: Deps, q: string, method = "GET") => makeHandler(d)(new Request(`https://x.test/place-search${q}`, { method }));

Deno.test("normalise: lowercase, one space, trimmed", () => {
  assertEquals(normalise("  Green   PARK  "), "green park");
});

Deno.test("mapHits: a name, one address line, numbers for the place, the postcode when it has six digits; a broken place is dropped; five at most", () => {
  assertEquals(mapHits(NOMINATIM), HITS);
  assertEquals(mapHits(Array(9).fill(NOMINATIM[0])).length, 5);
  assertEquals(mapHits(null), []);
  assertEquals(mapHits([{ display_name: "X", lat: "1", lon: "2", address: { postcode: "1100" } }])[0].pin, "");
});

Deno.test("a query asks our table once, with the normalised words, and answers with the shape and served flags", async () => {
  calls.length = 0;
  const res = await get(deps(), "?q=%20Green%20%20PARK");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(calls, ["green park"]);
  assertEquals(body.results[0], { name: "Green Park", address: "Green Park, Delhi, 110016", lat: 28.5599, lng: 77.2, pin: "110016", served: true });
  assertEquals(body.results[1].served, false);
});

Deno.test("served places come first, then the table's own order, five at most", async () => {
  const many = [CAND("1", "A", 1), CAND("2", "B", 50), CAND("3", "C", 1), CAND("4", "D", 50), CAND("5", "E", 1), CAND("6", "F", 50), CAND("7", "G", 1)].map((c, i) => ({ ...c, pin: `11000${i}` }));
  const res = await get(deps({ lookup: async () => many, served: async (lat) => lat === 50 }), "?q=abc");
  assertEquals((await res.json()).results.map((r: { name: string }) => r.name), ["B", "D", "F", "A", "C"]);
});

Deno.test("a pin with no state still gives a clean address line", async () => {
  const res = await get(deps({ lookup: async () => [{ pin: "471001", place: "Chhatarpur", state: null, lat: 24.9, lng: 79.6 }] }), "?q=chhat");
  assertEquals((await res.json()).results[0].address, "Chhatarpur, 471001");
});

Deno.test("no match is an empty list, not an error", async () => {
  const res = await get(deps({ lookup: async () => [] }), "?q=zzzzzz");
  assertEquals([res.status, (await res.json()).results], [200, []]);
});

Deno.test("one caller over the minute cap gets slow_down before the table is asked", async () => {
  calls.length = 0;
  const res = await get(deps({ allow: () => false }), "?q=Green%20Park");
  assertEquals([res.status, (await res.json()).error, calls.length], [429, "slow_down", 0]);
});

Deno.test("no login is 401; a short, empty or long query is 400; only GET", async () => {
  assertEquals((await get(deps({ session: async () => null }), "?q=Green%20Park")).status, 401);
  for (const q of ["", "?q=", "?q=ab", "?q=%20%20a%20%20", `?q=${"x".repeat(101)}`]) assertEquals([q.slice(0, 8), (await get(deps(), q)).status], [q.slice(0, 8), 400]);
  assertEquals((await get(deps(), "?q=Green%20Park", "POST")).status, 405);
});

Deno.test("the table failing is 502 search_unavailable with no detail", async () => {
  const res = await get(deps({ lookup: async () => { throw new Error("secret detail"); } }), "?q=Green%20Park");
  const text = await res.text();
  assertEquals(res.status, 502);
  assertEquals(JSON.parse(text), { ok: false, error: "search_unavailable" });
});

Deno.test("dormant: makeNominatim: India only, five results, the viewbox as a bias (not bounded), an identifying User-Agent", async () => {
  let seen: { url: string; ua: string | null } = { url: "", ua: null };
  const f = (async (u: string | URL | Request, init?: RequestInit) => { seen = { url: String(u), ua: new Headers(init?.headers).get("user-agent") }; return new Response("[]"); }) as typeof fetch;
  await makeNominatim(f)("green park", [77.0, 28.8, 77.4, 28.4]);
  const u = new URL(seen.url);
  assertEquals(u.origin + u.pathname, "https://nominatim.openstreetmap.org/search");
  assertEquals([u.searchParams.get("q"), u.searchParams.get("countrycodes"), u.searchParams.get("limit"), u.searchParams.get("format"), u.searchParams.get("bounded"), u.searchParams.get("viewbox")],
    ["green park", "in", "5", "jsonv2", "0", "77,28.8,77.4,28.4"]);
  assertEquals(seen.ua?.startsWith("GoServe/"), true);
  assertEquals(u.searchParams.get("addressdetails"), "1");
});
