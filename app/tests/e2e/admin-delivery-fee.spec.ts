// Story 1756 (epic 1753, frame fee-frames.png): the admin types the delivery fee in rupees on the Numbers tab, first row of Settings, above the Sold-out swap discount.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, openSetting } from "./helpers";

async function toNumbers(page: Page, context: BrowserContext, fee = 2000) {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.feePaise = fee;
  await page.goto("/admin/");
  await openSetting(page, "Fees and discounts");
  return net;
}
const field = (page: Page) => page.getByLabel("Delivery fee, rupees");
const save = (page: Page) => page.getByRole("button", { name: "Save delivery fee" });
const sets = (net: Awaited<ReturnType<typeof setup>>) => net.calls.rpc.filter((c) => c.name === "delivery_fee_set_v1").map((c) => c.body);

test("AC-1 the row shows the saved fee, its words and who set it when the tab opens", async ({ page, context }) => {
  await toNumbers(page, context);
  await expect(page.getByText("Delivery fee", { exact: true })).toBeVisible();
  await expect(page.getByText("Rupees on every order · 0 to 200", { exact: true })).toBeVisible();
  await expect(field(page)).toHaveValue("20");
  await expect(page.getByText(/^Now ₹20 · set by owner@goserve.test, /)).toBeVisible();
});

test("AC-2 type 20 and tap Save: the function is called once with 2000 and the line says Now ₹20 set by you", async ({ page, context }) => {
  const net = await toNumbers(page, context, 0);
  await expect(field(page)).toHaveValue("0");
  await field(page).fill("20");
  await save(page).click();
  await expect(page.getByText(/^Now ₹20 · set by you, /)).toBeVisible();
  expect(sets(net)).toEqual([{ p_amount_paise: 2000 }]);
});

test("AC-3 a bad number shows the words and sends nothing; a failed save shows the try-again line and the field goes back to the saved value", async ({ page, context }) => {
  const net = await toNumbers(page, context);
  await field(page).fill("250");
  await save(page).click();
  await expect(page.getByRole("alert")).toHaveText("Type 0 to 200 rupees.");
  await field(page).fill("1.5");
  await save(page).click();
  await expect(page.getByRole("alert")).toHaveText("Type 0 to 200 rupees.");
  expect(sets(net)).toEqual([]);
  await field(page).fill("30");
  net.state.feeFail = true;
  await save(page).click();
  await expect(page.getByRole("alert")).toHaveText("Could not save. Try again.");
  await expect(field(page)).toHaveValue("20");
  await expect(page.getByText(/^Now ₹20 · set by owner@goserve.test, /)).toBeVisible();
});

test("AC-3 a server refusal shows the server's own line and the field goes back", async ({ page, context }) => {
  const net = await toNumbers(page, context);
  await context.route("**/rest/v1/rpc/delivery_fee_set_v1", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "invalid_amount", message: "Type 0 to 200 rupees." }) }));
  await field(page).fill("30");
  await save(page).click();
  await expect(page.getByRole("alert")).toHaveText("Type 0 to 200 rupees.");
  await expect(field(page)).toHaveValue("20");
  expect(net.state.feePaise).toBe(2000);
});

test("a save of the same value shows no error and the line stays", async ({ page, context }) => {
  const net = await toNumbers(page, context);
  await save(page).click();
  await expect(page.getByText(/^Now ₹20 · /)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(sets(net)).toEqual([{ p_amount_paise: 2000 }]);
});

test("the Save button says only the action: no number in it", async ({ page, context }) => {
  await toNumbers(page, context);
  await expect(save(page)).toHaveText("Save");
});

for (const [w, h] of [[412, 915], [360, 640]]) {
  test(`AC-4 and AC-5 the swap row keeps its box and only moves down by the new row; the field text is 16 px or more and Save is 44 px or more (${w}x${h})`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await toNumbers(page, context);
    const box = (l: ReturnType<Page["locator"]>) => l.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const feeRow = page.locator(".ui-row-static", { has: field(page) }), swapRow = page.locator(".ui-row-static", { has: page.getByLabel("Sold-out swap discount, percent") });
    const [a, b] = [await box(feeRow), await box(swapRow)];
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(0.5);   // the same box width
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.h);   // the swap row sits below the fee row (its foot line is between)
    const swapPct = await box(page.getByLabel("Sold-out swap discount, percent"));
    expect([swapPct.w, swapPct.h >= 44]).toEqual([64, true]);   // the swap row's own field keeps the size it had
    expect((await box(save(page))).h).toBeGreaterThanOrEqual(44);
    expect(await field(page).evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const headBefore = await box(page.getByRole("heading", { name: "Fees and discounts" }));
    const feeBox = await box(feeRow);
    expect(feeBox.y).toBeGreaterThan(headBefore.y);   // the new row is the first row under the Settings heading
    expect(feeBox.y - (headBefore.y + headBefore.h)).toBeLessThan(b.y - feeBox.y);
  });
}

test("the phone's Back button leaves the Numbers tab as it did before the new row", async ({ page, context }) => {
  await toNumbers(page, context);
  await expect(field(page)).toBeVisible();
  await page.goBack();
  await expect(field(page)).toHaveCount(0);
});
