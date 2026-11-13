// Story 1448 (boards DV1, DV2, TC2 now TI1, CP1; owner, 13 Nov 2026): the rider's Delivered slip tells three true things.
// It is done, how much cash he holds ("Cash aapke paas", the Today number), and what next: "Next delivery" when an order waits, else "Done".
// A wrong tap between cash and UPI is put right with "Change" until the night's cash is handed over; Today's rows open their slip.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const KITCHEN = { id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
const onTheWay = () => ({ ...order("out_for_delivery", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" });
const OTHER = "0a0a0a0a-1111-4222-8333-444444444444";
const LATER = new Date(Date.now() + 60_000).toISOString();
const waiting = () => ({ ...order("ready", NOW, LATER), id: OTHER, rider_id: SESSION, customer_name: "Meera Kapoor" });   // placed after the one in hand, so it waits
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const deliver = async (context: BrowserContext, page: Page, orders: object[], how: "Took cash" | "Paid by UPI" = "Took cash", state: Record<string, unknown> = {}) => {
  const net = await setup(context, page, orders);
  net.state.qrObject = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png";
  net.state.kitchens = [KITCHEN];
  Object.assign(net.state, state);
  await page.goto("/rider/");
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: /^Collect ₹/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${how}`) }).click();
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
  return net;
};

test("DV1 a delivery just marked delivered and one more order waiting: the button says Next delivery", async ({ page, context }) => {
  await deliver(context, page, [onTheWay(), waiting()]);
  await expect(page.locator(".ui-bottom button")).toHaveText(["Next delivery"]);
  await expect(page.getByText("Koi order nahin · kitchen par lautein")).toHaveCount(0);
});

test("DV2 a delivery just marked delivered and no order waiting: the line Koi order nahin and the button Done, which opens the waiting screen", async ({ page, context }) => {
  await deliver(context, page, [onTheWay()]);
  await expect(page.getByText("Koi order nahin · kitchen par lautein")).toBeVisible();
  await expect(page.locator(".ui-bottom button")).toHaveText(["Done"]);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
});

test("DV3 the Delivered slip names the customer and not the kitchen", async ({ page, context }) => {
  await deliver(context, page, [onTheWay()]);
  const slip = page.getByRole("region", { name: `Order ${ID.slice(0, 8)}` });
  await expect(slip).toContainText("Rahul Verma");
  await expect(slip).not.toContainText("Tau Ka Dhaba");
});

test("DV4 the line under the slip shows Cash aapke paas with the same amount as the Today tab", async ({ page, context }) => {
  await deliver(context, page, [onTheWay(), { ...order("delivered", NOW, NOW), id: "0b0b0b0b-1111-4222-8333-444444444444", rider_id: SESSION, paid_by: "cash", total_paise: 10000 }]);
  await expect(page.getByText("Cash aapke paas ₹740", { exact: true })).toBeVisible();
  await expect(page.getByText(/delivered$/).filter({ hasText: "Today ·" })).toHaveCount(0);
  await tab(page, "Today").click();
  await expect(page.getByTestId("cash")).toContainText("Cash aapke paas");
  await expect(page.getByTestId("cash")).toContainText("₹740");
});

test("DV5 a delivery marked Took cash by mistake: Change, then Paid by UPI, the slip says Paid by UPI and Cash aapke paas drops by that amount", async ({ page, context }) => {
  const net = await deliver(context, page, [onTheWay()]);
  await expect(page.getByText("Cash aapke paas ₹640", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("button", { name: "Paid by UPI ₹640" }).click();
  await expect(page.getByText("Paid by UPI", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash aapke paas ₹0", { exact: true })).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "rider_change_paid").map((c) => c.body)).toEqual([{ p_order: ID, p_method: "upi_door" }]);
});

test("DV6 the server refuses a change: the slip keeps the old way and says why", async ({ page, context }) => {
  await deliver(context, page, [onTheWay()], "Took cash", { changeReply: { ok: false, error: "handed_over" } });
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("button", { name: "Paid by UPI ₹640" }).click();
  await expect(page.getByRole("alert")).toContainText("Cash kitchen me jama ho chuka hai");
  await expect(page.getByText("Cash collected", { exact: true })).toBeVisible();
});

const today = (extra: Record<string, unknown> = {}) => ({ ...order("delivered", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma", paid_by: "cash", ...extra });
test("TC2a a delivered order from today and cash not handed over: its row on Today opens its Delivered slip with Change", async ({ page, context }) => {
  const net = await setup(context, page, [today()]);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
  await tab(page, "Today").click();
  const row = page.getByRole("button", { name: /No\. 0f0f0f0f/ });
  await expect(row).toContainText("Cash");
  await expect(row).toContainText("›");
  await row.click();
  await expect(page.getByRole("region", { name: `Order ${ID.slice(0, 8)}` })).toContainText("Cash collected");
  await expect(page.getByRole("button", { name: "Change", exact: true })).toBeVisible();
});

test("TC2b the night's cash is handed over: the slip has no Change", async ({ page, context }) => {
  const net = await setup(context, page, [today({ cash_handed_at: NOW })]);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
  await tab(page, "Today").click();
  await page.getByRole("button", { name: /No\. 0f0f0f0f/ }).click();
  await expect(page.getByRole("region", { name: `Order ${ID.slice(0, 8)}` })).toContainText("Cash collected");
  await expect(page.getByRole("button", { name: "Change", exact: true })).toHaveCount(0);
});

test("CP1 the Collect payment screen: the line under the QR reads Pehle paisa, phir button.", async ({ page, context }) => {
  const net = await setup(context, page, [onTheWay()]);
  net.state.qrObject = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png";
  await page.goto("/rider/");
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: /^Collect ₹/ }).click();
  await expect(page.getByText("Pehle paisa, phir button.", { exact: true })).toBeVisible();
});
