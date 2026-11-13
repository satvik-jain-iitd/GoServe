// Stories 1445 and 1440 (board MC1, owner, 13 Nov 2026): the rider's Me tab, rows only: Phone, Kitchen ka raasta, Kitchen ko call, Send feedback, Sign out.
// "Kitchen ka raasta" opens Google Maps to the kitchen's own point (two-wheeler); "Kitchen ko call" dials it. No point or no phone: no row. The number is never shown.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const KITCHEN = { id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", lat: 28.5677, lng: 77.2432, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
const me = async (context: BrowserContext, page: Page, kitchen: Record<string, unknown> = KITCHEN, orders: object[] = [{ ...order("delivered"), rider_id: SESSION }]) => {
  const net = await setup(context, page, orders);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  net.state.kitchens = [kitchen];
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.getByText("9810011223")).toBeVisible();
  return net;
};
const rows = (page: Page) => page.locator(".ui-today > .ui-row").allTextContents();

test("MC1a a kitchen with a point and a phone: the rows Phone, Kitchen ka raasta, Kitchen ko call, Send feedback, Sign out, in that order", async ({ page, context }) => {
  await me(context, page);
  await expect.poll(() => rows(page)).toEqual(["Phone9810011223", "Kitchen ka raasta›", "Kitchen ko call›", "Send feedback›", "Sign out›"]);
  await expect(page.getByRole("switch", { name: "Online" })).toHaveCount(0);   // board MC1: the Online switch and the Today line are gone from Me
});

test("MC1b Kitchen ka raasta opens Google Maps with the kitchen's point as the destination in two-wheeler mode", async ({ page, context }) => {
  await me(context, page);
  const link = page.getByRole("link", { name: "Kitchen ka raasta" });
  await expect(link).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=28.5677,77.2432&travelmode=two-wheeler");
  await expect(link).toHaveAttribute("target", "_blank");
});

test("MC1c Kitchen ko call dials the kitchen, and the kitchen's number is never shown as digits", async ({ page, context }) => {
  await me(context, page);
  await expect(page.getByRole("link", { name: "Kitchen ko call" })).toHaveAttribute("href", "tel:9876500000");
  await expect(page.getByText("9876500000")).toHaveCount(0);
});

test("MC1d a kitchen with no point and no phone: neither row shows", async ({ page, context }) => {
  await me(context, page, { ...KITCHEN, lat: null, lng: null, phone: null });
  await expect.poll(() => rows(page)).toEqual(["Phone9810011223", "Send feedback›", "Sign out›"]);
});

test("MC1e a rider on his first day, no order yet, and one kitchen: the rows show for that kitchen", async ({ page, context }) => {
  await me(context, page, KITCHEN, []);
  await expect(page.getByRole("link", { name: "Kitchen ka raasta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kitchen ko call" })).toBeVisible();
});
