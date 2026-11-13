// Story 1455 (boards KO1 and KK1, epic 1453): the order sheet and the Ticket show only what the cook needs: the number, the time,
// the dishes with counts and the customer's note. No address, no customer name, no prices, no amount; one button at the bottom of the Ticket.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const NOTE = "Less spicy please. No peanuts, allergy.";
const BILLED = { total_paise: 54000, bill: { early_friend_paise: 10000, to_pay_paise: 54000 }, customer_name: "Rahul Verma", address: "Flat 4, Green Park", instructions: NOTE };
const open = async (page: Page, context: Parameters<typeof setup>[0], status: string) => {
  const net = await setup(context, page, [{ ...order(status), ...BILLED }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  if (status !== "placed") await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
};
const nothingExtra = async (where: ReturnType<Page["locator"]>) => {
  await expect(where).toContainText("2 × Butter Chicken");
  for (const t of ["Deliver to", "Flat 4, Green Park", "Rahul", "Rider collects", "Paid online", "₹", "Cash", "Early friend gift"]) await expect(where.getByText(t)).toHaveCount(0);
};

test("KO1a given the order sheet of a New ticket, it shows no address, no customer name, no price and no Rider collects", async ({ page, context }) => {
  await open(page, context, "placed");
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await nothingExtra(sheet);
  await expect(sheet.getByText(/^Placed \d\d:\d\d$/)).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Accept 0f0f0f0f" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Decline, with a reason" })).toBeVisible();
});

test("KK1a given the Ticket screen, it shows no address, no price, no Rider collects, and one button at the bottom", async ({ page, context }) => {
  await open(page, context, "accepted");
  await nothingExtra(page.locator(".ui-slip").first());
  await expect(page.getByText("Accept. Start when cooking. Ready calls the rider.")).toHaveCount(0);
  await expect(page.locator(".ui-bottom button")).toHaveCount(1);
  await expect(page.locator(".ui-bottom button")).toHaveText("Start");
  await expect(page.getByRole("button", { name: /^Back to (new|cooking)$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back to cooking tickets" })).toBeVisible();   // the arrow at the top does that job
});

test("KO1b given a ticket with a customer note, the Customer says band shows on the sheet and on the Ticket", async ({ page, context }) => {
  await open(page, context, "placed");
  await expect(page.getByRole("dialog", { name: "Order 0f0f0f0f" }).getByText(NOTE)).toBeVisible();
  await page.keyboard.press("Escape");
  await open(page, context, "preparing");
  await expect(page.locator(".ui-slip").first().getByText(NOTE)).toBeVisible();
});

test("KO1c given the New tab, the line accept within 2 min does not show", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("placed"), ...BILLED }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  await expect(page.getByText(/accept within 2 min/)).toHaveCount(0);
  await expect(page.locator(".ui-ticket").first().getByText("₹")).toHaveCount(0);
});
