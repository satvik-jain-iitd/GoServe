// Story #1792 layer admin: an admin can cancel an order at any status before delivered; the reason is required.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const ORDER = (over: object = {}) => ({ ...order("placed"), kitchen_id: "k-1", customer_name: "Asha", customer_phone: "9876543210", cancel_reason: null, ...over });
const open = (page: any) => page.getByRole("button", { name: /^Open order 0f0f0f0f/ }).click();

for (const status of ["ready", "out_for_delivery"]) {
  test(`S1 at ${status} the admin sees the Cancel order action`, async ({ page, context }) => {
    const net = await setup(context, page, [ORDER({ status })]);
    net.state.admin = true;
    await page.goto("/admin/");
    await open(page);
    await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();
  });
}

for (const status of ["delivered", "cancelled"]) {
  test(`S2 at ${status} there is no Cancel order action`, async ({ page, context }) => {
    const net = await setup(context, page, [ORDER({ status })]);
    net.state.admin = true;
    await page.goto("/admin/");
    await open(page);
    await expect(page.getByRole("heading", { name: "Order", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });
}

test("S3 an empty reason is refused with the named message and no rpc call", async ({ page, context }) => {
  const net = await setup(context, page, [ORDER({ status: "ready" })]);
  net.state.admin = true;
  await page.goto("/admin/");
  await open(page);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await expect(page.getByRole("alert")).toContainText("Give a reason for the cancel.");
  expect(net.calls.rpc.filter((c) => c.name === "cancel_order")).toHaveLength(0);
});

test("S4 after a cancel at out_for_delivery the order leaves the live list", async ({ page, context }) => {
  const net = await setup(context, page, [ORDER({ status: "out_for_delivery" })]);
  net.state.admin = true;
  await page.route("**/rest/v1/rpc/cancel_order", (r) => {
    net.state.orders = net.state.orders.map((o: any) => ({ ...o, status: "cancelled", cancel_reason: "rider fell" }));
    return r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "null" });
  });
  await page.goto("/admin/");
  await expect(page.getByRole("region", { name: "Live" }).getByText("Asha")).toBeVisible();
  await open(page);
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByLabel("Reason").fill("rider fell");
  await page.getByRole("button", { name: "Confirm cancel" }).click();
  await page.getByRole("button", { name: "Back to orders" }).click();
  await expect(page.getByRole("region", { name: "Live" }).getByText("Asha")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Done" }).getByText("Asha")).toBeVisible();
});
