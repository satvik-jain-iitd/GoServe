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

test("L4 no gift and no discount: no extra line on the kitchen sheet", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("placed"), total_paise: 64000, bill: { early_friend_paise: 0, discount_paise: 0, to_pay_paise: 64000 } }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await expect(sheet.getByText("Early friend gift")).toHaveCount(0);
  await expect(sheet.getByText("Discount", { exact: true })).toHaveCount(0);
  expect(await sum(sheet.locator(".ui-slip-lines"))).toBe(640);
});

// Review of #1350: a paid option is part of the line, fees and tax have their own lines, and the Kitchen screen's own ticket (not the new-order sheet) is covered.
const EXTRA = { items: [{ menu_item_id: "d1", name: "Butter Chicken", qty: 2, price_paise: 32000, extras_paise: 5000 }] };   // 2 x (320 + 50) = 740

test("L5 rider: an item with a paid option prints its full price and the lines add up", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), ...EXTRA, total_paise: 64000, bill: { early_friend_paise: 10000, to_pay_paise: 64000 }, rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" }]);
  net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" }];
  await page.goto("/rider/");
  const slip = page.locator(".ui-slip").first();
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  expect(await sum(slip.locator(".ui-slip-lines"))).toBe(640);   // 740 − 100
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹640");
});

test("L6 admin: delivery, packaging and exclusive tax get a line when above zero, and the lines add up", async ({ page, context }) => {
  const bill = { fees: { delivery_paise: 3000, packaging_paise: 2000, total_paise: 5000 }, tax_paise: 2000, tax_mode: "exclusive", to_pay_paise: 71000 };   // 640 + 30 + 20 + 20 = 710
  const net = await setup(context, page, [{ ...order("preparing"), total_paise: 71000, bill, customer_name: "Asha", customer_phone: "9876543210" }]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();
  const slip = page.locator(".ui-slip").first();
  for (const w of ["Delivery", "Packaging", "Tax"]) await expect(slip.getByText(w, { exact: true })).toBeVisible();
  expect(await sum(slip.locator(".ui-slip-lines"))).toBe(710);
});

test("L7 inclusive tax and zero fees add no line", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("preparing"), total_paise: 64000, bill: { fees: { delivery_paise: 0, packaging_paise: 0, total_paise: 0 }, tax_paise: 3000, tax_mode: "inclusive", to_pay_paise: 64000 }, customer_name: "Asha", customer_phone: "9876543210" }]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();
  const slip = page.locator(".ui-slip").first();
  for (const w of ["Delivery", "Packaging", "Tax"]) await expect(slip.getByText(w, { exact: true })).toHaveCount(0);
  expect(await sum(slip.locator(".ui-slip-lines"))).toBe(640);
});

test("L8 kitchen: the Ticket screen of a cooking order (not the new-order sheet) lists the gift and adds up", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("preparing"), ...BILLED }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Ticket" })).toBeVisible();
  const slip = page.getByRole("region", { name: "Order 0f0f0f0f" }).or(page.locator("section[aria-label='Order 0f0f0f0f']"));
  await expect(slip.getByText("Early friend gift")).toBeVisible();
  expect(await sum(slip.locator(".ui-slip-lines"))).toBe(540);
  await expect(slip.locator(".ui-slip-total span")).toHaveText("₹540");
});
