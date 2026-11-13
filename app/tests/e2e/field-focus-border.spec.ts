// Story 1397 (owner, 13 Nov 2026, DECIDED, board FF2-FieldBorder): a tapped text field has no ring. Its own border turns --md-primary
// and grows from 1 px to 2 px, the box keeps its height, and the text does not move. Measured in Chromium with the app's real CSS,
// because the cascade (which rule wins) cannot be read from the CSS text.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const HERE = new URL(".", import.meta.url).pathname;

const css = ["src/styles/tokens.css", "src/styles/app.css", "src/ui/ui.css"]
  .map((f) => readFileSync(resolve(HERE, "../..", f), "utf8"))
  .join("\n");

// [name, markup, id of the element that is focused, id of the element whose border must change]
const CASES: [string, string, string, string][] = [
  ["House (ui-eg in a field)", `<div class="ui-field"><label>House</label><input id="t" class="ui-eg" type="text"></div>`, "t", "t"],
  ["field input", `<div class="ui-field"><input id="t" type="text"></div>`, "t", "t"],
  ["form input", `<div class="ui-form"><input id="t" type="text"></div>`, "t", "t"],
  ["form textarea", `<div class="ui-form"><textarea id="t"></textarea></div>`, "t", "t"],
  ["OTP phone input", `<div class="ui-form"><div class="otp-phone"><input id="t" type="tel"></div></div>`, "t", "t"],
  ["select", `<div class="ui-field"><select id="t"><option>one</option></select></div>`, "t", "t"],
  ["sheet textarea", `<textarea id="t" class="ui-sheet-text"></textarea>`, "t", "t"],
  ["search input", `<input id="t" class="ui-search" type="search">`, "t", "t"],
  ["PIN input", `<input id="t" class="ui-pin-input" type="tel">`, "t", "t"],
  ["search box (the box has the border)", `<div id="t" class="ui-search-box"><input id="i" type="search"></div>`, "i", "t"],
];

async function measure(page: Page, id: string) {
  return page.evaluate((id) => {
    const el = document.getElementById(id) as HTMLElement;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      border: s.borderTopWidth,
      color: s.borderTopColor,
      outline: s.outlineStyle,
      height: Math.round(r.height * 100) / 100,
      textLeft: Math.round((r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft)) * 100) / 100,
    };
  }, id);
}

test.describe("a tapped text field shows its own green border, no ring (story 1397)", () => {
  for (const [name, markup, focusId, edgeId] of CASES) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.setContent(`<!doctype html><html data-theme="day"><head><meta name="viewport" content="width=device-width"></head><body>${markup}</body></html>`);
      await page.addStyleTag({ content: css });
      const primary = await page.evaluate(() => {
        const p = document.createElement("div");
        p.style.color = "var(--md-primary)";
        document.body.appendChild(p);
        return getComputedStyle(p).color;
      });

      const before = await measure(page, edgeId);
      await page.focus(`#${focusId}`);
      await page.keyboard.press("Shift");   // a real keyboard focus, so :focus-visible applies
      const after = await measure(page, edgeId);

      expect(after.border, "border width when tapped").toBe("2px");
      expect(after.color, "border colour when tapped").toBe(primary);
      expect(after.outline, "no ring when tapped").toBe("none");
      expect(after.height, "the box keeps its height").toBe(before.height);
      expect(after.textLeft, "the text does not move").toBe(before.textLeft);
    });
  }
});
