// Story #1036 (board C8-SearchResults): the Deliver to search box. Typing filters the saved list only; on submit one call asks our own place-search function (our pincodes table, no outside search).
import { describe, it, expect } from "vitest";
import { placeSearch, splitMatch, type PlaceHit } from "../../src/lib/placeSearch";

const deps = (fetchFn: typeof fetch) => ({ fetchFn, url: "https://x.supabase.co", anon: "anon-key", token: async () => "tok" });
const HIT: PlaceHit = { name: "Green Park", address: "Green Park, Delhi, 110016", lat: 28.5599, lng: 77.2065, pin: "110016", served: true };

describe("placeSearch", () => {
  it("asks GET /functions/v1/place-search with the words, the anon key and the customer's token, and reads the results", async () => {
    let seen: { url: string; headers: Headers } | null = null;
    const f = (async (u: string | URL | Request, init?: RequestInit) => { seen = { url: String(u), headers: new Headers(init?.headers) }; return new Response(JSON.stringify({ ok: true, results: [HIT] })); }) as typeof fetch;
    expect(await placeSearch("green park", undefined, deps(f))).toEqual([HIT]);
    expect(seen!.url).toBe("https://x.supabase.co/functions/v1/place-search?q=green%20park");
    expect([seen!.headers.get("apikey"), seen!.headers.get("authorization")]).toEqual(["anon-key", "Bearer tok"]);
  });
  it("sends the place of the map as lat and lng when it has one, and keeps where each row came from (story 1519)", async () => {
    let url = "";
    const ola = { ...HIT, pin: "", from: "ola" as const };
    const f = (async (u: string | URL | Request) => { url = String(u); return new Response(JSON.stringify({ ok: true, from: "ola", results: [ola, HIT] })); }) as typeof fetch;
    expect(await placeSearch("green park", { lat: 28.56, lng: 77.2 }, deps(f))).toEqual([ola, HIT]);   // the server's order; an old row with no "from" is still a place
    expect(url).toBe("https://x.supabase.co/functions/v1/place-search?q=green%20park&lat=28.56&lng=77.2");
  });
  it("is an empty list when nothing matches", async () => {
    expect(await placeSearch("zzzzzz", undefined, deps((async () => new Response(JSON.stringify({ ok: true, results: [] }))) as typeof fetch))).toEqual([]);
  });
  it("is null (could not search) on an error answer, a slow-down, a bad body or no network", async () => {
    for (const f of [async () => new Response("{}", { status: 502 }), async () => new Response("{}", { status: 429 }), async () => new Response("not json"), async () => { throw new Error("offline"); }]) {
      expect(await placeSearch("green park", undefined, deps(f as typeof fetch))).toBeNull();
    }
  });
  it("keeps at most five results and drops a row that is not a place", async () => {
    const many = [...Array(8).fill(HIT), { name: 3 }];
    const r = await placeSearch("green", undefined, deps((async () => new Response(JSON.stringify({ ok: true, results: many }))) as typeof fetch));
    expect(r).toHaveLength(5);
  });
});

describe("splitMatch", () => {
  it("cuts a text into before, the match (any case) and after", () => {
    expect(splitMatch("Hauz Khas Village", "khas")).toEqual(["Hauz ", "Khas", " Village"]);
  });
  it("is the whole text when nothing matches or the query is empty", () => {
    expect(splitMatch("Home", "zz")).toEqual(["Home", "", ""]);
    expect(splitMatch("Home", "")).toEqual(["Home", "", ""]);
  });
});
