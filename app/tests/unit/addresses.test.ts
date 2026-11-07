// Story #976: saved addresses. The pick on open, the distance words, and the first row made from today's single saved address.
import { describe, it, expect } from "vitest";
import { distanceM, distanceWord, pickOnOpen, firstFromProfile, type SavedAddress } from "../../src/lib/addresses";

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

describe("pickOnOpen", () => {
  it("picks the saved address within address_near_m of the phone", () => {
    expect(pickOnOpen([HOME, OFFICE], { lat: 24.9168, lng: 79.5834 }, 200)).toEqual({ id: "h", asks: false });
  });
  it("picks the nearest one when two are within the radius", () => {
    const near = row("n", "Nani", 24.91671, 79.58331, "2026-10-01T10:00:00Z");
    expect(pickOnOpen([HOME, near], { lat: 24.91671, lng: 79.58331 }, 500)).toEqual({ id: "n", asks: false });
  });
  it("is far from all: nothing is selected and the page asks", () => {
    expect(pickOnOpen([HOME, OFFICE], { lat: 25.5, lng: 80.2 }, 200)).toEqual({ id: null, asks: true });
  });
  it("has no phone place (no permission): the last used one stays selected and nothing asks", () => {
    expect(pickOnOpen([HOME, OFFICE], null, 200)).toEqual({ id: "o", asks: false });
  });
  it("skips a row that has no place of its own when it measures", () => {
    const flat = row("f", "Flat", null, null, "2026-11-06T10:00:00Z");
    expect(pickOnOpen([flat, HOME], { lat: 24.9167, lng: 79.5833 }, 200)).toEqual({ id: "h", asks: false });
  });
  it("is none for an empty list", () => {
    expect(pickOnOpen([], { lat: 24, lng: 79 }, 200)).toEqual({ id: null, asks: false });
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
