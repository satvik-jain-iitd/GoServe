// Story 1442 (boards PD1, PD2, PD3, canvas row 2cg): the rider sees his past days, so a question about yesterday's cash has one answer.
// PD1: older cash not handed over shows on top of Today on its own line; "Pichhle din" is the last row (hidden when the admin number is 0).
// PD2: one row a day that had a delivery: the date, N delivery, Cash, then "Jama ho gaya" or "Baaki". PD3: one day's tally, no names, no address.
// Admin Numbers, block "Rider app": "Past days", 0 to 30, starts at 7.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m, 0);
const ID = (n: number) => `${String(n).padStart(2, "0").repeat(4)}-1111-4222-8333-444444444444`;
const del = (n: number, d: number, h: number, paid: "cash" | "upi_door", paise: number, handed = true) =>
  ({ ...order("delivered", at(d, h, 0).toISOString(), at(d, h - 1, 30).toISOString()), id: ID(n), rider_id: SESSION, kitchen_id: "k-1", delivered_at: at(d, h, 0).toISOString(), paid_by: paid, total_paise: paise, customer_name: "Rahul Verma", address: "Flat 4, Green Park", cash_handed_at: paid === "cash" && handed ? at(d, 23, 0).toISOString() : null });
// 11 Nov: two deliveries, cash handed. 12 Nov: three, one cash of ₹420 never handed. 13 Nov: one UPI. Today 14 Nov: one cash.
const ORDERS = [del(1, 11, 13, "cash", 30000), del(2, 11, 20, "upi_door", 20000), del(3, 12, 13, "cash", 42000, false), del(4, 12, 19, "cash", 28000), del(5, 12, 20, "upi_door", 31000), del(6, 13, 14, "upi_door", 25000), del(7, 14, 12, "cash", 34000, false)];

const today = async (context: BrowserContext, page: Page, days: number | "fail", orders = ORDERS) => {
  await page.clock.install({ time: at(14, 15, 0) });
  const net = await setup(context, page, orders);
  if (days === "fail") net.state.pastDaysFail = true; else net.state.pastDays = days;
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("cash")).toContainText("₹340");
  return net;
};
const pastRow = (page: Page) => page.getByRole("button", { name: /^Pichhle din/ });

test("PD2a given deliveries on three earlier days and the number 7, Pichhle din lists three days, each with its count and its cash", async ({ page, context }) => {
  await today(context, page, 7);
  await pastRow(page).click();
  await expect(page.getByRole("heading", { name: "Pichhle din" })).toBeVisible();
  const days = page.getByTestId("past-day");
  await expect(days).toHaveCount(3);
  await expect(days.nth(0)).toContainText("Fri, 13 Nov");
  await expect(days.nth(0)).toContainText("1 delivery");
  await expect(days.nth(0)).toContainText("Cash ₹0");
  await expect(days.nth(0)).toContainText("Jama ho gaya");
  await expect(days.nth(1)).toContainText("Thu, 12 Nov");
  await expect(days.nth(1)).toContainText("3 delivery");
  await expect(days.nth(1)).toContainText("Cash ₹700");
  await expect(days.nth(1)).toContainText("Baaki ₹420");
  await expect(days.nth(2)).toContainText("Wed, 11 Nov");
  await expect(days.nth(2)).toContainText("2 delivery");
  await expect(days.nth(2)).toContainText("Cash ₹300");
  await expect(days.nth(2)).toContainText("Jama ho gaya");
});

test("PD2b the number 2 lists only the last two days", async ({ page, context }) => {
  await today(context, page, 2);
  await pastRow(page).click();
  await expect(page.getByTestId("past-day")).toHaveCount(2);
  await expect(page.getByText("Wed, 11 Nov")).toHaveCount(0);
});

test("PD1a given cash of an earlier day not handed over, Today shows it on its own line, and the kitchen shows the same amount for him", async ({ page, context }) => {
  await today(context, page, 7);
  const line = page.getByTestId("older-cash");
  await expect(line).toContainText("Purana cash baaki");
  await expect(line).toContainText("12 Nov ka · kitchen me jama karein");
  await expect(line).toContainText("₹420");
  await expect(page.getByTestId("cash")).toContainText("₹340");   // today's cash stays today's
  const first = (await page.locator(".ui-today > *").first().getAttribute("data-testid"));
  expect(first).toBe("older-cash");   // on top
  const net = await setup(context, page, ORDERS);   // the kitchen, the same orders
  net.state.kitchen = "k-1";
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: null, online: true, lat: null, lng: null };
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator(".ui-row", { hasText: "Amit Kumar" })).toContainText("older: ₹420");
});

test("PD1b no older cash due: no older line", async ({ page, context }) => {
  await today(context, page, 7, ORDERS.map((o) => ({ ...o, cash_handed_at: o.paid_by === "cash" ? at(14, 1, 0).toISOString() : null })).slice(0, 6).concat([ORDERS[6]]));
  await expect(page.getByTestId("older-cash")).toHaveCount(0);
});

test("PD1c given the number 0, the Pichhle din row does not show", async ({ page, context }) => {
  await today(context, page, 0);
  await expect(pastRow(page)).toHaveCount(0);
});

test("PD1d Pichhle din is the last row of Today", async ({ page, context }) => {
  await today(context, page, 7);
  const rows = page.locator(".ui-today > .ui-row");
  await expect(rows.last()).toHaveAccessibleName(/^Pichhle din/);
});

test("PD3a given a past day is open, it shows the tally with no customer name and no address, and the cash rows add up to the cash on top", async ({ page, context }) => {
  await today(context, page, 7);
  await pastRow(page).click();
  await page.getByTestId("past-day").nth(1).click();
  await expect(page.getByRole("heading", { name: "Thu, 12 Nov" })).toBeVisible();
  const top = page.getByTestId("past-cash");
  await expect(top).toContainText("₹700");
  await expect(top).toContainText("Baaki ₹420 · kitchen me jama karein");
  const rows = page.getByTestId("past-order");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("No. 05050505");
  await expect(rows.nth(0)).toContainText("20:00");
  await expect(rows.nth(0)).toContainText("₹310");
  await expect(rows.nth(0)).toContainText("UPI");
  for (const t of ["Rahul", "Green Park", "Flat 4"]) await expect(page.getByText(t)).toHaveCount(0);
  await expect(rows.first().locator(".go")).toHaveCount(0);   // a past order does not open
  const cash = await rows.filter({ hasText: "Cash" }).allTextContents();
  const sum = cash.map((t) => Number(/₹([\d,]+)/.exec(t)![1].replace(/,/g, ""))).reduce((a, b) => a + b, 0);
  expect(sum).toBe(700);
});

test("PD3b Back from a day returns to the list, and Back again to Today", async ({ page, context }) => {
  await today(context, page, 7);
  await pastRow(page).click();
  await page.getByTestId("past-day").nth(0).click();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Pichhle din" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Today" }).click();
  await expect(page.getByTestId("cash")).toBeVisible();
});

test("PD2c the number cannot be read: the list says it could not load, with Try again, never an empty list", async ({ page, context }) => {
  const net = await today(context, page, "fail");
  await pastRow(page).click();
  await expect(page.getByRole("alert")).toContainText("Could not load the past days.");
  await expect(page.getByTestId("past-day")).toHaveCount(0);
  net.state.pastDaysFail = false; net.state.pastDays = 7;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("past-day")).toHaveCount(3);
});

test("AR1d the admin sets Past days: minus and plus in steps of 1, 0 to 30, starts at 7", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  const block = page.getByRole("region", { name: "Rider app" });
  await expect(block.getByTestId("past-days")).toHaveText("7");
  await block.getByRole("button", { name: "Fewer past days" }).click();
  await expect(block.getByTestId("past-days")).toHaveText("6");
  expect(net.state.pastDaysSets).toEqual([6]);
  net.state.pastDays = 0;
  await page.reload();
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(block.getByRole("button", { name: "Fewer past days" })).toBeDisabled();
});

test("AR1e the row says 'Past days on Today' with '0 means today only', and sits above Incentive", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  const block = page.getByRole("region", { name: "Rider app" });
  const rows = block.locator(".ui-row");
  await expect(rows.first()).toContainText("Past days on Today");
  await expect(rows.first()).toContainText("0 means today only");
  await expect(rows.nth(1)).toContainText("Incentive");
});

test("AR1f 'Last changed by' shows the newer change of the block: the Past days change when it is the later one, and 'you' right after a change", async ({ page, context }) => {
  const net = await setup(context, page);   // the mock: Past days changed 14 Nov, the incentive 13 Nov
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  const block = page.getByRole("region", { name: "Rider app" });
  await expect(block.getByText(/^Last changed by owner@goserve\.test, 14 Nov/)).toBeVisible();
  await block.getByRole("button", { name: "More past days" }).click();
  await expect(block.getByTestId("past-days")).toHaveText("8");
  await expect(block.getByText(/^Last changed by you, /)).toBeVisible();
});
