// Story #1027, source changed by #1029: GET /place-search?q=. The places come from our own pincodes table (SQL function search_places), no third party.
// The Nominatim helpers (makeNominatim, mapHits) stay in the file, dormant, with their tests. The data sources are injected, so these tests need no network.
import { assertEquals } from "jsr:@std/assert@1";
import { makeHandler, mapHits, mapPlaces, normalise, makeNominatim, makeOlaSearch, type Deps, type Hit, type Place } from "./index.ts";

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
  cap: async () => "ok", radius: async () => 25_000, ola: async () => [],   // story 1519: Ola finds nothing here, so the old tests read the backup table
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
  assertEquals(body.results[0], { name: "Green Park", address: "Green Park, Delhi, 110016", lat: 28.5599, lng: 77.2, pin: "110016", served: true, from: "own" });
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

// Story 1519: the places come from Ola Maps first, near the map first; our own table is the backup. The scenario names are the story's.
// Ola is a stand-in here: no real Ola answer is in this file.
const P = (name: string, lat: number, id = name): Place => ({ id, name, address: `${name} area, Test Town`, lat, lng: 77.2, pin: "" });
const AT = "&lat=28.6&lng=77.2";
type Ask = { q: string; at: { lat: number; lng: number } | null; radius: number | null };
const ola = (answers: (Place[] | Error | "hang")[]) => {
  const asks: Ask[] = [];
  const fn: Deps["ola"] = (q, at, radius) => {
    asks.push({ q, at, radius });
    const a = answers[asks.length - 1] ?? [];
    if (a === "hang") return new Promise(() => undefined);
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
  };
  return { asks, fn };
};
const names = async (res: Response) => { const b = await res.json(); return { from: b.from, rows: b.results.map((r: { name: string; from: string }) => `${r.name}:${r.from}`) }; };

Deno.test("A known place near the map: one Ola ask inside the near radius, at least 3 places, our table is not asked", async () => {
  calls.length = 0;
  const o = ola([[P("A", 28.61), P("B", 28.62), P("C", 28.63), P("D", 28.64), P("E", 28.65), P("F", 28.66)]]);
  const res = await get(deps({ ola: o.fn }), `?q=Central%20Sec${AT}`);
  assertEquals(await names(res), { from: "ola", rows: ["A:ola", "B:ola", "C:ola", "D:ola", "E:ola"] });   // five at most
  assertEquals(o.asks, [{ q: "central sec", at: { lat: 28.6, lng: 77.2 }, radius: 25_000 }]);
  assertEquals(calls, []);
});

Deno.test("A common word stays local: with 3 near places no wide ask is made, and Ola's own order is kept (served places are not moved up)", async () => {
  const o = ola([[P("Bus Stand", 28.50), P("New Bus Stand", 28.61), P("Old Bus Stand", 28.52)]]);
  const res = await get(deps({ ola: o.fn }), `?q=bus%20stand${AT}`);   // served: lat > 28.558, so only the second is served
  const body = await res.json();
  assertEquals(body.results.map((r: { name: string; served: boolean }) => [r.name, r.served]), [["Bus Stand", false], ["New Bus Stand", true], ["Old Bus Stand", false]]);
  assertEquals(o.asks.length, 1);
});

Deno.test("A place in another city: fewer than 3 near places bring one wide ask; near places first, then the far ones, none twice", async () => {
  const o = ola([[P("Near One", 28.61)], [P("Far City Place", 12.9), P("Near One", 28.61), P("Far Two", 13.0), P("Far Three", 13.1)]]);
  const res = await get(deps({ ola: o.fn }), `?q=far%20city${AT}`);
  assertEquals(await names(res), { from: "ola", rows: ["Near One:ola", "Far City Place:ola", "Far Two:ola", "Far Three:ola"] });
  assertEquals(o.asks.map((a) => a.radius), [25_000, null]);   // two asks at most
});

Deno.test("No place sent with the text: one wide ask, no near ask", async () => {
  const o = ola([[P("A", 28.61), P("B", 28.62), P("C", 28.63)]]);
  await get(deps({ ola: o.fn }), "?q=green%20park");
  assertEquals(o.asks, [{ q: "green park", at: null, radius: null }]);
});

Deno.test("Fewer than 3 places from Ola: our own table fills the list, each row says where it came from", async () => {
  const o = ola([[P("Green Park Metro", 28.61)], []]);
  const res = await get(deps({ ola: o.fn }), `?q=green%20park${AT}`);
  assertEquals(await names(res), { from: "ola", rows: ["Green Park Metro:ola", "Green Park:own", "Green Park Extension:own"] });
});

Deno.test("Ola does not answer: a failure gives places from our own table and no error", async () => {
  const o = ola([new Error("client_secret=abc")]);
  const res = await get(deps({ ola: o.fn }), `?q=green%20park${AT}`);
  assertEquals(res.status, 200);
  assertEquals(await names(res), { from: "own", rows: ["Green Park:own", "Green Park Extension:own"] });
});

Deno.test("Ola does not answer: more than the wait limit gives places from our own table and no error", async () => {
  const o = ola(["hang"]);
  const res = await makeHandler(deps({ ola: o.fn }), 20)(new Request(`https://x.test/place-search?q=green%20park${AT}`));
  assertEquals(res.status, 200);
  assertEquals((await names(res)).from, "own");
});

Deno.test("Over the cap: Ola is not asked and our own table answers", async () => {
  for (const over of ["person", "app"] as const) {
    const o = ola([[P("A", 28.61)]]);
    const res = await get(deps({ ola: o.fn, cap: async () => over }), `?q=green%20park${AT}`);
    assertEquals([res.status, o.asks.length, (await names(res)).from], [200, 0, "own"]);
  }
});

Deno.test("Over the cap: every Ola ask is counted, and the count is asked before Ola", async () => {
  const order: string[] = [];
  const o = ola([[P("A", 28.61)], [P("B", 12.9)]]);
  await get(deps({ cap: async () => { order.push("count"); return "ok"; }, ola: (q, at, r) => { order.push("ola"); return o.fn(q, at, r); } }), `?q=green%20park${AT}`);
  assertEquals(order, ["count", "ola", "count", "ola"]);
});

Deno.test("Over the cap: the whole-app total writes one log line with no typed text, no place and no person", async () => {
  const lines: string[] = [], log = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
  try { await get(deps({ session: async () => "person-77", cap: async () => "app" }), `?q=secretword${AT}`); } finally { console.log = log; }
  assertEquals(lines.length, 1);
  assertEquals([/secretword|28\.6|77\.2|person-77/.test(lines[0])], [false]);
});

Deno.test("The credit: the answer says where the rows came from, ola or own", async () => {
  const fromOla = await (await get(deps({ ola: ola([[P("A", 28.61), P("B", 28.62), P("C", 28.63)]]).fn }), `?q=abc${AT}`)).json();
  const fromOwn = await (await get(deps(), `?q=abc${AT}`)).json();
  assertEquals([fromOla.from, fromOwn.from], ["ola", "own"]);
});

Deno.test("mapPlaces: a name, the area line, the place's own point and its id; a six digit pin when the text has one; a broken place is dropped", () => {
  const reply = { predictions: [
    { place_id: "p1", structured_formatting: { main_text: "Test Chowk", secondary_text: "Ward 4, Test Town, Test State, 471001, India" }, geometry: { location: { lat: 24.9, lng: 79.58 } } },
    { place_id: "p2", structured_formatting: { main_text: "No Pin Road", secondary_text: "Test Town" }, geometry: { location: { lat: 24.91, lng: 79.59 } } },
    { place_id: "p3", structured_formatting: { main_text: "No Point" } },
    { place_id: "p4", structured_formatting: { main_text: "" }, geometry: { location: { lat: 1, lng: 2 } } },
  ] };
  assertEquals(mapPlaces(reply), [
    { id: "p1", name: "Test Chowk", address: "Ward 4, Test Town, Test State, 471001, India", lat: 24.9, lng: 79.58, pin: "471001" },
    { id: "p2", name: "No Pin Road", address: "Test Town", lat: 24.91, lng: 79.59, pin: "" },
  ]);
  assertEquals(mapPlaces(null), []);
});

Deno.test("makeOlaSearch: the near ask carries the text, the map's place, the radius and strictbounds; the wide ask carries no radius; one token serves both", async () => {
  const seen: string[] = [];
  const jwt = `x.${btoa(JSON.stringify({ exp: 4_000_000_000 })).replace(/=+$/, "")}.y`;
  const fetchFn = (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    if (url.includes("/auth/v1/token")) { seen.push("token"); return new Response(JSON.stringify({ access_token: jwt })); }
    seen.push(url); assertEquals(new Headers(init?.headers).get("authorization"), `Bearer ${jwt}`); assertEquals(new Headers(init?.headers).get("origin"), null);
    return new Response(JSON.stringify({ predictions: [] }));
  }) as typeof fetch;
  const search = makeOlaSearch({ id: "i", secret: "s", fetchFn });
  await search("bus stand", { lat: 24.9, lng: 79.58 }, 25_000);
  await search("bus stand", { lat: 24.9, lng: 79.58 }, null);
  assertEquals(seen[0], "token");
  const near = new URL(seen[1]), wide = new URL(seen[2]);
  assertEquals(near.origin + near.pathname, "https://api.olamaps.io/places/v1/autocomplete");
  assertEquals([near.searchParams.get("input"), near.searchParams.get("location"), near.searchParams.get("radius"), near.searchParams.get("strictbounds")], ["bus stand", "24.9,79.58", "25000", "true"]);
  assertEquals([wide.searchParams.get("location"), wide.searchParams.get("radius"), wide.searchParams.get("strictbounds")], ["24.9,79.58", null, null]);
  assertEquals(seen.length, 3);   // one token
});
