// Story #1123 (found by the owner on Android Chrome, 9 Nov): the tagline under the logo ran past the right edge and the page scrolled sideways.
// Cause: white-space: nowrap with a font that grows with Android's text size. Expected: no sideways scroll at any width or text size; a long line wraps under the logo.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

for (const [name, guest] of [["welcome (Google only)", true], ["welcome with the phone number", false]] as const) {
  test(`S1 ${name}: at 360 px with large text the page does not scroll sideways`, async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setup(context, page, [], { guest, pin: null });
    if (!guest) await page.addInitScript(() => localStorage.setItem("gs-otp-gate", "1"));
    await page.goto("/customer/");
    await expect(page.getByText("Hot meals from our kitchen for you in 20 mins")).toBeVisible();
    await page.addStyleTag({ content: ".ui-kicker, .ui-welcome-kicker { font-size: 17px !important; }" });   // what Android's text size does to the line: bigger letters, same words
    const w = await page.evaluate(() => {
      const k = [...document.querySelectorAll<HTMLElement>(".ui-kicker, .ui-welcome-kicker")].find((e) => /Hot meals/.test(e.textContent ?? ""))!;
      return { scroll: document.scrollingElement!.scrollWidth, client: document.scrollingElement!.clientWidth, textWide: k.scrollWidth, boxWide: k.clientWidth };
    });
    expect(w.scroll).toBe(w.client);   // the page itself
    expect(w.textWide).toBeLessThanOrEqual(w.boxWide);   // and the line inside its box: the box may not hide the overflow either
  });
}
