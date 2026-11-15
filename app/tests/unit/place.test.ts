// Story 1532: the one stored delivery place. It comes back whole, an old phone's postal code and typed words become a place with no point, and only a confirmed point can be ordered to.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { clearPlace, loadPlace, pointOf, savePlace, type StoredPlace } from "../../src/lib/place";

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
};
const HOME: StoredPlace = { address: "C-4, Green Park Extension", pin: "110016", lat: 28.5677, lng: 77.2432, house: "C-4", landmark: "the park gate", confirmed: true, id: "h1" };

describe("the stored place", () => {
  it("comes back whole, and the kitchen cache finds its postal code", () => {
    const s = store();
    savePlace(HOME, s);
    expect(loadPlace(s)).toEqual(HOME);
    expect(s.getItem("gs-pin")).toBe("110016");
  });
  it("is nothing on a new phone and after it is cleared", () => {
    const s = store();
    expect(loadPlace(s)).toBeNull();
    savePlace(HOME, s);
    clearPlace(s);
    expect(loadPlace(s)).toBeNull();
    expect(s.getItem("gs-pin")).toBeNull();
  });
  it("an older build's postal code and typed words become a place with no point, not confirmed", () => {
    const s = store();
    s.setItem("gs-pin", "110016");
    s.setItem("gs-draft", JSON.stringify({ step: "menu", cart: {}, address: "Flat 4, Green Park", name: "", phone: "" }));
    expect(loadPlace(s)).toEqual({ address: "Flat 4, Green Park", pin: "110016", lat: null, lng: null, house: "", landmark: "", confirmed: false, id: null });
  });
  it("damaged data is no place, and a place with a bad postal code is no place", () => {
    const s = store();
    s.setItem("gs-place", "{not json");
    expect(loadPlace(s)).toBeNull();
    s.setItem("gs-place", JSON.stringify({ ...HOME, pin: "1100" }));
    expect(loadPlace(s)).toBeNull();
  });
  it("a place with half a point has no point and is not confirmed", () => {
    const s = store();
    s.setItem("gs-place", JSON.stringify({ ...HOME, lng: "x" }));
    expect(loadPlace(s)).toMatchObject({ lat: null, lng: null, confirmed: false });
  });
});

describe("pointOf: the point an order may carry", () => {
  it("a confirmed place gives its point", () => expect(pointOf(HOME)).toEqual({ lat: 28.5677, lng: 77.2432 }));
  it("a raw phone fix (not confirmed), a place with no point and no place give none", () => {
    expect(pointOf({ ...HOME, confirmed: false })).toBeNull();
    expect(pointOf({ ...HOME, lat: null, lng: null })).toBeNull();
    expect(pointOf(null)).toBeNull();
  });
});

// Story 1532, review of PR 1541: the Bill's button is off for a place that is not confirmed, and the guard inside place() uses the same pointOf.
// That holds only while the button is the one way into place(). The old phone-code sheet at checkout called place() by itself, past the button. This reads the source so no such path comes back.
describe("an order starts only at the Bill's button", () => {
  const app = readFileSync(resolve(__dirname, "../../src/App.tsx"), "utf8");
  it("nothing calls place() by itself; the Bill gets it as onPlace, once", () => {
    expect(app.replace("async function place()", "").match(/\bplace\(\)/g) ?? []).toEqual([]);
    expect(app.match(/\{place\}/g)).toEqual(["{place}"]);
    expect(app.match(/onPlace=\{place\}/g)).toHaveLength(1);
  });
  it("the phone-code sheet shows only as the welcome wall, never at checkout", () => {
    expect(app.match(/<OtpSheet\b/g)).toHaveLength(1);
    expect(app).toMatch(/<OtpSheet welcome\b/);
  });
});
