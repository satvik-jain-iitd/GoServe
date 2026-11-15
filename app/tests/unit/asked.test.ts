// Story 1548: what the phone remembers of the box "Where should we deliver?" (lib/asked.ts).
import { describe, expect, it } from "vitest";
import { answered, dayOf, loadSpots, MOVING_MS, saveSpots, SPOTS_MAX, withSpot, type Spot } from "../../src/lib/asked";

const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage; };
const SPOT = { lat: 28.6139, lng: 77.209 };
const NEAR = { lat: 28.6145, lng: 77.2095 };   // about 80 m away
const FAR = { lat: 28.7, lng: 77.1 };
const noon = new Date(2026, 10, 15, 12, 0, 0);
const later = (ms: number) => new Date(noon.getTime() + ms);

describe("the spots the customer answered for (story 1548)", () => {
  it("no box again the same day inside the near distance of the spot", () => {
    const list = withSpot([], SPOT, false, noon);
    expect(answered(list, NEAR, 200, later(5 * 3600_000))).toBe(true);
    expect(answered(list, NEAR, 50, noon)).toBe(false);   // past the near distance
    expect(answered(list, FAR, 200, noon)).toBe(false);   // another spot
    expect(answered([], SPOT, 200, noon)).toBe(false);
  });
  it("the next local day the spot is asked about once more", () => {
    const list = withSpot([], SPOT, false, noon);
    expect(answered(list, SPOT, 200, new Date(2026, 10, 15, 23, 59, 0))).toBe(true);
    expect(answered(list, SPOT, 200, new Date(2026, 10, 16, 0, 1, 0))).toBe(false);
    expect(dayOf(new Date(2026, 10, 16, 0, 1, 0))).toBe("2026-11-16");
  });
  it("an answer from a moving vehicle holds for 3 hours at any spot, and no longer", () => {
    const list = withSpot([], SPOT, true, noon);
    expect(answered(list, FAR, 200, later(MOVING_MS - 1000))).toBe(true);
    expect(answered(list, FAR, 200, later(MOVING_MS + 1000))).toBe(false);
    expect(answered(list, SPOT, 200, later(MOVING_MS + 1000))).toBe(true);   // its own spot still counts for the day
    expect(answered(withSpot([], SPOT, false, noon), FAR, 200, later(1000))).toBe(false);   // no speed: only its own spot
  });
  it("keeps the newest 20 spots, and reads back what it wrote", () => {
    let list: Spot[] = [];
    for (let i = 0; i < 25; i++) list = withSpot(list, { lat: 20 + i, lng: 70 }, false, later(i));
    expect(list).toHaveLength(SPOTS_MAX);
    expect(list[0].lat).toBe(44);   // the newest first
    const s = store();
    saveSpots(list, s);
    expect(loadSpots(s)).toEqual(list);
  });
  it("damaged or blocked storage is an empty list", () => {
    const s = store();
    s.setItem("gs-asked-spots", "{not json");
    expect(loadSpots(s)).toEqual([]);
    s.setItem("gs-asked-spots", JSON.stringify([{ lat: "x" }, null, 4]));
    expect(loadSpots(s)).toEqual([]);
    expect(loadSpots({ getItem: () => { throw new Error("blocked"); } } as unknown as Storage)).toEqual([]);
  });
});
