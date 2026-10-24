// Story H10 (#193) and #225: Day is the default at any hour, a pin wins, and a blocked storage does not break anything.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyTheme, DEFAULT_THEME, parseTheme, pinTheme, readPin, resolveTheme, THEME_KEY } from "../../src/lib/theme";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
const doc = () => { const meta = { v: "", setAttribute: (_: string, v: string) => { meta.v = v; } }; return { documentElement: { dataset: {} as Record<string, string> }, querySelector: () => meta, meta } as unknown as Document & { meta: { v: string } }; };

describe("default", () => {
  it("#225: with no pin the theme is Day at any hour", () => {
    expect(resolveTheme(null)).toBe("day");   // no hour anywhere: the clock has no say
  });
});
describe("pin", () => {
  it("a pinned theme wins; no pin is Day", () => {
    expect(resolveTheme("day")).toBe("day");
    expect(resolveTheme("night")).toBe("night");
    expect(resolveTheme(null)).toBe("day");
  });
  it("only day or night is a valid pin", () => {
    expect([parseTheme("day"), parseTheme("night"), parseTheme("sunset"), parseTheme(null)]).toEqual(["day", "night", null, null]);
  });
  it("applyTheme sets data-theme and the browser bar colour; pinTheme saves and clears the pin", () => {
    const s = memory(), d = doc();
    expect(applyTheme(s, d)).toBe("day");   // no pin: Day (#225)
    expect(d.documentElement.dataset.theme).toBe("day");
    expect(d.meta.v).toBe("#e4e6d9");
    expect(pinTheme(s, d, "night")).toBe("night");
    expect(s.m.get(THEME_KEY)).toBe("night");
    expect(d.meta.v).toBe("#0b1220");
    expect(pinTheme(s, d, null)).toBe("day");   // the pin removed: Day again
    expect(s.m.has(THEME_KEY)).toBe(false);
  });
  it("blocked storage is not an error", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readPin(bad)).toBeNull();
    expect(pinTheme(bad, doc(), "night")).toBe("night");
  });
});

describe("index.html first paint", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  it("uses the same key and the same default as lib/theme, and no clock", () => {
    expect(html).toContain(`localStorage.getItem("${THEME_KEY}")`);
    expect(html).toContain(`? p : "${DEFAULT_THEME}"`);   // no pin: the default
    expect(html).not.toMatch(/getHours/);   // #225: the clock has no say in the first paint either
  });
});
