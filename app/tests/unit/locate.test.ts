// Story #668 (boards A1 to A3): the customer's own address from the phone's location, through OpenStreetMap's reverse lookup (no key). Any failure means "type it by hand".
import { describe, expect, it } from "vitest";
import { addressFrom, reverseAddress } from "../../src/lib/locate";

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
