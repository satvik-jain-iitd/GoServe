// Story 1401: the dish sheet and the kitchen menu rows do not share a price class name.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (f: string) => readFileSync(resolve(__dirname, "../../src", f), "utf8");
const css = read("ui/ui.css");

describe("price class names", () => {
  it("the customer sheet price rule (ui-dish-price) is defined once", () => {
    expect(css.match(/^\.ui-dish-price\s*\{/gm)?.length).toBe(1);
  });
  it("the kitchen rows use their own class, 13 px", () => {
    expect(read("screens/AdminMenu.tsx")).not.toContain("ui-dish-price");
    expect(css).toMatch(/\.ui-krow-price\s*\{[^}]*font-size:\s*13px/);
  });
});
