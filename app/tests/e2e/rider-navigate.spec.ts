// Story #1182 part 2: the rider's job card, on the way to the customer, opens Google Maps at the customer's exact pin. No pin on the order: no Navigate, the address text stays.
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const KITCHEN = { id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500000", pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" };
const job = (status: string, pin: { drop_lat: number | null; drop_lng: number | null }) => ({ ...order(status), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", ...pin });

test("S1 on the way, Navigate opens Google Maps directions at the order's exact pin", async ({ page, context }) => {
  const net = await setup(context, page, [job("out_for_delivery", { drop_lat: 28.5677, drop_lng: 77.2432 })]);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
  const nav = page.getByRole("link", { name: "Navigate" });
  await expect(nav).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=28.5677,77.2432&travelmode=two-wheeler");
  await expect(nav).toHaveAttribute("target", "_blank");
});

test("S2 an order with no pin shows no Navigate, and the address text stays", async ({ page, context }) => {
  const net = await setup(context, page, [job("out_for_delivery", { drop_lat: null, drop_lng: null })]);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
  await expect(page.getByText("Flat 4, Green Park")).toBeVisible();
  await expect(page.getByRole("link", { name: "Navigate" })).toHaveCount(0);
});

test("S3 before pickup there is no Navigate yet", async ({ page, context }) => {
  const net = await setup(context, page, [job("ready", { drop_lat: 28.5677, drop_lng: 77.2432 })]);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "Pick up" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Navigate" })).toHaveCount(0);
});

test("S4 the customer's note shows on the card when the order has one", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...job("out_for_delivery", { drop_lat: 28.5677, drop_lng: 77.2432 }), instructions: "Ring the bell twice, gate is blue" }]);
  net.state.kitchens = [KITCHEN];
  await page.goto("/rider/");
  await expect(page.getByText("Ring the bell twice, gate is blue")).toBeVisible();
});
