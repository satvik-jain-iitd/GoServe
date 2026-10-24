// Story D3 (#162): kitchen, rider and admin screens on the design system. Staff work with wet hands and one thumb, so the main buttons are big.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const open = async (page: Page, role: "Kitchen" | "Rider") => {
  await page.goto("/");
  await page.getByRole("button", { name: role }).click();
  await expect(page.getByRole("heading", { name: role === "Rider" ? /^Deliver/ : "New", exact: true })).toBeVisible();   // H11: the rider's Job tab, the kitchen's New tab
};

test("S1 a kitchen ticket has big type and a big main button", async ({ page, context }) => {
  await setup(context, page, [order("placed")]);
  await open(page, "Kitchen");
  const button = page.getByRole("button", { name: "Accept 0f0f0f0f" });
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  const size = await page.getByText("2 × Butter Chicken").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(18);
});

test("S2 the rider's main buttons are big and as wide as the ticket", async ({ page, context }) => {
  await setup(context, page, [order("ready")]);
  await open(page, "Rider");
  const button = page.getByRole("button", { name: "Pick up 0f0f0f0f" });
  const box = (await button.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(56);
  const ticket = (await page.locator(".ui-slip").boundingBox())!;   // H11: the delivery slip
  expect(box.width).toBeGreaterThan(ticket.width * 0.8);
});

test("S2 the rider can call the customer when the order has a phone, and sees no link when it has none", async ({ page, context }) => {
  await setup(context, page, [{ ...order("out_for_delivery"), customer_name: "Asha", customer_phone: "9876543210" }]);
  await open(page, "Rider");
  await expect(page.getByRole("link", { name: "Call Asha" })).toHaveAttribute("href", "tel:9876543210");
});

test("S2 no phone, no call link", async ({ page, context }) => {
  await setup(context, page, [order("out_for_delivery")]);
  await open(page, "Rider");
  await expect(page.getByRole("button", { name: "Arriving 0f0f0f0f" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Call/ })).toHaveCount(0);
});

test("S3 the admin Numbers tab has the day tiles and one row per kitchen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.numbers = [
    { day: "2026-10-23", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen", orders: 5, delivered: 3, cancelled: 1, cash_paise: 90000 },
    { day: "2026-10-23", kitchen_id: "k-2", kitchen_name: "Rohini Kitchen", orders: 2, delivered: 2, cancelled: 0, cash_paise: 40000 },
  ];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();   // H12: board A8, tiles then rows
  for (const id of ["tile-orders", "tile-delivered", "tile-cash", "tile-kitchens"]) await expect(page.getByTestId(id)).toBeVisible();
  const rows = page.getByRole("region", { name: "Per kitchen" }).locator(".ui-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("₹900");
});

test("S4 the kitchen's own controls use full-size buttons", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  net.state.menu = [{ id: "d1", name: "Butter Chicken", price_paise: 32000, available: true }];
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();   // H11: the Kitchen tab
  const open = page.getByRole("switch", { name: "Open for orders" });
  await expect(open).toBeVisible();
  expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(32);   // the Ink switch is 32 px tall in a 64 px row
  expect((await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
