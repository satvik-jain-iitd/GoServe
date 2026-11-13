// Story 1397 (owner, 13 Nov 2026, DECIDED, board FF2-FieldBorder): a tapped text field has no ring.
// Its own border turns --md-primary and grows from 1 px to 2 px; the text does not move.
// Buttons, chips, switches and links keep their ring (out of scope here).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ui = readFileSync(resolve(__dirname, "../../src/ui/ui.css"), "utf8");
const app = readFileSync(resolve(__dirname, "../../src/styles/app.css"), "utf8");
const all = ui + "\n" + app;

// Every rule whose selector targets a focused text field.
const FIELD = /(^|,|\s)(input|textarea|select|\.ui-search(?![-\w])|\.ui-pin-input)\b[^{]*:focus-visible/;
function fieldFocusRules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    // checkboxes, radios and switches keep their ring (out of scope)
    if (FIELD.test(selector) && !/checkbox|radio|switch/.test(selector)) out.push({ selector, body: m[2] });
  }
  return out;
}

describe("a tapped text field (story 1397, board FF2)", () => {
  const rules = fieldFocusRules(all);

  it("has focus rules for the text fields", () => {
    expect(rules.length, "no :focus-visible rule covers text fields").toBeGreaterThan(0);
  });

  it("shows no outline ring on any text field", () => {
    const ringed = rules.filter((r) => {
      const v = r.body.match(/outline:\s*([^;]+);/)?.[1].trim();
      return v !== undefined && v !== "none" && v !== "0";
    });
    expect(ringed.map((r) => r.selector), "these text fields still draw a ring").toEqual([]);
  });

  it("the search box draws no ring around the field either", () => {
    const box = all.match(/\.ui-search-box:focus-within\s*\{([^}]*)\}/);
    const v = box?.[1].match(/outline:\s*([^;]+);/)?.[1].trim();
    expect(v === undefined || v === "none" || v === "0", "the search box still draws a ring").toBe(true);
  });

  it("turns its own border --md-primary at 2 px", () => {
    const edge = rules.find(
      (r) => /border(-color)?:[^;]*var\(--md-primary\)/.test(r.body) && /(border-width:\s*2px|border:\s*2px)/.test(r.body),
    );
    expect(edge, "no focus rule gives a 2 px --md-primary border").toBeDefined();
  });

  it("takes the 1 px off the padding so the text does not move", () => {
    const edge = rules.find((r) => /border-width:\s*2px|border:\s*2px/.test(r.body));
    expect(edge, "no focus rule with the 2 px border").toBeDefined();
    expect(edge!.body, "the focus rule must lower the padding by 1 px").toMatch(/padding/);
  });
});
