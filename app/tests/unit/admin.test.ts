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

import { photoPath, photoProblem, rupeesToPaise } from "../../src/lib/admin";

describe("rupeesToPaise (story A3)", () => {
  it("turns rupees into paise", () => {
    expect(rupeesToPaise("320")).toBe(32000);
    expect(rupeesToPaise("60.50")).toBe(6050);
    expect(rupeesToPaise(" 8 ")).toBe(800);
  });
  it("refuses empty, negative, zero, text and more than two decimals", () => {
    for (const bad of ["", "-5", "0", "abc", "1.234", "1,5"]) expect(rupeesToPaise(bad), bad).toBeNull();
  });
});

describe("photoProblem", () => {
  it("accepts a picture up to 3 MB", () => {
    expect(photoProblem({ type: "image/jpeg", size: 3 * 1024 * 1024 })).toBeNull();
  });
  it("refuses a file that is not a picture, or is too big", () => {
    expect(photoProblem({ type: "application/pdf", size: 10 })).toMatch(/picture/);
    expect(photoProblem({ type: "image/png", size: 3 * 1024 * 1024 + 1 })).toMatch(/3 MB/);
  });
});

describe("photoPath", () => {
  it("keeps the photo under its kitchen with a safe name", () => {
    expect(photoPath("k-1", "My Dish (1).JPG", "abc")).toBe("k-1/abc.jpg");
    expect(photoPath("k-1", "noext", "abc")).toBe("k-1/abc.jpg");
  });
});
