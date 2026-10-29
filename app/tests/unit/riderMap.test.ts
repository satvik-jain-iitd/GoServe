// Story #691 (board T2, T3): the rider's ping becomes a marker, a distance and the words under the map.
import { describe, expect, it } from "vitest";
import { agoText, distanceText, lastSeenText, riderLine, tileUrl, toPoint } from "../../src/lib/riderMap";

const SEEN = new Date(2026, 9, 29, 20, 0, 0);   // 8:00 pm on the phone's own clock, so the test holds in any time zone
const NOW = SEEN.getTime() + 140_000;
const at = (secondsAgo: number) => new Date(NOW - secondsAgo * 1000).toISOString();

describe("ping to marker", () => {
  it("S1 a tracking row with a place gives a point; no place gives none", () => {
    expect(toPoint({ rider_lat: 28.57, rider_lng: 77.24, updated_at: at(20) })).toEqual({ lat: 28.57, lng: 77.24, at: at(20) });
    expect(toPoint({ rider_lat: null, rider_lng: null, updated_at: at(20) })).toBeNull();
    expect(toPoint(null)).toBeNull();
  });
});

describe("the words", () => {
  it("S2 how long ago: seconds under a minute, minutes under an hour, then hours", () => {
    expect(agoText(at(20), NOW)).toBe("20 s ago");
    expect(agoText(at(120), NOW)).toBe("2 min ago");
    expect(agoText(at(3 * 3600), NOW)).toBe("3 h ago");
    expect(agoText(at(-5), NOW)).toBe("0 s ago");   // a clock a little ahead never shows a negative
  });
  it("S3 distance: km with one decimal from 1 km, whole metres under it", () => {
    expect(distanceText(28.5700, 77.2400, 28.5810, 77.2400)).toBe("1.2 km");
    expect(distanceText(28.5700, 77.2400, 28.5740, 77.2400)).toBe("440 m");
  });
  it("S4 the line under the map is word for word from board T2, and the offline line from board T3", () => {
    expect(riderLine("Rahul", "1.2 km", at(20), NOW)).toBe("Rahul is 1.2 km away · updated 20 s ago");
    expect(lastSeenText(SEEN.toISOString(), NOW)).toBe("Last seen 8:00 pm, 2 min ago");
  });
});

describe("tiles", () => {
  it("S5 no tile address means no tile call at all (prod); an address with {z}/{x}/{y} is used as it is", () => {
    expect(tileUrl(undefined)).toBeNull();
    expect(tileUrl("")).toBeNull();
    expect(tileUrl("https://tile.example/x.png")).toBeNull();   // a template without the three parts is refused
    expect(tileUrl("https://t.example/{z}/{x}/{y}.png")).toBe("https://t.example/{z}/{x}/{y}.png");
  });
});
