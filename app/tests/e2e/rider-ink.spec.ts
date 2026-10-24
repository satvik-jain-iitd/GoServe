// Story H11 (#194): the rider app on the Ink v3 boards R1 to R9. The network is answered by the test (helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup, scan as axeScan } from "./helpers";

const NOW = new Date().toISOString();
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("S1 the Job tab holds the one delivery in hand: pick up, on the way, delivered, then the next one", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" }]);
  net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" }];
  await page.goto("/rider/");
  await expect(page.getByText("Pick up at")).toBeVisible();
  await expect(page.getByText("Tau Ka Dhaba")).toBeVisible();
  await expect(page.getByText("Collect cash")).toBeVisible();
  await expect(page.getByRole("link", { name: "Call Rahul" })).toHaveAttribute("href", "tel:9876543210");
  await page.getByRole("button", { name: "Pick up 0f0f0f0f" }).click();
  await expect(page.getByText("On the way", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Arriving 0f0f0f0f" }).click();
  await expect(page.getByRole("button", { name: "Arriving 0f0f0f0f" })).toBeDisabled();
  await page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true }).click();
  await expect(page.getByText("Cash collected")).toBeVisible();
  await page.getByRole("button", { name: "Next delivery" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
  expect(net.calls.status.map((c) => c.body.to_status ?? c.body.event)).toEqual(["out_for_delivery", "order.arriving", "delivered"]);
});

test("S2 Today lists the deliveries so far and the cash in hand", async ({ page, context }) => {
  await setup(context, page, [{ ...order("delivered", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma" }, { ...order("delivered", "2020-01-01T10:00:00Z"), id: "0a0a0a0a-0000-0000-0000-000000000000", rider_id: SESSION }]);
  await page.goto("/rider/");
  await tab(page, "Today").click();
  await expect(page.getByText("1 delivered")).toBeVisible();
  await expect(page.getByTestId("cash")).toContainText("₹640");   // the total
  await expect(page.locator(".ui-row", { hasText: "No. 0f0f0f0f" })).toContainText("₹640");   // the one row
  await expect(page.getByText(/No\. 0f0f0f0f/)).toBeVisible();
  await expect(page.getByText(/No\. 0a0a0a0a/)).toHaveCount(0);   // yesterday's is not today's
  void ID;
});

test("S3 Me has the online switch, the phone the kitchen calls, and Sign out", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  await page.goto("/rider/");
  await tab(page, "Me").click();
  await expect(page.getByRole("switch", { name: "Online" })).toBeChecked();
  await expect(page.getByText("9810011223")).toBeVisible();
  await page.getByRole("switch", { name: "Online" }).click();
  await expect(page.getByRole("switch", { name: "Online" })).not.toBeChecked();
  expect(net.calls.riderWrites.at(-1)!.body.online).toBe(false);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("S4 an offline rider sees why there is no delivery, and goes online from there", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.rider = { user_id: SESSION, name: "Rider", online: false, lat: null, lng: null };
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  await page.getByRole("button", { name: "Go online" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for a delivery" })).toBeVisible();
  expect(net.calls.riderWrites.find((w) => w.body.online === true)).toBeTruthy();
});

test("S5 an account that is not a rider sees the gate with Check again and Sign out", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.rider = null;
  net.state.anonymous = false;   // signed in with Google, but not on the rider list
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Not a rider yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toHaveCount(0);
});

for (const theme of ["day", "night"] as const) {
  test(`S6 the rider screens have no serious contrast or role violation in ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page, [{ ...order("ready"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" }]);
    await page.goto("/rider/");
    await expect(page.getByText("Collect cash")).toBeVisible();
    const scan = async () => expect(await axeScan(page, ["wcag2a", "wcag2aa"])).toEqual([]);
    await scan();   // R5 pick up
    await page.getByRole("button", { name: "Pick up 0f0f0f0f" }).click();
    await page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true }).click();
    await expect(page.getByText("Cash collected")).toBeVisible();
    await scan();   // R7 delivered
    await page.getByRole("button", { name: "Next delivery" }).click();
    for (const name of ["Today", "Me"]) { await tab(page, name).click(); await scan(); }   // R8, R9
    await page.getByRole("switch", { name: "Online" }).click();
    await tab(page, "Delivery").click();
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
    await scan();   // R3 offline
    net.state.rider = null;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in to ride" })).toBeVisible();
    await scan();   // R1 gate
    net.state.anonymous = false;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Not a rider yet" })).toBeVisible();
    await scan();   // R2 gate
  });
}

test("S7 a phone with no Google sign-in sees Sign in to ride", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.rider = null;
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Sign in to ride" })).toBeVisible();
  await expect(page.getByTestId("google-signin")).toBeVisible();
});

test("S8 when the kitchen row cannot be read, the pick-up card still shows and says The kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), rider_id: SESSION }]);
  net.state.kitchens = [];   // no row comes back for the order's kitchen_id
  await page.goto("/rider/");
  await expect(page.getByText("The kitchen", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toBeEnabled();
});

test("S9 two ready orders: the one waiting longest is the job in hand, the other waits", async ({ page, context }) => {
  await setup(context, page, [{ ...order("ready", "2020-01-01T10:10:00Z", "2020-01-01T10:10:00Z"), rider_id: SESSION }, { ...order("ready", "2020-01-01T10:00:00Z", "2020-01-01T10:00:00Z"), id: "0a0a0a0a-0000-0000-0000-000000000000", rider_id: SESSION }]);
  await page.goto("/rider/");
  await expect(page.getByText("No. 0a0a0a0a")).toBeVisible();
  await expect(page.getByText("1 more waiting")).toBeVisible();
});
