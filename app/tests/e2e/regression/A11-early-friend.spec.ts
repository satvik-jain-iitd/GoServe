// Regression: the early-friend offer (board A11-EarlyFriend, story #1329) and the placed slip lines that add up (story #1295). Rows also in docs/tests/test-cases.md.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { order, setup, typePlace } from "../helpers";

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

test("TC A11.1 Look: the offer is off by default, the amount is 100, who set it last", async ({ page, context }) => {
  await admin(page, context);
  await expect(page.getByRole("switch", { name: /^Give the early friend offer/ })).not.toBeChecked();
  await expect(page.getByLabel("Early friend amount, rupees")).toHaveValue("100");
  await expect(page.getByText("Now off · set by owner@goserve.test, 10 Nov")).toBeVisible();
});

test("TC A11.2 Turn it on with 50: it is on after a reload with the amount 50", async ({ page, context }) => {
  const net = await admin(page, context);
  await page.getByLabel("Early friend amount, rupees").fill("50");
  await page.getByRole("switch", { name: /^Give the early friend offer/ }).click();
  await expect.poll(() => net.state.earlySets).toEqual([{ p_on: true, p_amount_paise: 5000 }]);
  await page.reload();
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("switch", { name: /^Give the early friend offer/ })).toBeChecked();
  await expect(page.getByLabel("Early friend amount, rupees")).toHaveValue("50");
});

test("TC A11.3 Offer off: Tell me when you come here saves the request and the letter shows no rupee promise", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.areaRequest = { ok: true };   // what the server answers while the offer is off: no amount
  await page.goto("/customer/");
  await typePlace(page, "110099", "Sector 62, Noida, Uttar Pradesh 201301");
  await page.getByRole("button", { name: "Tell me when you come here" }).click();
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();
  await expect(page.getByRole("group", { name: "A letter from co-founder Satvik Jain" })).not.toContainText("₹");
  await expect(page.getByRole("group", { name: "A letter from co-founder Satvik Jain" })).not.toContainText("promise");
});

test("TC A11.4 Placed slip: a first order with the gift shows the gift line and the lines add up to the total", async ({ page, context }) => {
  await setup(context, page, [{ ...order("placed"), items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 1, price_paise: 12500 }], total_paise: 2500, bill: { early_friend_paise: 10000, to_pay_paise: 2500 } }]);
  await page.goto("/customer/");
  const slip = page.locator(".ui-slip").first();
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  await expect(slip.locator(".ui-slip-lines")).toContainText("125");
  await expect(slip.locator(".ui-slip-lines")).toContainText("−100");
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹25");   // 125 + Free − 100 = 25: the owner's phone of 10 Nov now adds up
});
