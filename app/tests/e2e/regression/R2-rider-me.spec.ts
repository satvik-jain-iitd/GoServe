// Regression: the rider's Me tab (board MC1, stories 1445 and 1440). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "../helpers";

test.use({ viewport: { width: 360, height: 640 } });

test("TC R2.1 on a small phone the Me rows fit with no scroll, the road opens Google Maps and the call dials the kitchen", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("delivered"), rider_id: SESSION }]);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  net.state.kitchens = [{ id: "k", name: "Tau Ka Dhaba", address: null, phone: "9876500000", lat: 28.5677, lng: 77.2432, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" }];
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.getByRole("link", { name: "Kitchen ka raasta" })).toHaveAttribute("href", /destination=28\.5677,77\.2432&travelmode=two-wheeler$/);
  await expect(page.getByRole("link", { name: "Kitchen ko call" })).toHaveAttribute("href", "tel:9876500000");
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(640);
  const out = (await page.getByRole("button", { name: "Sign out" }).boundingBox())!;
  expect(out.y + out.height).toBeLessThanOrEqual(640);
});
