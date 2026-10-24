// Story H10 (#193) and #225: Day is the default at any hour, a pin wins, and a blocked storage does not break anything.
import { describe, expect, it } from "vitest";
import { applyTheme, parseTheme, pinTheme, readPin, resolveTheme, THEME_KEY } from "../../src/lib/theme";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
const doc = () => { const meta = { v: "", setAttribute: (_: string, v: string) => { meta.v = v; } }; return { documentElement: { dataset: {} as Record<string, string> }, querySelector: () => meta, meta } as unknown as Document & { meta: { v: string } }; };

describe("default", () => {
  it("#225: with no pin the theme is Day at any hour", () => {
    expect([5, 6, 12, 17, 18, 23, 0].map((h) => resolveTheme(null, h))).toEqual(["day", "day", "day", "day", "day", "day", "day"]);
  });
});
describe("pin", () => {
  it("a pinned theme wins; no pin is Day", () => {
    expect(resolveTheme("day", 22)).toBe("day");
    expect(resolveTheme("night", 12)).toBe("night");
    expect(resolveTheme(null, 22)).toBe("day");
  });
  it("only day or night is a valid pin", () => {
    expect([parseTheme("day"), parseTheme("night"), parseTheme("sunset"), parseTheme(null)]).toEqual(["day", "night", null, null]);
  });
  it("applyTheme sets data-theme and the browser bar colour; pinTheme saves and clears the pin", () => {
    const s = memory(), d = doc();
    expect(applyTheme(s, d, new Date(2026, 9, 24, 20, 0))).toBe("day");   // 20:00, no pin: Day (#225)
    expect(d.documentElement.dataset.theme).toBe("day");
    expect(d.meta.v).toBe("#e4e6d9");
    expect(pinTheme(s, d, "night", new Date(2026, 9, 24, 12, 0))).toBe("night");
    expect(s.m.get(THEME_KEY)).toBe("night");
    expect(d.meta.v).toBe("#0b1220");
    expect(pinTheme(s, d, null, new Date(2026, 9, 24, 20, 0))).toBe("day");   // the pin removed: Day again
    expect(s.m.has(THEME_KEY)).toBe(false);
  });
  it("blocked storage is not an error", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readPin(bad)).toBeNull();
    expect(pinTheme(bad, doc(), "night")).toBe("night");
  });
});

