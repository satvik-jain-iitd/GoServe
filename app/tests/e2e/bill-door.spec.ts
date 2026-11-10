// Story #1261 (board P6-BillDoor): the bill says how you pay at the door, nothing is charged now. It lists only the methods Admin has on; no Card, no online pay flow.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";
import { STEPS } from "./screensSteps";

const toBill = async (page: Page, context: Parameters<typeof setup>[0], methods?: string[], over: Record<string, unknown> = {}) => {
  const net = await setup(context, page);
  if (methods) net.state.doorMethods = methods;
  Object.assign(net.state, over);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  return net;
};
const group = (page: Page) => page.getByRole("radiogroup", { name: "How you pay" });

test("S1 cash and UPI at the door both on: two rows, cash selected, the line says nothing is charged now, no Card", async ({ page, context }) => {
  await toBill(page, context);
  await expect(page.getByText("How you pay · nothing is charged now")).toBeVisible();
  await expect(group(page).getByRole("radio")).toHaveCount(2);
  await expect(group(page).getByRole("radio", { name: /^Cash at the door/ })).toBeChecked();
  await expect(group(page).getByRole("radio", { name: /^UPI at the door/ })).not.toBeChecked();
  await expect(group(page).getByText("Scan the rider's QR with any UPI app")).toBeVisible();
  await expect(page.getByText("Card", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Cash on delivery")).toHaveCount(0);
});

test("S2 only cash on: one row, selected, and no UPI words anywhere on the screen", async ({ page, context }) => {
  const net = await toBill(page, context, ["cash"]);
  await expect.poll(() => net.state.doorCalls).toBeGreaterThan(0);   // the answer has come in, so the one row is the answer, not a start state
  await expect(group(page).getByRole("radio")).toHaveCount(1);
  await expect(group(page).getByRole("radio", { name: /^Cash at the door/ })).toBeChecked();
  await expect(page.locator("body")).not.toContainText(/UPI/i);
});

test("S3 only UPI at the door on: one row, UPI selected", async ({ page, context }) => {
  await toBill(page, context, ["upi_door"]);
  await expect(group(page).getByRole("radio")).toHaveCount(1);
  await expect(group(page).getByRole("radio", { name: /^UPI at the door/ })).toBeChecked();
  await expect(page.getByText("Cash at the door")).toHaveCount(0);
});

test("S4 the total line reads To pay at door", async ({ page, context }) => {
  await toBill(page, context);
  await expect(page.getByText("To pay at door", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash at door", { exact: true })).toHaveCount(0);
});

test("S5 pick UPI at the door and place the order: no payment screen opens, the order is placed", async ({ page, context }) => {
  const net = await toBill(page, context);
  await group(page).getByRole("radio", { name: /^UPI at the door/ }).check();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay now/ })).toHaveCount(0);
  await expect(page.getByText("To pay at door", { exact: true })).toBeVisible();   // the slip says the same
  expect(net.calls.place).toHaveLength(1);
});

test("S6 when the list cannot be read the bill names no method: one neutral line, no rows, and the order can still be placed", async ({ page, context }) => {
  const net = await toBill(page, context, undefined, { doorFail: true });
  await expect.poll(() => net.state.doorCalls).toBeGreaterThan(0);
  await expect(page.getByText("You pay at the door.")).toBeVisible();
  await expect(group(page).getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("Cash at the door")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /At door/ })).toBeVisible();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  expect(net.calls.place).toHaveLength(1);
});

test("S6b while the list is on its way, with only UPI on, the bill never shows Cash at the door", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.doorMethods = ["upi_door"]; net.state.doorDelayMs = 1500;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("You pay at the door.")).toBeVisible();   // the neutral line while we wait
  await expect(page.getByText("Cash at the door")).toHaveCount(0);
  await expect(group(page).getByRole("radio", { name: /^UPI at the door/ })).toBeChecked();
  await expect(page.getByText("Cash at the door")).toHaveCount(0);
});

test("S7 a declined pay-at-door order says nothing was charged and never 'paid online'", async ({ page, context }) => {
  await STEPS.declined(context, page, "/customer/");
  await expect(page.getByText("Nothing was charged.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/paid online/i);
});

// Loan (rule 20, epic #1259): the online payment code stays in the app, dormant, because online pay comes back later (owner, 10 Nov 2026: "abhi sirf"). No bill reaches it now.
// Orders already placed online must still show their paid state.
test("S8 an order that was placed online and paid still reads Paid online on its slip", async ({ page, context }) => {
  const paid = { ...(await import("./helpers")).order("placed"), payment_method: "online", paid_at: "2026-11-10T09:00:00Z" };
  await setup(context, page, [paid]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();   // an open order resumes on its slip
  await expect(page.getByText("Paid online", { exact: true })).toBeVisible();
});

test("S9 a declined order that was paid online keeps the refund line", async ({ page, context }) => {
  const o = { ...(await import("./helpers")).order("cancelled", "2020-01-01T10:02:00Z"), payment_method: "online", paid_at: "2026-11-10T09:00:00Z", cancel_reason: "We are out of butter chicken tonight, so this order cannot be made." };
  await setup(context, page, [o]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByText("Your money is not taken. If you paid online, it comes back in 5 to 7 days.")).toBeVisible();
  await expect(page.getByText("Nothing was charged.")).toHaveCount(0);
});

test("S10 a delivered order the rider took UPI for reads Paid by UPI at the door", async ({ page, context }) => {
  const o = { ...(await import("./helpers")).order("delivered", "2020-01-01T10:30:00Z"), paid_by: "upi_door" };
  await setup(context, page, [o]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByText("Paid by UPI at the door", { exact: true })).toBeVisible();
});

test("S11 a delivered order the customer confirmed, with no way recorded yet, reads Paid at the door, never Cash paid (story 1293)", async ({ page, context }) => {
  const o = { ...(await import("./helpers")).order("delivered", "2020-01-01T10:30:00Z"), paid_by: null };
  await setup(context, page, [o]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.getByText("Paid at the door", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash paid")).toHaveCount(0);
});
