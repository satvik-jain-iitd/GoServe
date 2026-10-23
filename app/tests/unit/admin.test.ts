// Story A2 (#149): the admin screen's input rules.
import { describe, expect, it } from "vitest";
import { parsePins } from "../../src/lib/admin";

describe("parsePins", () => {
  it("reads pin codes separated by commas or spaces and drops repeats", () => {
    expect(parsePins("110016, 110017 110016")).toEqual({ pins: ["110016", "110017"], bad: [] });
  });
  it("names every entry that is not six digits", () => {
    expect(parsePins("1100, abc, 110016")).toEqual({ pins: ["110016"], bad: ["1100", "abc"] });
  });
  it("an empty field is no pin codes", () => {
    expect(parsePins("  ")).toEqual({ pins: [], bad: [] });
  });
});
