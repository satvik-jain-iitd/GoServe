// Stories 1443 and 1438 (boards TI1 and AR1; owner, 13 Nov 2026): "incentive wala daalo pr admin settings me bhi jaana chahiye enable disable and adjust krne ka".
// Rider Today: under the cash row, "Aaj ka incentive", the amount, and "<N> delivery × ₹<amount> · salary ke saath milega". Never part of "Cash aapke paas".
// Admin Numbers, block "Rider app": the Incentive switch, and "For each delivery" (minus, the amount, plus; steps of ₹5, ₹5 to ₹100) only while it is on.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const done = (i: number, s: number) => ({ ...order("delivered", ago(s), ago(s)), id: `0${i}0${i}0${i}0${i}-1111-4222-8333-444444444444`, rider_id: SESSION, paid_by: "cash", total_paise: 10000 });
const FOUR = [done(1, 50), done(2, 40), done(3, 30), done(4, 20)];
const rider = async (context: BrowserContext, page: Page, incentive: object) => {
  const net = await setup(context, page, FOUR);
  net.state.incentive = incentive as typeof net.state.incentive;
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("cash")).toContainText("₹400");
  return net;
};
const row = (page: Page) => page.getByTestId("incentive");

test("TI1a the incentive is on at ₹10 and 4 deliveries today: Aaj ka incentive ₹40 and 4 delivery × ₹10", async ({ page, context }) => {
  await rider(context, page, { on: true, amount_paise: 1000, log: [{ at: ago(120), on: true, amount_paise: 1000 }] });
  await expect(row(page)).toContainText("Aaj ka incentive");
  await expect(row(page)).toContainText("4 delivery × ₹10 · salary ke saath milega");
  await expect(row(page)).toContainText("₹40");
  await expect(page.getByTestId("cash")).toContainText("₹400");   // never added to the cash he holds
});

test("TI1b the incentive is off: no incentive row, and Cash aapke paas is the same", async ({ page, context }) => {
  await rider(context, page, { on: false, amount_paise: 1000, log: [{ at: ago(120), on: false, amount_paise: 1000 }] });
  await expect(row(page)).toHaveCount(0);
  await expect(page.getByText("Aaj ka incentive")).toHaveCount(0);
});

test("TI1c the admin changes the amount between deliveries: earlier ones at the old amount, later ones at the new", async ({ page, context }) => {
  await rider(context, page, { on: true, amount_paise: 2000, log: [{ at: ago(120), on: true, amount_paise: 1000 }, { at: ago(35), on: true, amount_paise: 2000 }] });
  await expect(row(page)).toContainText("₹60");   // 2 × ₹10 + 2 × ₹20
  await expect(row(page)).toContainText("4 delivery · salary ke saath milega");
});

const admin = async (context: BrowserContext, page: Page, on = false) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.incentive = { on, amount_paise: 1000, log: [] };
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rider app" })).toBeVisible();
  return net;
};
const sw = (page: Page) => page.getByRole("switch", { name: /^Incentive/ });

test("AR1a off: the switch is off and For each delivery is not shown; turning it on saves on at ₹10 and shows the amount", async ({ page, context }) => {
  const net = await admin(context, page);
  await expect(sw(page)).not.toBeChecked();
  await expect(page.getByText("For each delivery")).toHaveCount(0);
  await sw(page).click();
  await expect(sw(page)).toBeChecked();
  await expect(page.getByTestId("incentive-amount")).toHaveText("₹10");
  expect(net.state.incentiveSets).toEqual([{ p_on: true, p_amount_paise: 1000 }]);
  await expect(page.getByRole("region", { name: "Rider app" }).getByText(/^Last changed by you, /)).toBeVisible();
});

test("AR1b More and Less step by ₹5 and save each time; Less is off at ₹5 and More at ₹100", async ({ page, context }) => {
  const net = await admin(context, page, true);
  await page.getByRole("button", { name: "More incentive" }).click();
  await expect(page.getByTestId("incentive-amount")).toHaveText("₹15");
  await page.getByRole("button", { name: "Less incentive" }).click();
  await page.getByRole("button", { name: "Less incentive" }).click();
  await expect(page.getByTestId("incentive-amount")).toHaveText("₹5");
  await expect(page.getByRole("button", { name: "Less incentive" })).toBeDisabled();
  expect(net.state.incentiveSets.map((s) => s.p_amount_paise)).toEqual([1500, 1000, 500]);
});

test("AR1c a save that fails says so and the switch goes back", async ({ page, context }) => {
  const net = await admin(context, page);
  net.state.incentiveFail = true;
  await sw(page).click();
  await expect(page.getByRole("alert")).toContainText("Could not save. Try again.");
  await expect(sw(page)).not.toBeChecked();
});
