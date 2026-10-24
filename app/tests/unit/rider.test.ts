// Story A5 (#152): the rider's online switch, location and the orders assigned to them.
import { describe, expect, it } from "vitest";
import { LOCATION_EVERY_MS, shouldSendLocation, locationLabel } from "../../src/lib/rider";
import { riderScope } from "../../src/lib/session";

describe("shouldSendLocation", () => {
  it("sends the first position at once, then at most every 30 seconds", () => {
    expect(LOCATION_EVERY_MS).toBe(30_000);
    expect(shouldSendLocation(null, 1000)).toBe(true);
    expect(shouldSendLocation(1000, 1000 + 29_999)).toBe(false);
    expect(shouldSendLocation(1000, 1000 + 30_000)).toBe(true);
  });
});

describe("riderScope", () => {
  it("reads the orders assigned to this rider", () => {
    expect(riderScope("u-1")).toEqual({ column: "rider_id", value: "u-1" });
  });
});

it("the location words come from LOCATION_EVERY_MS", () => {
  expect(locationLabel()).toBe("every 30 seconds");
});
