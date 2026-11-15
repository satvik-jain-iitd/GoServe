// Story 1557: a long delivery address made the rider's Pick up card wider than the phone, and the page scrolled sideways.
// Every screen that shows an order's address is measured in a real browser, 360 and 390 px wide, with two long sample addresses.
import { test, expect } from "@playwright/test";
import { ID, order, placeAt, setup } from "./helpers";
import { LONG, WIDTHS, expectInside, expectNoSideScroll, riderLongAddress } from "./longAddress";

riderLongAddress();

const NOW = new Date().toISOString();

for (const width of WIDTHS) for (const a of LONG) {
  const at = `${width}px, ${a.name}`;

  test(`admin Order, ${at}: the address stays inside the slip`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 780 });
    const net = await setup(context, page, [{ ...order("placed"), kitchen_id: "k-1", customer_name: "Sample Customer", customer_phone: "9876543210", cancel_reason: null, address: a.text }]);
    net.state.admin = true;
    await page.goto("/admin/");
    await expectNoSideScroll(page, `admin Orders list ${at}`);
    await page.getByRole("button", { name: new RegExp(`^Open order ${ID.slice(0, 8)}`) }).click();
    await expect(page.locator(".ui-addr")).toHaveText(a.text);
    await expectNoSideScroll(page, `admin Order ${at}`);
    await expectInside(page, ".ui-addr", ".ui-slip", `admin Order ${at}`);
    await expectInside(page, ".ui-slip-total span", ".ui-slip", `admin Order ${at}`);
  });

  test(`customer tracker, ${at}: the address stays inside the slip`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 780 });
    await setup(context, page, [{ ...order("preparing", NOW, NOW), address: a.text }]);
    await page.goto("/customer/");
    await expect(page.locator(".ui-addr")).toHaveText(a.text);
    await expectNoSideScroll(page, `tracker ${at}`);
    await expectInside(page, ".ui-addr", ".ui-slip", `tracker ${at}`);
  });

  test(`customer Bill, ${at}: the Deliver to row keeps Change on the screen`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 780 });
    // The phone already holds a place with the long words (before setup, which writes its own only when none is there).
    await context.addInitScript((p) => { try { window.localStorage.setItem("gs-pin", p.pin); window.localStorage.setItem("gs-place", JSON.stringify(p)); } catch { /* blocked */ } }, placeAt("110016", a.text));
    await setup(context, page);
    await page.goto("/customer/");
    await expectNoSideScroll(page, `menu ${at}`);   // the home top shows the same words on one line
    await page.getByRole("button", { name: "Add Butter Chicken" }).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    const row = page.getByRole("group", { name: "Deliver to" });
    await expect(row).toContainText(a.text);
    await expectNoSideScroll(page, `Bill ${at}`);
    const change = (await row.getByRole("button", { name: "Change address" }).boundingBox())!;
    expect(change.x + change.width, `Bill ${at}: Change ends at ${change.x + change.width}px`).toBeLessThanOrEqual(width);
  });
}
