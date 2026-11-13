// Regression: the early-friend offer (board A14-EarlyFriend, story #1329) and the placed slip lines that add up (story #1295). Rows also in docs/tests/test-cases.md.
import { test, expect, type Page, type BrowserContext, type Locator } from "@playwright/test";
import { SESSION, order, setup, typePlace } from "../helpers";

const rupees = (t: string) => Number(t.replace(/[₹,\s]/g, "").replace("−", "-"));
const sum = async (lines: Locator) => (await lines.locator(":scope > div span:last-child").allTextContents()).reduce((n, t) => n + rupees(t), 0);
test.use({ viewport: { width: 412, height: 915 } });
const admin = async (page: Page, context: BrowserContext, over: Record<string, unknown> = {}) => {
  const net = await setup(context, page);
  net.state.admin = true;
  Object.assign(net.state, over);
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Early friend offer" })).toBeVisible();
  return net;
};

test("TC A14.1 Look: the offer is off by default, the amount is 100, who set it last", async ({ page, context }) => {
  await admin(page, context);
  await expect(page.getByRole("switch", { name: /^Give the early friend offer/ })).not.toBeChecked();
  await expect(page.getByLabel("Early friend amount, rupees")).toHaveValue("100");
  await expect(page.getByText("Now off · set by owner@goserve.test, 10 Nov")).toBeVisible();
});

test("TC A14.2 Turn it on with 50: it is on after a reload with the amount 50", async ({ page, context }) => {
  const net = await admin(page, context);
  await page.getByLabel("Early friend amount, rupees").fill("50");
  await page.getByRole("switch", { name: /^Give the early friend offer/ }).click();
  await expect.poll(() => net.state.earlySets).toEqual([{ p_on: true, p_amount_paise: 5000 }]);
  await page.reload();
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("switch", { name: /^Give the early friend offer/ })).toBeChecked();
  await expect(page.getByLabel("Early friend amount, rupees")).toHaveValue("50");
});

test("TC A14.3 Offer off: Tell me when you come here saves the request and the letter shows no rupee promise", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.areaRequest = { ok: true };   // what the server answers while the offer is off: no amount
  await page.goto("/customer/");
  await typePlace(page, "110099", "Sector 62, Noida, Uttar Pradesh 201301");
  await page.getByRole("button", { name: "Tell me when you come here" }).click();
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();
  await expect(page.getByRole("group", { name: "A letter from co-founder Satvik Jain" })).not.toContainText("₹");
  await expect(page.getByRole("group", { name: "A letter from co-founder Satvik Jain" })).not.toContainText("promise");
});

test("TC A14.4 Placed slip: a first order with the gift shows the gift line and the lines add up to the total", async ({ page, context }) => {
  await setup(context, page, [{ ...order("placed"), items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 1, price_paise: 12500 }], total_paise: 2500, bill: { early_friend_paise: 10000, to_pay_paise: 2500 } }]);
  await page.goto("/customer/");
  const slip = page.locator(".ui-slip").first();
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  await expect(slip.locator(".ui-slip-lines")).toContainText("125");
  await expect(slip.locator(".ui-slip-lines")).toContainText("−100");
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹25");   // 125 + Free − 100 = 25: the owner's phone of 10 Nov now adds up
});

test("TC A14.5 Offer off: the bill and the slip show no gift line and the total is the menu price", async ({ page, context }) => {
  await setup(context, page, [{ ...order("placed"), items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 1, price_paise: 32000 }], total_paise: 32000, bill: { early_friend_paise: 0, to_pay_paise: 32000 } }]);
  await page.goto("/customer/");
  const slip = page.locator(".ui-slip").first();
  await expect(slip.getByText("Early friend gift")).toHaveCount(0);
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹320");
});

test("TC A14.6 Turning the offer off with an empty amount box still works", async ({ page, context }) => {
  const net = await admin(page, context, { early: { on: true, amount_paise: 5000 } });
  await page.getByLabel("Early friend amount, rupees").fill("");
  await page.getByRole("switch", { name: /^Give the early friend offer/ }).click();
  await expect.poll(() => net.state.earlySets).toEqual([{ p_on: false, p_amount_paise: 5000 }]);
});

// Story #1332: the staff slips list the gift too, so the rider's To collect at door adds up.
test("TC A14.7 Rider Pick up (board RP3, story 1441): a first order with the gift shows To collect at door as the billed amount", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), total_paise: 54000, bill: { early_friend_paise: 10000, to_pay_paise: 54000 }, rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" }]);
  net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" }];
  await page.goto("/rider/");
  const slip = page.locator(".ui-slip").first();
  await expect(slip).toContainText("2 × Butter Chicken");
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹540");   // 640 − 100
});

test("TC A14.8 Kitchen new-order sheet: the same order lists the gift and Rider collects the same amount", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("placed"), total_paise: 54000, bill: { early_friend_paise: 10000, to_pay_paise: 54000 } }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await expect(sheet.getByText("Early friend gift")).toBeVisible();
  expect(await sum(sheet.locator(".ui-slip-lines"))).toBe(540);
  await expect(sheet.locator(".ui-slip-total span")).toHaveText("₹540");
});

test("TC A14.9 Kitchen Ticket screen (a cooking order): the gift is listed and the lines add up to Rider collects", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("preparing"), total_paise: 54000, bill: { early_friend_paise: 10000, to_pay_paise: 54000 } }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Ticket" })).toBeVisible();
  const slip = page.locator("section[aria-label='Order 0f0f0f0f']");
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  expect(await sum(slip.locator(".ui-slip-lines"))).toBe(540);
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹540");
});
