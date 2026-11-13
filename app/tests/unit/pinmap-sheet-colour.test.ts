// Story #1395 (owner, 13 Nov 2026, on his phone): the address sheet's fields were cream on a white sheet. The approved board C7a draws the
// sheet and its fields in one colour. The sheet takes the colour its fields draw (--md-surface), so the fields read as outlined boxes.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../src/ui/ui.css"), "utf8");
const sheet = css.match(/\.ui-pinmap-details\s*\{([^}]*)\}/);

describe("the address details sheet (.ui-pinmap-details)", () => {
  it("is drawn in the same colour as its fields (--md-surface), as on board C7a", () => {
    expect(sheet, "the .ui-pinmap-details rule is missing").not.toBeNull();
    const bg = sheet![1].match(/background:\s*([^;]+);/);
    expect(bg?.[1].trim()).toBe("var(--md-surface)");
  });
});
