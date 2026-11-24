// Story 1832 (epic 1831): bottom tabs Orders, City, Numbers, Settings; Numbers keeps only the numbers; Settings is ten rows, each with its state and its own screen.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const ROWS = ["Payment methods", "Offers", "Fees and discounts", "Rider app", "Login", "Hand-over codes", "Support", "Rider rules", "Simulator", "Send feedback"];

for (const width of [360, 390]) {
  test(`T1 four equal tabs at ${width}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    const net = await setup(context, page); net.state.admin = true;
    await page.goto("/admin/");
    const tabs = page.getByRole("navigation", { name: "Main" }).getByRole("button");
    await expect(tabs).toHaveText([/Orders/, /City/, /Numbers/, /Settings/]);
    const w = await tabs.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(Math.max(...w) - Math.min(...w)).toBeLessThanOrEqual(1);
  });
}

test("T2 Numbers has no setting control", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByTestId("tile-orders")).toBeVisible();
  for (const label of ["Payment methods", "Early friend offer", "Rider app", "Login", "Handover codes", "Support", "Decisions", "Send feedback", "Delivery fee"]) await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
});

test("T3 Settings lists ten rows in order with state lines; a row opens, Back and the phone's Back return", async ({ page, context }) => {
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const rows = page.locator(".ui-pad > button.ui-row");
  await expect(rows).toHaveCount(10);
  for (let i = 0; i < ROWS.length; i++) await expect(rows.nth(i).locator("b")).toHaveText(ROWS[i]);
  await expect(rows.nth(0)).toContainText("Cash and UPI at the door are on");
  await expect(rows.nth(1)).toContainText("Early friend offer is off");
  await expect(rows.nth(4)).toContainText("Phone code login is off");
  await rows.nth(0).click();
  await expect(page.getByRole("heading", { name: "Payment methods" })).toHaveCount(1);   // the screen head names it; the group title is hidden
  await page.getByRole("button", { name: "Back to settings" }).click();
  await expect(rows).toHaveCount(10);
  await rows.nth(4).click();
  await expect(page.getByRole("switch", { name: /Phone code login/ })).toBeVisible();
  await page.goBack();
  await expect(rows).toHaveCount(10);
});

test("T4 (AC-5) Back and the phone's Back return to the Settings list at the same scroll place; Rider rules prints no made-up line", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const rows = page.locator(".ui-pad > button.ui-row");
  await expect(rows.nth(0)).toContainText("Cash and UPI at the door are on");
  await expect(rows.nth(7)).not.toContainText("Free rider");
  const top = () => page.locator(".ui-scroll").evaluate((e) => e.scrollTop);
  await page.locator(".ui-scroll").evaluate((e) => { e.scrollTop = 150; });
  const before = await top();
  expect(before).toBeGreaterThan(50);
  await rows.nth(5).evaluate((e) => (e as HTMLElement).click());   // a finger tap: no scroll-into-view of its own
  await page.getByRole("button", { name: "Back to settings" }).click();
  await expect(rows).toHaveCount(10);
  expect(await top()).toBe(before);
  await rows.nth(5).evaluate((e) => (e as HTMLElement).click());   // a finger tap: no scroll-into-view of its own
  await page.goBack();
  await expect(rows).toHaveCount(10);
  expect(await top()).toBe(before);
});
