// Story #242: every app shows only its board, every word says what a customer, rider, cook or admin would say, and the menu opens at once for a saved pin.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const SAVED_KITCHEN = { id: "k-1", name: "Hauz Khas Kitchen", pin_codes: ["110016"], lat: null, lng: null, phone: null, open: true, active: true, opens_at: null, closes_at: null };

test("D1 D2 nothing sits under any board: no title, no floating Feedback, no legal footer", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  net.state.admin = true;
  for (const path of ["/customer/", "/rider/", "/kitchen/", "/admin/"]) {
    await page.goto(path);
    await expect(page.locator("main.frame")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^GoServe( Rider| Kitchen| Admin)?$/ })).toHaveCount(0, { timeout: 2000 });
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Feedback", exact: true })).toHaveCount(0);
    await expect(page.locator(".shell.below")).toHaveText("");   // the shell only mounts the feedback sheet; nothing to scroll to
  }
});

test("D2 D10 the customer You tab ends with Send feedback and then Privacy · Terms", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "You (Account)", exact: true }).click();
  await expect(page.getByText("Used on your bill")).toBeVisible();
  const rows = page.locator(".ui-scroll");
  await expect(rows.getByRole("button", { name: "Send feedback" })).toBeVisible();
  const legal = rows.locator(".ui-legal");
  await expect(legal.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
  await expect(legal.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms/");
  expect(await page.evaluate(() => { const b = document.querySelector(".ui-scroll button:has(span)")!; const l = document.querySelector(".ui-legal")!; return b.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING; })).toBeTruthy();   // legal comes after
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
});

test("D3 D11 D12 the staff apps have a Send feedback row that opens the sheet, and the tabs read Delivery / Today / Me and New / Cooking / Today", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.kitchen = "k-1";
  net.state.admin = true;
  await page.goto("/rider/");
  for (const name of ["Delivery", "Today", "Me"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.getByText("Your phone")).toBeVisible();
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await page.goto("/kitchen/");
  for (const name of ["New", "Cooking", "Today"]) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByText(/cash today/)).toBeVisible();
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByTestId("tile-cash")).toContainText("Cash today");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Feedback" })).toBeVisible();
});

test("D4 D5 the pin screen has one button and plain words", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "See the menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Track an order" })).toHaveCount(0);
  await expect(page.getByText("We serve a few pin codes for now.")).toHaveCount(0);
  await expect(page.getByText("Cash only")).toHaveCount(0);
  await page.getByLabel("Your pin code").fill("110099");
  await page.getByRole("button", { name: "See the menu" }).click();
  await expect(page.getByText("Not in 110099 yet. We saved your pin. We will tell you when we come.")).toBeVisible();
});

test("D6 D7 D8 D9 D13 the bill, placed and orders screens use the agreed words", async ({ page, context }) => {
  await setup(context, page);   // the helper seeds the pin 110016
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  await expect(page.getByText("Pay the rider cash at the door.")).toBeVisible();
  await expect(page.locator(".ui-slip-head").getByText("Cash", { exact: true })).toHaveCount(0);
  await expect(page.locator("header .meta").getByText("Cash", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to menu" }).click();
  await page.getByRole("button", { name: "My orders", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await expect(page.getByText("Your orders show here, newest first. No sign-in needed.")).toBeVisible();
});

test("D7 D13 the placed screen says the kitchen has the order and offers Back to menu", async ({ page, context }) => {
  await setup(context, page, [{ ...order("placed", new Date().toISOString(), new Date().toISOString()), reminder: "ask" }]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByText("The kitchen has your order. This page updates on its own.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to menu" })).toBeVisible();
  await expect(page.getByText("Tap Yes when you have it")).toHaveCount(0);
});

test("D15 a phone with a saved pin and a saved kitchen sees the menu before the network answers", async ({ page, context }) => {
  await setup(context, page);
  await context.addInitScript((k) => { localStorage.setItem("gs-pin", "110016"); localStorage.setItem("gs-kitchen", JSON.stringify({ pin: "110016", kitchen: k })); }, SAVED_KITCHEN);
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => { release = r; });
  await context.route("https://test.supabase.co/rest/v1/kitchens**", async (route) => { await held; await route.fallback(); });   // the kitchens read hangs until the test lets it go
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible({ timeout: 3000 });
  await expect(page.getByLabel("Your pin code")).toHaveCount(0);
  release();
});
