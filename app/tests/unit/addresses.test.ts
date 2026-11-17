// Story #976 and #1035: saved addresses. The pick on open (the last used one), the distance words, and the first row made from today's single saved address.
import { describe, it, expect } from "vitest";
import { distanceM, distanceWord, hereRow, lastUsed, NEAR_M, nearSaved, type SavedAddress } from "../../src/lib/addresses";

const row = (id: string, label: string, lat: number | null, lng: number | null, used: string): SavedAddress => ({ id, label, address: `${label} street, town`, pin: "900001", lat, lng, last_used_at: used });
const HOME = row("h", "Home", 28.5677, 77.2432, "2026-11-01T10:00:00Z");
const OFFICE = row("o", "Office", 28.6, 77.28, "2026-11-05T10:00:00Z");   // about 5 km from Home, used more recently

describe("distanceM and distanceWord", () => {
  it("is about 111 km for one degree of latitude and 0 for the same place", () => {
    expect(Math.round(distanceM({ lat: 24, lng: 79 }, { lat: 25, lng: 79 }) / 1000)).toBe(111);
    expect(distanceM({ lat: 24, lng: 79 }, { lat: 24, lng: 79 })).toBe(0);
  });
  it("story 1608: under 1000 m it says metres to the nearest 10, then kilometres; the word here is the list's, for one row only", () => {
    expect(distanceWord(150)).toBe("150 m");
    expect(distanceWord(154)).toBe("150 m");
    expect(distanceWord(4)).toBe("10 m");   // never "0 m"
    expect(distanceWord(994)).toBe("990 m");
    expect(distanceWord(997)).toBe("1 km");   // never "1000 m"
    expect(distanceWord(3_200)).toBe("3 km");
    expect(distanceWord(289_400)).toBe("289 km");
  });
});

// Story 1608: one row is "here". Rows with a point where distance - min(accuracy, near) <= near, nearest first; rows within 5 m of the nearest: used last wins, then the id.
describe("hereRow (story 1608)", () => {
  const at = { lat: 28.5677, lng: 77.2432 };
  const north = (m: number) => at.lat + m / 111_194.93;   // a point m metres north of the phone
  const r = (id: string, m: number | null, used = "2026-11-01T10:00:00Z"): SavedAddress => ({ id, label: id, address: "x", pin: "110016", lat: m === null ? null : north(m), lng: m === null ? null : at.lng, last_used_at: used });
  it("the start value of the near distance is 100 m", () => {
    expect(NEAR_M).toBe(100);
  });
  it("three rows inside 100 m: the nearest one", () => {
    expect(hereRow([r("a", 60, "2026-11-09T10:00:00Z"), r("b", 30), r("c", 90)], at, 100)?.id).toBe("b");
  });
  it("40 m and 43 m, the 43 m one used last: the 43 m one", () => {
    expect(hereRow([r("a", 40, "2026-11-01T10:00:00Z"), r("b", 43, "2026-11-05T10:00:00Z")], at, 100)?.id).toBe("b");
  });
  it("40 m and 60 m: the 40 m one, whatever was used last", () => {
    expect(hereRow([r("a", 40, "2026-11-01T10:00:00Z"), r("b", 60, "2026-11-05T10:00:00Z")], at, 100)?.id).toBe("a");
  });
  it("the same distance and the same last use: the id decides", () => {
    expect(hereRow([r("b", 40), r("a", 40)], at, 100)?.id).toBe("a");
  });
  it("no row inside: none", () => {
    expect(hereRow([r("a", 101), r("b", 5_000)], at, 100)).toBeNull();
    expect(hereRow([], at, 100)).toBeNull();
  });
  it("distance 130 m, accuracy 50 m: here. Distance 250 m, accuracy 500 m: not here (the accuracy counts up to the near distance only)", () => {
    expect(hereRow([r("a", 130)], { ...at, accuracy: 50 }, 100)?.id).toBe("a");
    expect(hereRow([r("a", 130)], { ...at, accuracy: null }, 100)).toBeNull();   // no accuracy counts as 0
    expect(hereRow([r("a", 130)], at, 100)).toBeNull();
    expect(hereRow([r("a", 250)], { ...at, accuracy: 500 }, 100)).toBeNull();
    expect(hereRow([r("a", 200)], { ...at, accuracy: 500 }, 100)?.id).toBe("a");
  });
  it("a row with no point: never", () => {
    expect(hereRow([r("old", null, "2026-11-09T10:00:00Z")], at, 100)).toBeNull();
    expect(hereRow([r("old", null, "2026-11-09T10:00:00Z"), r("a", 80)], at, 100)?.id).toBe("a");
  });
  it("follows the near distance it is given (the setting)", () => {
    expect(hereRow([r("a", 150)], at, 200)?.id).toBe("a");
    expect(hereRow([r("a", 150)], at, 100)).toBeNull();
  });
  it("does not change the list it is given", () => {
    const list = [r("a", 60), r("b", 30)];
    hereRow(list, at, 100);
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
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
