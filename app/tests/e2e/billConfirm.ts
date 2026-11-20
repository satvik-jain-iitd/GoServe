// Story 1574: on the Bill, when only the map point is missing, the bottom bar is the main button "Confirm on the map ›". A tap opens the pin map on the place;
// after Confirm the Bill's bar reads "Place order ›". The bar keeps its box in both states and nothing else moves (owner's rule 23, by measure). The outline button
// under the address and the grey line are gone. Run by Chromium (bill-confirm.spec.ts) and by WebKit (bill-confirm.webkit.spec.ts).
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const RAW = { address: "Where you are now", pin: "110016", lat: 28.5677, lng: 77.2432, house: "", landmark: "", confirmed: false, id: null };   // a raw phone fix: words and a point, but not set on the map
const GREEN_PARK = { ok: true, address: "Green Park, New Delhi, Delhi", pin: "110016", locality: "Green Park", town: "New Delhi" };
const bar = (page: Page) => page.locator(".ui-sticky .ui-btn");
// The bar and what could move with it, by measure in the browser.
const boxes = (page: Page) => page.evaluate(() => {
  const r = (el: Element | null) => { const b = el!.getBoundingClientRect(); return `${Math.round(b.width * 10) / 10}x${Math.round(b.height * 10) / 10} at ${Math.round(b.x * 10) / 10},${Math.round(b.y * 10) / 10}`; };
  return { sticky: r(document.querySelector(".ui-sticky")), bar: r(document.querySelector(".ui-sticky .ui-btn")), placeH: document.querySelector("[role=group][aria-label='Serving at']")!.getBoundingClientRect().height, scroll: document.querySelector(".ui-scroll")!.scrollHeight, page: document.documentElement.scrollHeight };
});

export function billConfirm() {
  for (const [width, height] of [[360, 640], [390, 844]]) {
    test(`The bar says what is missing, phone first, then the map, then Place order, in the same box in every state (${width}x${height})`, async ({ page, context }) => {
      await page.setViewportSize({ width, height });
      const net = await setup(context, page, [], { pin: null });
      net.state.geocode = { status: 200, body: GREEN_PARK };
      await context.route("https://tiles.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
      await context.addInitScript((p) => { if (window.localStorage.getItem("gs-place")) return; window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", "110016"); }, RAW);
      await page.goto("/customer/");
      await page.getByRole("button", { name: "Add Butter Chicken" }).click();
      await page.getByRole("button", { name: /View bill/ }).click();
      const none = async () => { await expect(page.getByRole("status")).toHaveCount(0); await expect(page.locator(".ui-reason")).toHaveCount(0); };   // no grey line, ever
      // 1 phone missing
      await expect(bar(page)).toContainText("Add your phone number ›");
      await expect(bar(page)).toBeEnabled();
      await none();
      const missing = await boxes(page);
      await bar(page).click();   // a tap puts the cursor in the phone field
      await expect(page.getByLabel("Phone")).toBeFocused();
      // 2 phone wrong
      await page.getByLabel("Phone").fill("987654321");
      await expect(bar(page)).toContainText("Check your phone number ›");
      await none();
      const wrong = await boxes(page);
      await page.getByLabel("Phone").fill("1234567890");   // ten digits, not a mobile
      await expect(bar(page)).toContainText("Check your phone number ›");
      await none();
      // 3 map missing
      await page.getByLabel("Phone").fill("9876543210");
      await expect(bar(page)).toContainText("Confirm on the map ›");
      await expect(bar(page)).toBeEnabled();
      await expect(page.getByRole("button", { name: "Confirm on the map" })).toHaveCount(1);   // the bar only: no outline button under the address
      await none();
      const map = await boxes(page);
      await bar(page).click();
      await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
      await page.getByRole("button", { name: "Confirm & proceed" }).click();
      await page.getByLabel("House, street, colony, ward").fill("B-12, ground floor");
      await page.getByRole("button", { name: "Save address" }).click();
      await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
      // 4 ready
      await expect(bar(page)).toContainText("Place order ›");
      await expect(bar(page)).toBeEnabled();
      await none();
      const ready = await boxes(page);
      for (const [name, b] of Object.entries({ wrong, map, ready })) {   // rule 23: the bar is one box in all four states
        expect(b.bar, `bar, ${name}`).toBe(missing.bar);
        expect(b.sticky, `sticky, ${name}`).toBe(missing.sticky);
      }
      expect(ready.page).toBe(missing.page);
      const grew = ready.placeH - map.placeH;   // the one thing that may differ: the place's words carry the house line
      expect(ready.scroll - map.scroll - grew).toBeLessThanOrEqual(1);   // the bar adds no scroll
      console.log(`${width}x${height} ${missing.bar} | ${missing.sticky}`);
      await bar(page).click();
      await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
      expect(net.calls.place).toHaveLength(1);
    });
  }
}
