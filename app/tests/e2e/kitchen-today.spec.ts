// Story 1456 (board KD1, epic 1453): the Today tab says Today; the dishes come first, then Cash from riders, then Account, then Send feedback.
import { test, expect, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const NOW = new Date();
const DELIVERED = { ...order("delivered", NOW.toISOString(), new Date(NOW.getTime() - 30 * 60_000).toISOString()), rider_id: SESSION, kitchen_id: "k-1", delivered_at: NOW.toISOString() };
const today = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page, [DELIVERED]);
  net.state.kitchen = "k-1";
  net.state.riders = [{ user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null, updated_at: NOW.toISOString() }];
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  return net;
};
const y = async (page: Page, l: ReturnType<Page["locator"]>) => (await l.first().boundingBox())!.y;

test("KD1a given the Today tab, the header reads Today", async ({ page, context }) => {
  await today(page, context);
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Kitchen" })).toHaveCount(0);
});

test("KD1b the first dish row sits above the first rider cash row, and Sign out sits below the last one; the two titles show", async ({ page, context }) => {
  await today(page, context);
  const dish = page.getByRole("button", { name: "Mark Butter Chicken sold out" });
  const cash = page.getByRole("button", { name: "Confirm hand-over Amit Kumar" });
  const out = page.getByRole("button", { name: "Sign out" });
  await expect(cash).toBeVisible();
  expect(await y(page, dish)).toBeLessThan(await y(page, cash));
  expect(await y(page, out)).toBeGreaterThan(await y(page, cash));
  expect(await y(page, page.getByRole("switch", { name: "Open for orders" }))).toBeLessThan(await y(page, dish));
  const cashTitle = page.getByRole("heading", { name: "Cash from riders" }), account = page.getByRole("heading", { name: "Account" });
  await expect(cashTitle).toBeVisible();
  await expect(account).toBeVisible();
  expect(await y(page, cashTitle)).toBeLessThan(await y(page, cash));
  expect(await y(page, account)).toBeLessThan(await y(page, out));
  expect(await y(page, page.getByRole("button", { name: "Send feedback" }))).toBeGreaterThan(await y(page, out));
});

test("KD1c Confirm hand-over, Sold out and Sign out work as before", async ({ page, context }) => {
  const net = await today(page, context);
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Confirm hand-over Amit Kumar" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "kitchen_handover").map((c) => c.body)).toEqual([{ p_rider: SESSION }]);
  await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0]).toMatchObject({ method: "PATCH", body: { available: false } });
});
