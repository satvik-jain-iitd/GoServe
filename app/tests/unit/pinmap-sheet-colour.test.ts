// Story #1395 (owner, 13 Nov 2026, DECIDED): the address sheet stays white (--gs-raised). Its House and Landmark fields are white too,
// with only their border, as on board C7s-PinDetailsStep3. No cream boxes.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../src/ui/ui.css"), "utf8");
const sheet = css.match(/\.ui-pinmap-details\s*\{([^}]*)\}/);
const fieldRule = css.match(/\.ui-pinmap-details\s+\.ui-field\s+(?:input|textarea)[^{]*\{([^}]*)\}/);

describe("the address details sheet (.ui-pinmap-details)", () => {
  it("is white (--gs-raised), as the owner decided", () => {
    expect(sheet, "the .ui-pinmap-details rule is missing").not.toBeNull();
    const bg = sheet![1].match(/background:\s*([^;]+);/);
    expect(bg?.[1].trim()).toBe("var(--gs-raised)");
  });
  it("its fields are white too, so only the border shows", () => {
    expect(fieldRule, "no rule makes the sheet's fields white").not.toBeNull();
    const bg = fieldRule![1].match(/background:\s*([^;]+);/);
    expect(bg?.[1].trim()).toBe("var(--gs-raised)");
  });
});
