// Story 1670: at the door, a rider whose order was paid online sees "Delivered" (no Collect payment); cash and UPI-at-door keep "Collect".
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const PIN = { drop_lat: 28.5677, drop_lng: 77.2432 };
const NEAR = { latitude: 28.56842, longitude: 77.2432 };
const job = (extra: Record<string, unknown> = {}) => ({ ...order("out_for_delivery"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", total_paise: 64000, ...PIN, ...extra });
const atDoor = async (page: Page, context: Parameters<typeof setup>[0], o: Record<string, unknown>) => {
  await context.grantPermissions(["geolocation"]); await context.setGeolocation(NEAR);
  const net = await setup(context, page, [o]);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  await page.goto("/rider/");
  await page.locator(".ui-bottom button", { hasText: "Arriving · tell Rahul" }).click();
  await expect(page.getByRole("region", { name: "Say at the door" })).toBeVisible();
  return net;
};
const box = async (page: Page) => (await page.locator(".ui-bottom button").boundingBox())!;

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`PO1 ${w}x${h} paid online: Delivered in the box of Collect, marks delivered at once, no Collect payment`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await atDoor(page, context, job({ payment_method: "cash" }));
    await expect(page.locator(".ui-bottom button")).toHaveText("Collect");
    const collect = await box(page);
    await page.close();
    const p2 = await context.newPage();
    await p2.setViewportSize({ width: w, height: h });
    const net = await atDoor(p2, context, job({ payment_method: "online", paid_at: "2020-01-01T10:00:00Z" }));
    await expect(p2.locator(".ui-bottom button")).toHaveText("Delivered");
    const del = await box(p2);
    for (const k of ["x", "y", "width", "height"] as const) expect(Math.abs(del[k] - collect[k])).toBeLessThanOrEqual(0.5);
    if (w === 390) { await p2.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1670-delivered-online-390x844.png" }); }
    await p2.locator(".ui-bottom button").click();
    await expect(p2.getByRole("region", { name: /^Collect payment/ })).toHaveCount(0);
    await expect(p2.locator(".ui-stamp.delivered")).toBeVisible();
    expect(net.calls.status.at(-1)!.body).toMatchObject({ action: "deliver" });
    expect(net.calls.status.at(-1)!.body.method).toBeUndefined();
  });
}

test("PO2 online but not paid, and UPI at the door, keep Collect and open Collect payment", async ({ page, context }) => {
  await atDoor(page, context, job({ payment_method: "online", paid_at: null }));
  await expect(page.locator(".ui-bottom button")).toHaveText("Collect");
  await page.locator(".ui-bottom button").click();
  await expect(page.getByRole("region", { name: /^Collect payment/ })).toBeVisible();
});
