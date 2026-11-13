// Story #1262 (epic #1259, board R7-CollectQR): "Delivered" opens Collect payment (story 1182: the button is now "Collect ₹<amount>", after Arriving). The rider says how it was paid at the door, and that marks the order delivered.
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const onTheWay = () => ({ ...order("out_for_delivery", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" });
const OBJ = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png";
const SRC = `https://test.supabase.co/storage/v1/object/public/upi-qr/${OBJ}`;
const open = async (context: Parameters<typeof setup>[0], page: Page, state: Record<string, unknown> = {}) => {
  const net = await setup(context, page, [onTheWay()]);
  net.state.qrObject = OBJ;   // the admin has uploaded the QR; the cases without one say so
  Object.assign(net.state, state);
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Arriving 0f0f0f0f" }).click();
  await page.getByRole("button", { name: /^Collect ₹/ }).click();   // story 1182, board RY3: Collect opens Collect payment
  return net;
};
const deliverCalls = (net: Awaited<ReturnType<typeof setup>>) => net.calls.status.filter((c) => c.body.action === "deliver").map((c) => c.body);

test("C1 UPI at the door on: Delivered opens Collect payment with the name, the amount, the QR and both buttons, and nothing is saved yet", async ({ page, context }) => {
  const net = await open(context, page);
  await expect(page.getByText("Rahul Verma")).toBeVisible();
  await expect(page.getByTestId("collect-total")).toHaveText("₹640");
  await expect(page.getByRole("img", { name: "UPI QR to scan" })).toHaveAttribute("src", SRC);
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
  await expect(page.getByRole("img", { name: "UPI QR to scan" })).toHaveCount(0);
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

test("C8 already_done is not an error: the order is read again and the slip shows how it was really paid", async ({ page, context }) => {
  const net = await open(context, page);
  net.state.reply = { status: 409, body: { ok: false, error: "already_done", message: "This step was already done." } };
  net.state.orders = [{ ...onTheWay(), status: "delivered", paid_by: "cash", updated_at: new Date(Date.now() + 60_000).toISOString() }];   // an earlier tap saved cash (after the Arriving answer); the rider now taps UPI
  await page.getByRole("button", { name: "Paid by UPI ₹640" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Cash collected", { exact: true })).toBeVisible();   // the server's answer, not the rider's tap
  await expect(page.getByText("Paid by UPI", { exact: true })).toHaveCount(0);
  expect(deliverCalls(net)).toHaveLength(1);
});

test("C8b already_done and the re-read fails: the slip says Collected, never a guessed way", async ({ page, context }) => {
  const net = await open(context, page);
  net.state.reply = { status: 409, body: { ok: false, error: "already_done", message: "This step was already done." } };
  await page.getByRole("button", { name: "Took cash ₹640" }).click();
  await expect(page.getByText("Collected", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash collected")).toHaveCount(0);
});

test("C8c a delivered order with no paid_by reads Collected in Today, never Cash collected", async ({ page, context }) => {
  await setup(context, page, [{ ...order("delivered", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma", paid_by: null }]);
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator(".ui-row", { hasText: "No. 0f0f0f0f" })).toContainText("Collected");
  await expect(page.locator(".ui-row", { hasText: "No. 0f0f0f0f" })).not.toContainText("Cash collected");
});

test("C10 UPI is turned off while the rider is on the screen: method_off reads the list again and the UPI button and the QR go", async ({ page, context }) => {
  const net = await open(context, page);
  net.state.doorMethods = ["cash"];
  net.state.reply = { status: 409, body: { ok: false, error: "method_off", message: "UPI at the door is not on." } };
  await page.getByRole("button", { name: "Paid by UPI ₹640" }).click();
  await expect(page.getByRole("alert")).toContainText("UPI at the door is not on.");
  await expect(page.getByRole("button", { name: "Paid by UPI ₹640" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "UPI QR to scan" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();
});

test("C9 Back leaves Collect payment without saving", async ({ page, context }) => {
  const net = await open(context, page);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: /^Collect ₹/ })).toBeVisible();
  expect(deliverCalls(net)).toEqual([]);
});

test("C11 no QR uploaded yet (the server leaves UPI out): the rider sees cash only, no QR, no UPI button, no sample picture", async ({ page, context }) => {
  await open(context, page, { qrObject: null, doorMethods: ["cash"] });
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();
  await expect(page.getByRole("img")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/UPI|QR/i);
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toHaveClass(/^ui-btn big$/);
});

test("C12 the QR picture will not load: the screen says UPI has no QR yet, hides the UPI button and keeps cash", async ({ page, context }) => {
  await open(context, page, { qrFail: "image" });
  await expect(page.getByText("UPI at the door has no QR yet. Take cash, or ask the admin to upload the QR.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Paid by UPI/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();
});

test("C13 the QR read fails: the screen says it could not check, names no method, and Try again reads it again", async ({ page, context }) => {
  const net = await open(context, page, { qrFail: "read" });
  await expect(page.getByText("We could not check how to collect. Try again.")).toBeVisible();
  await expect(page.getByText(/ask the admin/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Took cash|Paid by UPI/ })).toHaveCount(0);
  net.state.qrFail = "";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Paid by UPI ₹640" })).toBeVisible();
});
