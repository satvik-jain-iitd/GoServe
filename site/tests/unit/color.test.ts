import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  wcagLevel,
  formatRatio,
  readableInk,
  isValidHex,
} from "../../src/lib/color";
import { CONTRAST_PAIRS, CORE, SUPPORTING, STATUS } from "../../src/data/palette";

describe("color: hex parsing", () => {
  it("parses a 6-digit hex to rgb", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("expands a 3-digit hex", () => {
    expect(hexToRgb("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("rejects a bad hex", () => {
    expect(isValidHex("nope")).toBe(false);
    expect(() => hexToRgb("nope")).toThrow();
  });
});

describe("color: luminance and contrast", () => {
  it("gives white luminance 1 and black 0", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("computes black on white as 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#45654E", "#E4E6D9")).toBeCloseTo(
      contrastRatio("#E4E6D9", "#45654E"),
      5,
    );
  });

  it("classifies WCAG levels", () => {
    expect(wcagLevel(8)).toBe("AAA");
    expect(wcagLevel(5)).toBe("AA");
    expect(wcagLevel(3.5)).toBe("AA Large");
    expect(wcagLevel(2)).toBe("Fail");
  });

  it("formats a ratio to two decimals", () => {
    expect(formatRatio(4.567)).toBe("4.57:1");
  });
});

describe("color: readable ink", () => {
  it("picks dark ink on light backgrounds and light ink on dark", () => {
    expect(readableInk("#E4E6D9")).toBe("#263528");
    expect(readableInk("#263528")).toBe("#FFFFFF");
  });
});

// The whole point of the palette page: every declared pair must pass at least AA.
describe("palette: contrast pairs meet WCAG AA", () => {
  for (const pair of CONTRAST_PAIRS) {
    it(`${pair.label} is at least AA`, () => {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(ratio, `${pair.label} = ${formatRatio(ratio)}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("palette: every swatch has a valid hex", () => {
  const all = [...CORE, ...SUPPORTING, ...STATUS];
  for (const s of all) {
    it(`${s.name} (${s.hex}) is valid`, () => {
      expect(isValidHex(s.hex)).toBe(true);
    });
  }
});
