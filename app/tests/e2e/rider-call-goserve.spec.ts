// Story 1318 (owner approved help-frames): "Call GoServe" sits on the same line as "Could not deliver?", right side. No number: no link. Nothing else moves.
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const job = () => ({ ...order("out_for_delivery"), rider_id: SESSION, customer_name: "Rahul Verma", total_paise: 64000 });
const open = async (page: Page, context: Parameters<typeof setup>[0], phone: string | null) => {
  const net = await setup(context, page, [job()]);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  net.state.supportPhone = phone;
  await page.goto("/rider/");
  await expect(page.getByRole("button", { name: "Could not deliver?" })).toBeVisible();
  if (phone) await expect(page.getByRole("link", { name: "Call GoServe" })).toBeVisible();
};
const boxes = async (page: Page) => ({
  slip: await page.getByRole("region", { name: /^Order / }).boundingBox(),
  cant: await page.getByRole("button", { name: "Could not deliver?" }).boundingBox(),
  bottom: await page.locator(".ui-bottom").boundingBox(),
});

test("1318 the link dials the support number, is on the Could not deliver line, 44px tall, and moves nothing", async ({ page, context }) => {
  await open(page, context, null);
  await expect(page.getByRole("link", { name: "Call GoServe" })).toHaveCount(0);
  const before = await boxes(page);
  await page.goto("about:blank");
  await open(page, context, "9000000000");
  const after = await boxes(page);
  expect(after).toEqual(before);
  const link = page.getByRole("link", { name: "Call GoServe" });
  await expect(link).toHaveAttribute("href", "tel:9000000000");
  const l = (await link.boundingBox())!;
  expect(l.height).toBeGreaterThanOrEqual(44);
  expect(l.y).toBeCloseTo(after.cant!.y, 0);
  expect(l.x).toBeGreaterThan(after.cant!.x + after.cant!.width);
  expect(l.x + l.width).toBeLessThanOrEqual(after.slip!.x + after.slip!.width);
});

test("1318 where the Call support button already shows (after Arriving), the link is not shown: one door per screen", async ({ page, context }) => {
  const net = await setup(context, page, [job()]);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  net.state.supportPhone = "9000000000";
  net.state.arrivingAt = "2026-11-13T09:12:00Z";
  await page.goto("/rider/");
  await expect(page.getByRole("link", { name: "Call support" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call GoServe" })).toHaveCount(0);
});
