// Story #668 (boards A1 to A3): the customer's own address from the phone's location, through OpenStreetMap's reverse lookup (no key). Any failure means "type it by hand".
import { describe, expect, it } from "vitest";
import { addressFrom, reverseAddress } from "../../src/lib/locate";

const NOMINATIM = { display_name: "B-12, Lajpat Nagar II, Lajpat Nagar, South Delhi, New Delhi, Delhi, 110024, India", address: { house_number: "B-12", road: "Lajpat Nagar II", suburb: "Lajpat Nagar", city: "New Delhi", state: "Delhi", postcode: "110024", country: "India" } };

describe("addressFrom", () => {
  it("makes a short street address and a pin code, never the state or the country", () => {
    expect(addressFrom(NOMINATIM)).toEqual({ address: "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi", pin: "110024" });
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
    expect(r).toEqual({ address: "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi", pin: "110024" });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("lat=28.57");
    expect(urls[0]).toContain("lon=77.24");
  });
  it("is null when the network or the service fails", async () => {
    expect(await reverseAddress(1, 2, async () => { throw new Error("offline"); })).toBeNull();
    expect(await reverseAddress(1, 2, async () => new Response("no", { status: 429 }))).toBeNull();
  });
});
