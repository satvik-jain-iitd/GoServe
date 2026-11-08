// Story #976 and #1035: saved addresses. The pick on open (the last used one), the distance words, and the first row made from today's single saved address.
import { describe, it, expect } from "vitest";
import { distanceM, distanceWord, lastUsed, firstFromProfile, type SavedAddress } from "../../src/lib/addresses";

const row = (id: string, label: string, lat: number | null, lng: number | null, used: string): SavedAddress => ({ id, label, address: `${label} street, town`, pin: "471001", lat, lng, last_used_at: used });
const HOME = row("h", "Home", 24.9167, 79.5833, "2026-11-01T10:00:00Z");
const OFFICE = row("o", "Office", 24.95, 79.62, "2026-11-05T10:00:00Z");   // about 5 km from Home, used more recently

describe("distanceM and distanceWord", () => {
  it("is about 111 km for one degree of latitude and 0 for the same place", () => {
    expect(Math.round(distanceM({ lat: 24, lng: 79 }, { lat: 25, lng: 79 }) / 1000)).toBe(111);
    expect(distanceM({ lat: 24, lng: 79 }, { lat: 24, lng: 79 })).toBe(0);
  });
  it("says here within the near radius, then kilometres", () => {
    expect(distanceWord(150, 200)).toBe("here");
    expect(distanceWord(201, 200)).toBe("1 km");
    expect(distanceWord(3_200, 200)).toBe("3 km");
    expect(distanceWord(289_400, 200)).toBe("289 km");
  });
});

describe("lastUsed (story #1035: on open the address used last, always)", () => {
  it("is the row with the newest last_used_at", () => {
    expect(lastUsed([HOME, OFFICE])?.id).toBe("o");
    expect(lastUsed([OFFICE, HOME])?.id).toBe("o");
  });
  it("does not look at where any row is", () => {
    const flat = row("f", "Flat", null, null, "2026-11-06T10:00:00Z");
    expect(lastUsed([flat, HOME, OFFICE])?.id).toBe("f");
  });
  it("is null for an empty list", () => {
    expect(lastUsed([])).toBeNull();
  });
  it("does not change the list it is given", () => {
    const list = [HOME, OFFICE];
    lastUsed(list);
    expect(list.map((r) => r.id)).toEqual(["h", "o"]);
  });
});

describe("firstFromProfile", () => {
  it("makes a Home row from today's single saved address", () => {
    expect(firstFromProfile({ address: "C-128, Green Avenue Colony", pin: "471001" })).toEqual({ label: "Home", address: "C-128, Green Avenue Colony", pin: "471001" });
  });
  it("makes nothing from a missing address or a bad pin", () => {
    expect(firstFromProfile({ address: "", pin: "471001" })).toBeNull();
    expect(firstFromProfile({ address: "C-128, Green Avenue Colony", pin: "4710" })).toBeNull();
    expect(firstFromProfile({ address: "abc", pin: "471001" })).toBeNull();
  });
});
