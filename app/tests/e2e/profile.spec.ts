// Story B3 (#159): details saved once, an estimate, cancel while placed, past orders, sign out. Supabase and n8n are answered by the test.
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

async function toCart(page: Page) {
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
}

test("S1 the cart asks for a name and a ten digit phone before the bill, and saves them with the address", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/customer/");
  await toCart(page);
  await page.getByLabel("Delivery address").fill("Flat 4, Green Park");
  await expect(page.getByRole("button", { name: "Review bill" })).toBeDisabled();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone number").fill("98765");
  await expect(page.getByRole("button", { name: "Review bill" })).toBeDisabled();
  await page.getByLabel("Phone number").fill("9876543210");
  await expect(page.getByRole("button", { name: "Review bill" })).toBeEnabled();
  await page.getByRole("button", { name: "Review bill" }).click();
  await page.getByRole("button", { name: "Place order (cash on delivery)" }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect.poll(() => net.calls.customerWrites.length).toBeGreaterThan(0);
  expect(net.calls.customerWrites.at(-1)!.body).toMatchObject({ user_id: SESSION, name: "Asha", phone: "9876543210", address: "Flat 4, Green Park", pin_code: "110016" });
});

test("S2 next time the details are filled in already", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.customer = { user_id: SESSION, name: "Asha", phone: "9876543210", address: "Flat 4, Green Park", pin_code: "110016" };
  await page.goto("/customer/");
  await toCart(page);
  await expect(page.getByLabel("Your name")).toHaveValue("Asha");
  await expect(page.getByLabel("Phone number")).toHaveValue("9876543210");
  await expect(page.getByLabel("Delivery address")).toHaveValue("Flat 4, Green Park");
  await expect(page.getByRole("button", { name: "Review bill" })).toBeEnabled();
});

test("S3 the demo console at / still needs only the address", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/");
  await toCart(page);
  await page.getByLabel("Delivery address").fill("Flat 4");
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review bill" })).toBeEnabled();
});

test("S4 the tracker shows an estimate and a Cancel button while the order is placed; cancelling tells the database and the screen", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByText("About 20 min")).toBeVisible();
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "cancel_order").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "cancel_order")!.body).toEqual({ p_order: ID, p_reason: null });
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.getByText("Your order was cancelled")).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
});

test("S5 once the kitchen has accepted, there is no Cancel button", async ({ page, context }) => {
  await setup(context, page, [order("accepted", "2020-01-01T10:01:00Z")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
});

test("S6 My orders lists past orders by what was ordered, with no order id", async ({ page, context }) => {
  await setup(context, page, [{ ...order("delivered", "2020-01-01T11:00:00Z"), paid_by: "cash" }]);
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await page.getByRole("button", { name: "My orders" }).click();
  await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
  await expect(page.getByText("2 × Butter Chicken")).toBeVisible();
  await expect(page.getByText("Delivered")).toBeVisible();
  await expect(page.getByText("0f0f0f0f")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to menu" }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
});

test("S7 a signed-in customer can sign out and goes back to a fresh anonymous session", async ({ page, context }) => {
  const net = await setup(context, page);
  await context.route("https://test.supabase.co/auth/v1/user", (r) => r.request().method() === "OPTIONS"
    ? r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } })
    : r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ id: SESSION, aud: "authenticated", role: "authenticated", is_anonymous: false, email: "asha@example.com", user_metadata: { full_name: "Asha Rao" }, app_metadata: {}, created_at: "2026-10-22T10:00:00Z" }) }));
  const logout: string[] = [];
  await context.route("https://test.supabase.co/auth/v1/logout**", (r) => { logout.push(r.request().url()); return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" }, body: "" }); });
  await page.goto("/customer/");
  await expect(page.getByTestId("signed-in")).toHaveText("Signed in as Asha Rao");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect.poll(() => logout.length).toBe(1);
  expect(net.calls.signups).toBeGreaterThanOrEqual(1);
});
