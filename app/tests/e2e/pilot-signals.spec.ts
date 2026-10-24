// Story H14 (#204): the app sends the signals behind the pilot numbers. The network is answered by the test.
import { test, expect } from "@playwright/test";
import { ID, order, setup } from "./helpers";

async function placeOrder(page: import("@playwright/test").Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}

test("S1 after place the app tells the server the phone platform (android: the test browser is a Pixel)", async ({ page, context }) => {
  const net = await setup(context, page);
  await placeOrder(page);
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "order_platform").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "order_platform")!.body).toEqual({ p_order: ID, p_platform: "android" });
});

test.describe("on an iPhone", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
  test("S1 the platform is ios", async ({ page, context }) => {
    const net = await setup(context, page);
    await placeOrder(page);
    await expect.poll(() => net.calls.rpc.filter((c) => c.name === "order_platform").length).toBe(1);
    expect(net.calls.rpc.find((c) => c.name === "order_platform")!.body.p_platform).toBe("ios");
  });
});

test("S2 tapping Call on the rider card records one customer.call for that order", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.riderCard = { name: "Ravi", phone: "9876500000" };
  await page.goto("/customer/");
  await page.getByRole("link", { name: "Call Ravi" }).click({ noWaitAfter: true }).catch(() => {});   // tel: has no page to open
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "customer_call").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "customer_call")!.body).toEqual({ p_order: ID });
});

test("S3 the rider's Not delivered asks first, then sends rider_refused and the order leaves the list", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.rider = { user_id: "7e57ab1e-0000-4000-8000-0000000000a1", name: "Rider", online: true, lat: null, lng: null };
  let asked = "";
  page.on("dialog", (d) => { asked = d.message(); void d.accept(); });
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Not delivered 0f0f0f0f" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "rider_refused").length).toBe(1);
  expect(net.calls.rpc.find((c) => c.name === "rider_refused")!.body).toEqual({ p_order: ID });
  expect(asked).toMatch(/not delivered/i);
  await expect(page.getByText("No deliveries yet.")).toBeVisible();
});

test("S3 saying no to the question sends nothing", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.rider = { user_id: "7e57ab1e-0000-4000-8000-0000000000a1", name: "Rider", online: true, lat: null, lng: null };
  page.on("dialog", (d) => void d.dismiss());
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Not delivered 0f0f0f0f" }).click();
  await page.waitForTimeout(500);
  expect(net.calls.rpc.filter((c) => c.name === "rider_refused")).toHaveLength(0);
});
