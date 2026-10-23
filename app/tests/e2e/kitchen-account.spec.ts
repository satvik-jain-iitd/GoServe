// Story S-M5 (#132): a kitchen worker signed in with the kitchen's Google account sees every order of the kitchen, no join link.
// Supabase is answered by the test; the real policy is checked on dev (scripts/check_kitchen_staff.sql notes in docs/tests/test-cases.md).
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

test("S1 a staff user on /kitchen/ reads the orders of the kitchen, not of one session", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("placed"), session_id: "7e57ab1e-0000-4000-8000-0000000000c3", kitchen_id: "k-1" }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();   // another customer's session, no join link
  expect(net.calls.orderReads.some((u) => u.includes("kitchen_id=eq.k-1"))).toBe(true);
  expect(net.calls.orderReads.some((u) => u.includes("session_id=eq."))).toBe(false);
});

test("S2 a user who is not staff keeps the session view", async ({ page, context }) => {
  const net = await setup(context, page, []);
  await page.goto("/kitchen/");
  await expect(page.getByText("No orders yet.")).toBeVisible();
  expect(net.calls.orderReads.some((u) => u.includes("session_id=eq."))).toBe(true);
  expect(net.calls.orderReads.some((u) => u.includes("kitchen_id=eq."))).toBe(false);
});

test("S3 the customer app never switches to the kitchen view, even for a staff user", async ({ page, context }) => {
  const net = await setup(context, page, []);
  net.state.kitchen = "k-1";
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(net.calls.orderReads.some((u) => u.includes("kitchen_id=eq."))).toBe(false);
});

test("S4 the kitchen, rider and ops apps start a Google sign-in, not a link", async ({ page, context }) => {
  await setup(context, page, []);
  const hits: string[] = [];
  await context.route("https://test.supabase.co/auth/v1/**", (r) => { hits.push(new URL(r.request().url()).pathname); return r.fallback(); });
  await context.route("https://test.supabase.co/auth/v1/authorize**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>Google</h1>" }));   // supabase-js sends the browser to /auth/v1/authorize
  await page.goto("/kitchen/");
  await page.getByTestId("google-signin").click();
  await expect(page).toHaveURL(/\/auth\/v1\/authorize\?.*provider=google/);
  expect(hits).not.toContain("/auth/v1/user/identities/authorize");
});

test("S5 a staff user on /rider/ reads the orders of the kitchen too (story #135)", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("ready"), session_id: "7e57ab1e-0000-4000-8000-0000000000c3", kitchen_id: "k-1" }]);
  net.state.kitchen = "k-1";
  await page.goto("/rider/");
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toBeVisible();
  expect(net.calls.orderReads.some((u) => u.includes("kitchen_id=eq.k-1"))).toBe(true);
});
