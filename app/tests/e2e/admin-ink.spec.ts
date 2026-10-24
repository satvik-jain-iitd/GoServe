// Story H12 (#195): the admin app on the Ink v3 boards A1 to A4 and A8 (layer 1). The network is answered by the test (helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { order, setup, scan as axeScan } from "./helpers";

const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const ORDER = (over: object = {}) => ({ ...order("placed"), kitchen_id: "k-1", customer_name: "Asha", customer_phone: "9876543210", cancel_reason: null, ...over });

test("S1 no Google sign-in sees Sign in to run the city; a signed-in account that is not an admin sees the gate", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/admin/");
  await expect(page.getByRole("heading", { name: "Sign in to run the city" })).toBeVisible();
  await expect(page.getByTestId("google-signin")).toBeVisible();
  net.state.anonymous = false;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Not an admin account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(tab(page, "Orders")).toHaveCount(0);
});

test("S2 Orders opens on Live and Done, a row opens the order with its slip, the calls and the timeline", async ({ page, context }) => {
  const net = await setup(context, page, [ORDER({ status: "preparing" }), ORDER({ id: "11111111-1111-4111-8111-111111111111", status: "delivered", customer_name: "Ravi" })]);
  net.state.admin = true;
  await page.goto("/admin/");
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open order 0f0f0f0f/ })).toContainText("Asha");
  await expect(page.getByRole("button", { name: /^Open order 11111111/ })).toContainText("Ravi");
  await page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();
  await expect(page.getByRole("heading", { name: "Order", exact: true })).toBeVisible();
  await expect(page.getByText("Cash at door")).toBeVisible();
  await expect(page.getByRole("link", { name: "Call Asha" })).toHaveAttribute("href", "tel:9876543210");
  await expect(page.getByText("Not assigned yet")).toBeVisible();
  await expect(page.getByRole("list", { name: "Order status" }).getByRole("listitem")).toHaveCount(6);
  await page.getByRole("button", { name: "Back to orders" }).click();
  await expect(page.getByRole("heading", { name: "Live" })).toBeVisible();
});

test("S3 Cancel order on one order asks for a reason, then calls cancel_order", async ({ page, context }) => {
  const net = await setup(context, page, [ORDER()]);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await expect(page.getByRole("alert")).toContainText("reason");
  expect(net.calls.rpc.filter((c) => c.name === "cancel_order")).toHaveLength(0);
  await page.getByLabel("Reason").fill("kitchen out of stock");
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "cancel_order").length).toBe(1);
});

test("S4 Numbers shows the day's tiles and one row per kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [ORDER({ status: "preparing" })]);
  net.state.admin = true;
  net.state.numbers = [
    { day: "2026-10-23", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen", orders: 5, delivered: 3, cancelled: 1, cash_paise: 90000 },
    { day: "2026-10-23", kitchen_id: "k-2", kitchen_name: "Rohini Kitchen", orders: 2, delivered: 2, cancelled: 0, cash_paise: 40000 },
  ];
  await page.goto("/admin/");
  await tab(page, "Numbers").click();
  await expect(page.getByTestId("day-total")).toContainText("7 orders");
  await expect(page.getByTestId("day-total")).toContainText("₹1300");
  await expect(page.getByTestId("tile-orders")).toContainText("1 live");
  await expect(page.getByTestId("tile-delivered")).toContainText("1 cancelled");
  await expect(page.getByText("Rohini Kitchen")).toBeVisible();
});

test("S5 City opens on the kitchens and riders (board A5, see admin-city.spec)", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await tab(page, "City").click();
  await expect(page.getByRole("region", { name: "Kitchens" })).toBeVisible();
  await expect(page.getByText("Hauz Khas Kitchen")).toBeVisible();
});

for (const theme of ["day", "night"] as const) {
  test(`S6 the admin screens have no serious contrast or role violation in ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page, [ORDER({ status: "preparing" })]);
    net.state.admin = true;
    net.state.numbers = [{ day: "2026-10-23", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen", orders: 5, delivered: 3, cancelled: 1, cash_paise: 90000 }];
    await page.goto("/admin/");
    await expect(page.getByRole("heading", { name: "Live" })).toBeVisible();
    const scan = async () => expect(await axeScan(page, ["wcag2a", "wcag2aa"])).toEqual([]);
    await scan();   // A3
    await page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();
    await expect(page.getByRole("heading", { name: "Order", exact: true })).toBeVisible();
    await scan();   // A4
    await page.getByRole("button", { name: "Back to orders" }).click();
    await tab(page, "Numbers").click();
    await expect(page.getByTestId("day-total")).toBeVisible();
    await scan();   // A8
    net.state.admin = false;
    net.state.anonymous = false;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Not an admin account" })).toBeVisible();
    await scan();   // A2
    net.state.anonymous = true;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in to run the city" })).toBeVisible();
    await scan();   // A1
  });
}
