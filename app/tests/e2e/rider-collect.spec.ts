// Story #1262 (epic #1259, board R7-CollectQR): "Delivered" opens Collect payment. The rider says how it was paid at the door, and that marks the order delivered.
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const onTheWay = () => ({ ...order("out_for_delivery", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" });
const open = async (context: Parameters<typeof setup>[0], page: Page, state: Record<string, unknown> = {}) => {
  const net = await setup(context, page, [onTheWay()]);
  Object.assign(net.state, state);
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true }).click();
  return net;
};
const deliverCalls = (net: Awaited<ReturnType<typeof setup>>) => net.calls.status.filter((c) => c.body.action === "deliver").map((c) => c.body);

test("C1 UPI at the door on: Delivered opens Collect payment with the name, the amount, the QR and both buttons, and nothing is saved yet", async ({ page, context }) => {
  const net = await open(context, page);
  await expect(page.getByText("Rahul Verma")).toBeVisible();
  await expect(page.getByTestId("collect-total")).toHaveText("₹640");
  await expect(page.getByRole("img", { name: "QR code to pay by UPI" })).toBeVisible();
  await expect(page.getByText("Sample QR · the real one comes later")).toBeVisible();
  await expect(page.getByText("Wait for the customer's paid screen. Then tap below.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Paid by UPI ₹640" })).toBeVisible();
  expect(deliverCalls(net)).toEqual([]);
});

test("C2 Paid by UPI delivers with upi_door, the slip says Paid by UPI, Today says it too, and the cash in hand stays at zero", async ({ page, context }) => {
  const net = await open(context, page);
  await page.getByRole("button", { name: "Paid by UPI ₹640" }).click();
  await expect(page.getByText("Paid by UPI", { exact: true })).toBeVisible();
  expect(deliverCalls(net)).toEqual([{ order_id: ID, action: "deliver", method: "upi_door" }]);
  await page.getByRole("button", { name: "Next delivery" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator(".ui-row", { hasText: "No. 0f0f0f0f" })).toContainText("Paid by UPI");
  await expect(page.getByTestId("cash")).toContainText("₹0");
});

test("C3 Took cash delivers with cash, and the cash in hand grows by the amount", async ({ page, context }) => {
  const net = await open(context, page);
  await page.getByRole("button", { name: "Took cash ₹640" }).click();
  await expect(page.getByText("Cash collected", { exact: true })).toBeVisible();
  expect(deliverCalls(net)).toEqual([{ order_id: ID, action: "deliver", method: "cash" }]);
  await page.getByRole("button", { name: "Next delivery" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("cash")).toContainText("₹640");
});

test("C4 UPI at the door off: no QR, no UPI button, one filled Took cash button", async ({ page, context }) => {
  await open(context, page, { doorMethods: ["cash"] });
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR code to pay by UPI" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Paid by UPI/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/UPI/i);
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toHaveClass(/^ui-btn big$/);   // the only way is the filled one
});

test("C5 while the list is on its way the screen names no method and offers no button to save", async ({ page, context }) => {
  const net = await open(context, page, { doorDelayMs: 1500 });
  await expect(page.getByText("Checking how this customer can pay…")).toBeVisible();
  await expect(page.getByRole("button", { name: /Took cash/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Paid by UPI/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Paid by UPI ₹640" })).toBeVisible();
  expect(deliverCalls(net)).toEqual([]);
});

test("C6 when the list cannot be read the screen says so, names no method, and Try again reads it again", async ({ page, context }) => {
  const net = await open(context, page, { doorFail: true });
  await expect(page.getByText("We could not check how to collect. Try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Took cash/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Paid by UPI/ })).toHaveCount(0);
  net.state.doorFail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();
});

test("C7 a failed save shows the error, keeps the screen, and the retry saves once", async ({ page, context }) => {
  const net = await open(context, page);
  net.state.reply = { status: 502, body: { ok: false, error: "order_action_unavailable" } };
  await page.getByRole("button", { name: "Took cash ₹640" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();   // still on Collect payment
  net.state.reply = null;
  await page.getByRole("button", { name: "Took cash ₹640" }).click();
  await expect(page.getByText("Cash collected", { exact: true })).toBeVisible();
  expect(deliverCalls(net)).toHaveLength(2);   // one for the failed tap, one for the retry; a tap that worked is never sent twice
});

test("C8 a second answer already_done is not an error: the slip shows", async ({ page, context }) => {
  const net = await open(context, page);
  net.state.reply = { status: 409, body: { ok: false, error: "already_done", message: "This step was already done." } };
  await page.getByRole("button", { name: "Paid by UPI ₹640" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next delivery" })).toBeVisible();   // an earlier tap went through; the way it was paid is not guessed
  await expect(page.getByText("Cash collected")).toHaveCount(0);
  expect(deliverCalls(net)).toHaveLength(1);
});

test("C9 Back leaves Collect payment without saving", async ({ page, context }) => {
  const net = await open(context, page);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true })).toBeVisible();
  expect(deliverCalls(net)).toEqual([]);
});
