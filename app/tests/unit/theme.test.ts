// Story H10 (#193): Day and Night by the clock, a pin wins, and a blocked storage does not break anything.
import { describe, expect, it } from "vitest";
import { applyTheme, parseTheme, pinTheme, readPin, resolveTheme, themeAtHour, THEME_KEY, clockLabel } from "../../src/lib/theme";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
const doc = () => { const meta = { v: "", setAttribute: (_: string, v: string) => { meta.v = v; } }; return { documentElement: { dataset: {} as Record<string, string> }, querySelector: () => meta, meta } as unknown as Document & { meta: { v: string } }; };

describe("themeAtHour", () => {
  it("Day is 06:00 to 18:00, Night is 18:00 to 06:00", () => {
    expect([5, 6, 12, 17, 18, 23, 0].map(themeAtHour)).toEqual(["night", "day", "day", "day", "night", "night", "night"]);
  });
});
describe("pin", () => {
  it("a pinned theme wins over the clock; no pin follows the clock", () => {
    expect(resolveTheme("day", 22)).toBe("day");
    expect(resolveTheme("night", 12)).toBe("night");
    expect(resolveTheme(null, 22)).toBe("night");
  });
  it("only day or night is a valid pin", () => {
    expect([parseTheme("day"), parseTheme("night"), parseTheme("sunset"), parseTheme(null)]).toEqual(["day", "night", null, null]);
  });
  it("applyTheme sets data-theme and the browser bar colour; pinTheme saves and clears the pin", () => {
    const s = memory(), d = doc();
    expect(applyTheme(s, d, new Date(2026, 9, 24, 20, 0))).toBe("night");
    expect(d.documentElement.dataset.theme).toBe("night");
    expect(d.meta.v).toBe("#0b1220");
    expect(pinTheme(s, d, "day", new Date(2026, 9, 24, 20, 0))).toBe("day");
    expect(s.m.get(THEME_KEY)).toBe("day");
    expect(d.meta.v).toBe("#e4e6d9");
    expect(pinTheme(s, d, null, new Date(2026, 9, 24, 20, 0))).toBe("night");
    expect(s.m.has(THEME_KEY)).toBe(false);
  });
  it("blocked storage is not an error", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readPin(bad)).toBeNull();
    expect(pinTheme(bad, doc(), "night")).toBe("night");
  });
});

it("the By the clock chip label is built from the night hours", () => {
  expect(clockLabel()).toBe("6 pm to 6 am");
});
