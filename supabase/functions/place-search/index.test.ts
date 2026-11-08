// Story #1027: GET /place-search?q=. Nominatim forward search behind our own function: one call a second in total, a cache of 30 days, an identifying User-Agent.
// The data sources are injected, so these tests need no network.
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

const calls: string[] = [];
const deps = (over: Partial<Deps> = {}): Deps => ({
  session: async () => "u1", allow: () => true, cached: async () => null, save: async () => {}, slot: async () => true,
  viewbox: async () => [77.0, 28.8, 77.4, 28.4], search: async (q) => { calls.push(q); return NOMINATIM; }, served: async (lat) => lat > 28.558, ...over,
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

Deno.test("a new query makes one Nominatim call and answers with served flags", async () => {
  calls.length = 0;
  const res = await get(deps(), "?q=Green%20Park");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.results.map((r: { served: boolean }) => r.served), [true, false]);   // by the injected rule: north of 28.558 is served
  assertEquals(calls, ["green park"]);
});

Deno.test("a cached query makes no Nominatim call and takes no slot", async () => {
  calls.length = 0;
  let slots = 0;
  const res = await get(deps({ cached: async () => HITS, slot: async () => { slots++; return true; } }), "?q=Green%20Park");
  assertEquals(res.status, 200);
  assertEquals([calls.length, slots], [0, 0]);
});

Deno.test("a miss is saved under the normalised query, without the caller", async () => {
  const saved: [string, Hit[]][] = [];
  await get(deps({ save: async (k, h) => { saved.push([k, h]); } }), "?q=%20Green%20%20PARK");
  assertEquals(saved, [["green park", HITS]]);
});

Deno.test("two callers inside one second: the second finds no slot and gets slow_down", async () => {
  const res = await get(deps({ slot: async () => false }), "?q=Green%20Park");
  assertEquals([res.status, (await res.json()).error], [429, "slow_down"]);
});

Deno.test("one caller over the minute cap gets slow_down before any slot is taken", async () => {
  let slots = 0;
  const res = await get(deps({ allow: () => false, slot: async () => { slots++; return true; } }), "?q=Green%20Park");
  assertEquals([res.status, slots], [429, 0]);
});

Deno.test("no login is 401; a short, empty or long query is 400; only GET", async () => {
  assertEquals((await get(deps({ session: async () => null }), "?q=Green%20Park")).status, 401);
  for (const q of ["", "?q=", "?q=ab", "?q=%20%20a%20%20", `?q=${"x".repeat(101)}`]) assertEquals([q.slice(0, 8), (await get(deps(), q)).status], [q.slice(0, 8), 400]);
  assertEquals((await get(deps(), "?q=Green%20Park", "POST")).status, 405);
});

Deno.test("Nominatim failing is 502 search_unavailable with no detail", async () => {
  const res = await get(deps({ search: async () => { throw new Error("secret detail"); } }), "?q=Green%20Park");
  const text = await res.text();
  assertEquals(res.status, 502);
  assertEquals(JSON.parse(text), { ok: false, error: "search_unavailable" });
});

Deno.test("makeNominatim: India only, five results, the viewbox as a bias (not bounded), an identifying User-Agent", async () => {
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
