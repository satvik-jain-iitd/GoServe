// Story #1332: the rider, kitchen and admin slips list the discount and the early friend gift, so their lines add up to the amount to collect (same as the customer slip, #1295).
import { test, expect, type Locator } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const BILLED = { total_paise: 54000, bill: { early_friend_paise: 10000, to_pay_paise: 54000 } };   // 2 x 320 = 640, minus the gift 100 = 540
const rupees = (t: string) => Number(t.replace(/[₹,\s]/g, "").replace("−", "-"));
const sum = async (lines: Locator) => (await lines.locator(":scope > div span:last-child").allTextContents()).reduce((n, t) => n + rupees(t), 0);

test("L1 rider: To collect at door lists the gift and the lines add up", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), ...BILLED, rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" }]);
  net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" }];
  await page.goto("/rider/");
  const slip = page.locator(".ui-slip").first();
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  expect(await sum(slip.locator(".ui-slip-lines"))).toBe(540);
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹540");
});

test("L2 kitchen: the ticket sheet lists the gift and the lines add up to Rider collects", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("placed"), ...BILLED }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await expect(sheet.getByText("Early friend gift")).toBeVisible();
  expect(await sum(sheet.locator(".ui-slip-lines"))).toBe(540);
  await expect(sheet.locator(".ui-slip-total span")).toHaveText("₹540");
});

test("L3 admin: the order slip lists the gift and the lines add up to Cash at door", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("preparing"), ...BILLED, customer_name: "Asha", customer_phone: "9876543210" }]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();
  const slip = page.locator(".ui-slip").first();
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  expect(await sum(slip.locator(".ui-slip-lines"))).toBe(540);
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹540");
});

test("L4 no gift and no discount: no extra line on any staff slip", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("placed"), total_paise: 64000, bill: { early_friend_paise: 0, discount_paise: 0, to_pay_paise: 64000 } }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await expect(sheet.getByText("Early friend gift")).toHaveCount(0);
  await expect(sheet.getByText("Discount", { exact: true })).toHaveCount(0);
  expect(await sum(sheet.locator(".ui-slip-lines"))).toBe(640);
});
