// Story #668 (boards A1 to A3): the customer's own address from the phone's location, through OpenStreetMap's reverse lookup (no key). Any failure means "type it by hand".
import { describe, expect, it, vi } from "vitest";
import { addressFrom, reverseAddress, dropFor } from "../../src/lib/locate";

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

// Story #910: the drop point follows the address. A hand edit after a location fix clears the fix; the same address keeps it; a new fix brings its own address.
describe("dropFor", () => {
  const fix = { lat: 28.5677, lng: 77.2432 };
  it("keeps the fix while the address is the one the location found", () => {
    expect(dropFor(fix, "B-12, Lajpat Nagar II", "B-12, Lajpat Nagar II")).toEqual(fix);
    expect(dropFor(fix, "B-12, Lajpat Nagar II", "  B-12, Lajpat Nagar II  ")).toEqual(fix);
  });
  it("clears the fix when the customer typed a different address", () => {
    expect(dropFor(fix, "B-12, Lajpat Nagar II", "B-12, Lajpat Nagar II, near the park gate")).toBeNull();
  });
  it("is null with no fix, or with no located address", () => {
    expect(dropFor(null, null, "Flat 4")).toBeNull();
    expect(dropFor(fix, null, "Flat 4")).toBeNull();
  });
  it("a second location from another place carries its own fix and its own address", () => {
    const again = { lat: 28.6, lng: 77.3 };
    expect(dropFor(again, "C-4, Hauz Khas", "C-4, Hauz Khas")).toEqual(again);
  });
});

// Story #969: Nominatim has no postcode in most of small-town India. The fallback asks Overpass for the nearest object with addr:postcode within 10 km.
// Replies are recorded: the Chhatarpur reply is the one measured on 7 Nov 2026 (no postcode at any zoom); the Overpass reply is shaped like the real one (nodes, and ways with a center).
describe("the nearest pin when the reverse lookup has none (story 969)", () => {
  const CHHATARPUR = { address: { road: "Link Road", village: "Rajnagar", state_district: "Chhatarpur", state: "Madhya Pradesh", country: "India" } };
  const OVERPASS = { elements: [
    { type: "node", lat: 24.95, lon: 79.7, tags: { "addr:postcode": "471105" } },
    { type: "way", center: { lat: 24.7, lon: 79.6 }, tags: { "addr:postcode": "471001" } },
    { type: "node", lat: 24.701, lon: 79.601, tags: { "addr:postcode": "47100" } },   // not six digits: skipped
    { type: "node", lat: 24.7005, lon: 79.6005, tags: { name: "no pin here" } },
  ] };
  const route = (calls: string[], overpass: () => Promise<Response>, nominatim: unknown = CHHATARPUR) => async (u: string | URL | Request) => {
    const url = String(u); calls.push(url);
    return url.includes("nominatim") ? new Response(JSON.stringify(nominatim)) : overpass();
  };

  it("fills the pin from the nearest tagged object, with exactly two calls and the 10 km query", async () => {
    const calls: string[] = [];
    const r = await reverseAddress(24.699, 79.599, route(calls, async () => new Response(JSON.stringify(OVERPASS))) as typeof fetch);
    expect(r).toEqual({ address: "Link Road, Rajnagar, Madhya Pradesh", pin: "471001" });   // the way 150 m away beats the node 30 km away
    expect(calls).toHaveLength(2);
    const q = decodeURIComponent(calls[1]);
    expect(q).toContain("around:10000,24.699,79.599");
    expect(q).toContain('"addr:postcode"');
  });

  it("makes no second call when the first reply has a fitting pin", async () => {
    const calls: string[] = [];
    const r = await reverseAddress(28.57, 77.24, route(calls, async () => { throw new Error("must not be called"); }, NOMINATIM) as typeof fetch);
    expect(r?.pin).toBe("110024");
    expect(calls).toHaveLength(1);
  });

  it("skips a nearby pin that disagrees with the state of the reply and takes the next fitting one", async () => {
    const delhi = { address: { road: "Ring Road", city: "New Delhi", state: "Delhi" } };
    const ov = { elements: [{ type: "node", lat: 28.5, lon: 77.2, tags: { "addr:postcode": "201301" } }, { type: "node", lat: 28.52, lon: 77.21, tags: { "addr:postcode": "110017" } }] };
    const r = await reverseAddress(28.5, 77.2, route([], async () => new Response(JSON.stringify(ov)), delhi) as typeof fetch);
    expect(r?.pin).toBe("110017");
  });

  it("leaves the pin empty (never a guess) when Overpass has nothing, fails, or answers with an error", async () => {
    for (const overpass of [async () => new Response(JSON.stringify({ elements: [] })), async () => { throw new Error("offline"); }, async () => new Response("busy", { status: 429 }), async () => new Response("not json")]) {
      const r = await reverseAddress(24.699, 79.599, route([], overpass) as typeof fetch);
      expect(r).toEqual({ address: "Link Road, Rajnagar, Madhya Pradesh", pin: "" });
    }
  });

  it("gives up after 4 seconds and leaves the pin empty", async () => {
    vi.useFakeTimers();
    try {
      const never = (_: string | URL | Request, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
      const fetchFn = (async (u: string | URL | Request, init?: RequestInit) => String(u).includes("nominatim") ? new Response(JSON.stringify(CHHATARPUR)) : never(u, init)) as typeof fetch;
      const p = reverseAddress(24.699, 79.599, fetchFn);
      await vi.advanceTimersByTimeAsync(4100);
      expect(await p).toEqual({ address: "Link Road, Rajnagar, Madhya Pradesh", pin: "" });
    } finally { vi.useRealTimers(); }
  });
});
