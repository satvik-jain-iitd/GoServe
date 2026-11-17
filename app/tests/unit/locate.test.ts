// Story #668 (boards A1 to A3): the customer's own address from the phone's location, through OpenStreetMap's reverse lookup (no key). Any failure means "type it by hand".
import { describe, expect, it, vi } from "vitest";
import { addressFrom, boxWhy, currentPlace, findPhone, locLine, locWhy, locWords, readNearestPin, reverseAddress } from "../../src/lib/locate";

const NOMINATIM = { display_name: "B-12, Lajpat Nagar II, Lajpat Nagar, South Delhi, New Delhi, Delhi, 110024, India", address: { house_number: "B-12", road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110024", country: "India" } };

describe("addressFrom", () => {
  it("makes a short street address with the city and the state, and a pin code, never the country", () => {
    expect(addressFrom(NOMINATIM)).toEqual({ address: "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi, Delhi", pin: "110024" });
  });
  // Story 827: OpenStreetMap holds a Gurgaon object tagged postcode 110058 (a Delhi pin). The same reply says Haryana, so the pin and the state disagree.
  const GURGAON = { address: { road: "Sector 13 Road", city: "Gurugram", state: "Haryana", postcode: "110058", country: "India" } };
  it("drops a pin that contradicts its own state (Gurugram, Haryana, but a Delhi 110 pin)", () => {
    expect(addressFrom(GURGAON)).toEqual({ address: "Sector 13 Road, Gurugram, Haryana", pin: "" });
  });
  it("keeps a pin that agrees with its state (Gurugram, Haryana, 122004)", () => {
    expect(addressFrom({ address: { ...GURGAON.address, postcode: "122004" } })?.pin).toBe("122004");
  });
  it("keeps the pin when the state is one we have no table for, or no state came back", () => {
    expect(addressFrom({ address: { ...GURGAON.address, state: "Kerala" } })?.pin).toBe("110058");
    expect(addressFrom({ address: { road: "Sector 13 Road", city: "Gurugram", postcode: "110058" } })?.pin).toBe("110058");
  });
  it("accepts each state's own series and the border ones (Delhi 110, Noida in Uttar Pradesh 201, Faridabad in Haryana 121)", () => {
    const pin = (state: string, postcode: string) => addressFrom({ address: { road: "R", state, postcode } })?.pin;
    expect([pin("Delhi", "110024"), pin("Uttar Pradesh", "201301"), pin("Haryana", "121001"), pin("Rajasthan", "302001"), pin("Punjab", "160055")]).toEqual(["110024", "201301", "121001", "302001", "160055"]);
    expect([pin("Delhi", "201301"), pin("Uttar Pradesh", "110024"), pin("Rajasthan", "122004")]).toEqual(["", "", ""]);
  });
  it("does not repeat the state when the city already is the state", () => {
    expect(addressFrom({ address: { road: "R", city: "Delhi", state: "Delhi", postcode: "110001" } })?.address).toBe("R, Delhi");
  });
  it("keeps what it has when parts are missing, and drops a pin that is not six digits", () => {
    expect(addressFrom({ address: { road: "Ring Road", postcode: "1100" } })).toEqual({ address: "Ring Road", pin: "" });
  });
  it("is null when there is nothing to show", () => {
    expect(addressFrom({})).toBeNull();
    expect(addressFrom({ address: { country: "India" } })).toBeNull();
  });
});

describe("reverseAddress", () => {
  it("asks once with the coordinates and reads the answer", async () => {
    const urls: string[] = [];
    const r = await reverseAddress(28.57, 77.24, async (u) => { urls.push(String(u)); return new Response(JSON.stringify(NOMINATIM)); });
    expect(r).toEqual({ address: "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi, Delhi", pin: "110024" });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("lat=28.57");
    expect(urls[0]).toContain("lon=77.24");
  });
  it("is null when the network or the service fails", async () => {
    expect(await reverseAddress(1, 2, async () => { throw new Error("offline"); })).toBeNull();
    expect(await reverseAddress(1, 2, async () => new Response("no", { status: 429 }))).toBeNull();
  });
});

// Story #987 (was #969): Nominatim has no postcode in most of small-town India. The fallback asks our own table (rpc nearest_pin, GeoNames), never a third party.
// The reply has the shape of one measured on 7 Nov 2026 (no postcode at any zoom); the words are samples.
describe("the nearest pin when the reverse lookup has none (story 987)", () => {
  const SAMPLETOWN = { address: { road: "Link Road", village: "Sample Village", state_district: "Sampletown", state: "Sample State", country: "India" } };
  const deps = (fetchFn: typeof fetch) => ({ fetchFn, url: "https://x.supabase.co", anon: "anon-key", token: async () => "tok" });
  const route = (calls: { url: string; init?: RequestInit }[], pin: () => Promise<Response>, nominatim: unknown = SAMPLETOWN) => (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u); calls.push({ url, init });
    return url.includes("nominatim") ? new Response(JSON.stringify(nominatim)) : pin();
  }) as typeof fetch;
  const ask = (f: typeof fetch, lat = 28.57, lng = 77.24) => reverseAddress(lat, lng, f, deps(f));

  it("fills the pin from our own table with exactly two calls, the second to the Supabase rpc and nowhere else", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const r = await ask(route(calls, async () => new Response(JSON.stringify("900001"))));
    expect(r).toEqual({ address: "Link Road, Sample Village, Sample State", pin: "900001" });
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe("https://x.supabase.co/rest/v1/rpc/nearest_pin");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ p_lat: 28.57, p_lng: 77.24 });
    expect(calls.some((c) => c.url.includes("overpass"))).toBe(false);
  });

  it("makes no second call when the first reply has a fitting pin", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const r = await ask(route(calls, async () => { throw new Error("must not be called"); }, NOMINATIM), 28.57, 77.24);
    expect(r?.pin).toBe("110024");
    expect(calls).toHaveLength(1);
  });

  it("drops a pin from the table that disagrees with the state of the reply", async () => {
    const delhi = { address: { road: "Ring Road", city: "New Delhi", state: "Delhi" } };
    const r = await ask(route([], async () => new Response(JSON.stringify("201301")), delhi), 28.5, 77.2);
    expect(r?.pin).toBe("");
  });

  it("leaves the pin empty (never a guess) when the table has nothing, fails, or answers with an error", async () => {
    for (const pin of [async () => new Response("null"), async () => { throw new Error("offline"); }, async () => new Response("busy", { status: 429 }), async () => new Response("not json")]) {
      const r = await ask(route([], pin));
      expect(r).toEqual({ address: "Link Road, Sample Village, Sample State", pin: "" });
    }
  });

  it("gives up after 4 seconds and leaves the pin empty", async () => {
    vi.useFakeTimers();
    try {
      const f = (async (u: string | URL | Request, init?: RequestInit) => String(u).includes("nominatim") ? new Response(JSON.stringify(SAMPLETOWN))
        : new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))) as typeof fetch;
      const p = ask(f);
      await vi.advanceTimersByTimeAsync(4100);
      expect(await p).toEqual({ address: "Link Road, Sample Village, Sample State", pin: "" });
    } finally { vi.useRealTimers(); }
  });
});

// Bug 1526: every failure was called "blocked". The browser's error code says which of the three it is; the line is true for that cause.
describe("locWhy and its words (bug 1526)", () => {
  it("reads the error code: 1 blocked, 2 the phone's location is off, 3 too slow; no code is a line true for any cause", () => {
    expect(locWhy({ code: 1 })).toBe("denied");
    expect(locWhy({ code: 2 })).toBe("off");
    expect(locWhy({ code: 3 })).toBe("slow");
    expect(locWhy(new Error("no_geolocation"))).toBe("none");   // story 1530: an error with no code is not called "off"
    expect(locWhy(null)).toBe("none");
    expect(locLine("none" as never, "search above")).toBe("We could not find where you are. Try again, or search above.");
    expect(locLine("none" as never, "search above")).not.toMatch(/off|blocked/i);
  });
  it("blocked again after a tap says so, so the second tap shows something new", () => {
    expect(locWhy({ code: 1 }, "denied")).toBe("still");
    expect(locWhy({ code: 1 }, "still")).toBe("still");
    expect(locWhy({ code: 1 }, "off")).toBe("denied");
    expect(locWhy({ code: 2 }, "denied")).toBe("off");
  });
  it("only the blocked lines say blocked", () => {
    for (const why of ["ask", "off", "slow"] as const) expect(locLine(why, "search above")).not.toMatch(/blocked/i);
    expect(locLine("denied", "search above")).toBe("Location is off or blocked. Turn on location in your phone settings, or search above.");
    expect(locLine("off", "search for your address")).toBe("Your phone's location is off. Turn it on, or search for your address.");
    expect(locLine("slow", "search above")).toBe("Finding you is taking too long. Try again, or search above.");
    expect(locWords("still", "search above")).toEqual({ title: "Still off or blocked", sub: "Turn on location in your phone's settings, or search above." });   // the way out is the screen's own: no "pick a place" where there is no list
    expect(locLine("still", "search for your address")).toBe("Still off or blocked. Turn on location in your phone's settings, or search for your address.");
    expect(locWords("ask", "search above")).toEqual({ title: "We can't see where you are right now", sub: "Tap Use current location, or search above." });
  });
});

// Story 1548: the fix says how rough it is and how fast the phone moves; a phone that says neither gives null, never a guess.
describe("the phone's fix carries its accuracy and its speed (story 1548)", () => {
  const withFix = async (coords: object) => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords }) } });
    try { return await currentPlace(); } finally { vi.unstubAllGlobals(); }
  };
  it("keeps the accuracy and the speed the phone gave", async () => {
    expect(await withFix({ latitude: 28.5, longitude: 77.2, accuracy: 35, speed: 12 })).toEqual({ lat: 28.5, lng: 77.2, accuracy: 35, speed: 12 });
  });
  it("gives null for a speed or an accuracy the phone did not give", async () => {
    expect(await withFix({ latitude: 28.5, longitude: 77.2, accuracy: undefined, speed: null })).toEqual({ lat: 28.5, lng: 77.2, accuracy: null, speed: null });
    expect(await withFix({ latitude: 28.5, longitude: 77.2, speed: NaN })).toEqual({ lat: 28.5, lng: 77.2, accuracy: null, speed: null });
  });
});

// Story 1548 (the reviewer's call): "no postal code here" and "the read failed" are two answers. Only the first may grey "Use current location".
describe("the read of the nearest pin says when it failed (story 1548)", () => {
  const deps = (res: () => Promise<Response>) => ({ fetchFn: (() => res()) as unknown as typeof fetch, url: "https://x.test", anon: "anon", token: async () => "t" });
  const at = { lat: 28.57, lng: 77.24 };
  it("gives the pin, or an empty string when our table has none near", async () => {
    expect(await readNearestPin(at, undefined, deps(async () => new Response(JSON.stringify("900001"))))).toBe("900001");
    expect(await readNearestPin(at, undefined, deps(async () => new Response("null")))).toBe("");
  });
  it("gives null when the read failed: a server fault, or no network", async () => {
    expect(await readNearestPin(at, undefined, deps(async () => new Response("{}", { status: 500 })))).toBeNull();
    expect(await readNearestPin(at, undefined, deps(async () => { throw new Error("offline"); }))).toBeNull();
  });
});

// Story 1610: Safari on iPhone says "prompt" after a grant, so the phone keeps its own mark (gs-loc-ok) and the app reads by itself when the mark is set.
describe("findPhone with no tap and the mark gs-loc-ok (story 1610)", () => {
  const phone = (perm: string | null, answer: { coords: object } | { code: number }) => {
    const kept = new Map<string, string>();
    const read = vi.fn((ok: (p: unknown) => void, bad: (e: unknown) => void) => ("coords" in answer ? ok(answer) : bad(answer)));
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) } });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: read }, permissions: perm === null ? undefined : { query: async () => ({ state: perm }) } });
    return { kept, read };
  };
  const HERE = { coords: { latitude: 28.5, longitude: 77.2, accuracy: 20, speed: null } };

  it("prompt or no permissions.query, no mark: the phone is not read", async () => {
    for (const perm of ["prompt", null]) {
      const { read } = phone(perm, HERE);
      expect(await findPhone(false)).toBe("ask");
      expect(read).not.toHaveBeenCalled();
    }
  });
  it("prompt or no permissions.query, the mark set: the phone is read and found", async () => {
    for (const perm of ["prompt", null]) {
      const { kept, read } = phone(perm, HERE);
      kept.set("gs-loc-ok", "1");
      expect(await findPhone(false)).toMatchObject({ lat: 28.5, lng: 77.2 });
      expect(read).toHaveBeenCalledTimes(1);
    }
  });
  it("denied never reads, even with the mark set", async () => {
    const { kept, read } = phone("denied", HERE);
    kept.set("gs-loc-ok", "1");
    expect(await findPhone(false)).toBe("denied");
    expect(read).not.toHaveBeenCalled();
  });
  it("any find that worked sets the mark: a tap, and a find with no tap", async () => {
    for (const tap of [true, false]) {
      const { kept } = phone(tap ? "prompt" : "granted", HERE);
      await findPhone(tap);
      expect(kept.get("gs-loc-ok")).toBe("1");
    }
  });
  it("code 1 clears the mark; too slow and off keep it", async () => {
    for (const [code, left] of [[1, undefined], [2, "1"], [3, "1"]] as const) {
      const { kept } = phone("prompt", { code });
      kept.set("gs-loc-ok", "1");
      await findPhone(false);
      expect(kept.get("gs-loc-ok")).toBe(left);
    }
  });
  it("the box on Deliver to: never for ask; slow and none only after a tap; blocked and off always", () => {
    expect(boxWhy("ask", false)).toBeNull();
    expect(boxWhy("ask", true)).toBeNull();
    expect([boxWhy("slow", false), boxWhy("none", false)]).toEqual([null, null]);
    expect([boxWhy("slow", true), boxWhy("none", true)]).toEqual(["slow", "none"]);
    expect([boxWhy("denied", false), boxWhy("still", false), boxWhy("off", false)]).toEqual(["denied", "still", "off"]);
    expect(boxWhy(null, true)).toBeNull();
  });
});
