// Story #1037 (board C6-PinMap): the words and the strips of the pin map card, and the call that tells if a kitchen reaches the pin.
import { describe, it, expect } from "vitest";
import { addressText, cardWords, stripsFor, serveAt } from "../../src/lib/pinMap";

describe("cardWords", () => {
  it("the first part of the words is the place name, the rest is the address line", () => {
    expect(cardWords("Green Park, New Delhi, Delhi")).toEqual({ name: "Green Park", rest: "New Delhi, Delhi" });
  });
  it("one part is the name alone; nothing is a quiet fallback", () => {
    expect(cardWords("Chhatarpur")).toEqual({ name: "Chhatarpur", rest: "" });
    expect(cardWords(null)).toEqual({ name: "Pin on the map", rest: "" });
  });
});

describe("stripsFor", () => {
  const PIN = { lat: 28.55, lng: 77.2 };
  it("a served pin gets the lime strip with the kitchen distance", () => {
    expect(stripsFor({ serve: { serviceable: true, kitchenM: 1230 }, here: null, pin: PIN })).toEqual([{ kind: "ready", text: "We deliver here · the kitchen is 1.2 km from the pin" }]);
    expect(stripsFor({ serve: { serviceable: true, kitchenM: 640 }, here: null, pin: PIN })[0].text).toBe("We deliver here · the kitchen is 640 m from the pin");
  });
  it("a pin no kitchen reaches gets the red strip", () => {
    expect(stripsFor({ serve: { serviceable: false, kitchenM: null }, here: null, pin: PIN })).toEqual([{ kind: "error", text: "Not in our area yet" }]);
  });
  it("a pin far from the phone adds the warm strip with the distance, after the served one", () => {
    const far = stripsFor({ serve: { serviceable: true, kitchenM: 900 }, here: { lat: 24.9, lng: 79.6 }, pin: PIN });
    expect(far.map((s) => s.kind)).toEqual(["ready", "warn"]);
    expect(far[1].text).toMatch(/^\d{3} km from where you are now$/);
  });
  it("near the phone adds nothing; no answer yet adds nothing; never more than two", () => {
    expect(stripsFor({ serve: { serviceable: true, kitchenM: 900 }, here: { lat: 28.5501, lng: 77.2001 }, pin: PIN })).toHaveLength(1);
    expect(stripsFor({ serve: null, here: null, pin: PIN })).toEqual([]);
    expect(stripsFor({ serve: { serviceable: false, kitchenM: null }, here: { lat: 10, lng: 70 }, pin: PIN })).toHaveLength(2);
  });
});

describe("serveAt", () => {
  const deps = (fetchFn: typeof fetch) => ({ fetchFn, url: "https://x.supabase.co", anon: "anon-key", token: async () => "tok" });
  it("asks GET /functions/v1/serviceability with the place and reads serviceable and the nearest kitchen", async () => {
    let url = "";
    const f = (async (u: string | URL | Request) => { url = String(u); return new Response(JSON.stringify({ ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k", name: "Hauz", distance_m: 1230, eta_min: 30, open: true }, { kitchen_id: "j", name: "Far", distance_m: 2500, eta_min: 40, open: true }] })); }) as typeof fetch;
    expect(await serveAt({ lat: 28.55, lng: 77.2 }, deps(f))).toEqual({ serviceable: true, kitchenM: 1230 });
    expect(url).toBe("https://x.supabase.co/functions/v1/serviceability?lat=28.55&lng=77.2");
  });
  it("not serviceable has no kitchen distance", async () => {
    const f = (async () => new Response(JSON.stringify({ ok: true, serviceable: false, request_here: true, kitchens: [] }))) as typeof fetch;
    expect(await serveAt({ lat: 10, lng: 70 }, deps(f))).toEqual({ serviceable: false, kitchenM: null });
  });
  it("is null on an error, a bad body or no network", async () => {
    for (const f of [async () => new Response("{}", { status: 502 }), async () => new Response("nope"), async () => { throw new Error("offline"); }]) {
      expect(await serveAt({ lat: 1, lng: 2 }, deps(f as typeof fetch))).toBeNull();
    }
  });
});

describe("addressText (story #1038: what the rider reads)", () => {
  it("the house, then the place words; a landmark is added as near", () => {
    expect(addressText("12B, 2nd floor", "", "Green Park, New Delhi, Delhi")).toBe("12B, 2nd floor, Green Park, New Delhi, Delhi");
    expect(addressText("12B", "Metro gate 2", "Green Park, New Delhi")).toBe("12B, near Metro gate 2, Green Park, New Delhi");
  });
  it("trims the words and leaves out what is empty", () => {
    expect(addressText("  12B  ", "  ", "")).toBe("12B");
    expect(addressText("12B", "", "  Green Park  ")).toBe("12B, Green Park");
  });
});
