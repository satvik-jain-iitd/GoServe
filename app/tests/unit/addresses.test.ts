// Story #976 and #1035: saved addresses. The pick on open (the last used one), the distance words, and the first row made from today's single saved address.
import { describe, it, expect } from "vitest";
import { distanceM, distanceWord, lastUsed, nearSaved, type SavedAddress } from "../../src/lib/addresses";

const row = (id: string, label: string, lat: number | null, lng: number | null, used: string): SavedAddress => ({ id, label, address: `${label} street, town`, pin: "900001", lat, lng, last_used_at: used });
const HOME = row("h", "Home", 28.5677, 77.2432, "2026-11-01T10:00:00Z");
const OFFICE = row("o", "Office", 28.6, 77.28, "2026-11-05T10:00:00Z");   // about 5 km from Home, used more recently

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

// Story 1529: on open the saved address the phone is at is picked: the nearest one inside the near distance. A row with no pin is never picked.
describe("nearSaved (story 1529)", () => {
  const row = (id: string, lat: number | null, lng: number | null): SavedAddress => ({ id, label: id, address: "x", pin: "110016", lat, lng, last_used_at: "2026-11-01T10:00:00Z" });
  const at = { lat: 28.5690, lng: 77.2440 };
  it("gives the nearest row inside the distance", () => {
    expect(nearSaved([row("far", 28.6208, 77.3639), row("home", 28.5677, 77.2432), row("door", 28.5691, 77.2441)], at, 200)?.id).toBe("door");
  });
  it("gives null when every row is past the distance, has no pin, or the list is empty", () => {
    expect(nearSaved([row("home", 28.5677, 77.2432)], at, 100)).toBeNull();   // about 165 m away
    expect(nearSaved([row("old", null, null)], at, 200)).toBeNull();
    expect(nearSaved([], at, 200)).toBeNull();
  });
  it("story 1548: a rough fix that could be inside the near distance counts as near; a sharp one does not", () => {
    const home = [row("home", 28.5677, 77.2432)];
    const halfKm = { lat: 28.5722, lng: 77.2432 };   // about 500 m from home
    expect(nearSaved(home, halfKm, 200)).toBeNull();
    expect(nearSaved(home, halfKm, 200, 50)).toBeNull();
    expect(nearSaved(home, halfKm, 200, 400)?.id).toBe("home");
  });
});
