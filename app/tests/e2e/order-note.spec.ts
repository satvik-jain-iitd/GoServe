// Story #935: the customer adds one optional note (allergies, spice, no onion, up to 200 characters) on the Bill; the kitchen reads it on the New row, the order sheet and the Cooking ticket.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const NOTE = "Less spicy please. No peanuts, allergy.";
const toBill = async (page: import("@playwright/test").Page) => {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
};

test("S1 the Bill has an optional note box that holds 200 characters, and the note goes with the order", async ({ page, context }) => {
  const net = await setup(context, page);
  await toBill(page);
  const box = page.getByLabel("Anything the kitchen should know?");
  await expect(box).toBeVisible();
  await expect(box).toHaveAttribute("maxlength", "200");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();   // optional: empty is fine
  await box.fill(NOTE);
  await expect(page.getByText(`${NOTE.length} of 200`)).toBeVisible();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect.poll(() => net.calls.place.length).toBe(1);
  expect(net.calls.place[0].body.instructions).toBe(NOTE);
});

test("S2 no note sends no note", async ({ page, context }) => {
  const net = await setup(context, page);
  await toBill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect.poll(() => net.calls.place.length).toBe(1);
  expect(net.calls.place[0].body.instructions).toBeUndefined();
});

test("S3 the server's plain line for a too long note shows on the Bill", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.reply = { status: 422, body: { ok: false, error: "instructions_too_long", message: "Keep the note to 200 characters." } };
  await toBill(page);
  await page.getByLabel("Anything the kitchen should know?").fill("x");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Keep the note to 200 characters.")).toBeVisible();
});

test("S4 the kitchen reads the note on the New row, the order sheet and the Cooking ticket; an order with no note shows none", async ({ page, context }) => {
  const withNote = { ...order("placed"), customer_name: "Rahul Sharma", instructions: NOTE };
  const net = await setup(context, page, [withNote, { ...order("placed"), id: "0c0c0c0c-0000-0000-0000-000000000000" }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.locator(".ui-ticket", { hasText: "No. 0f0f0f0f" })).toContainText(NOTE);
  await expect(page.locator(".ui-ticket", { hasText: "No. 0c0c0c0c" })).not.toContainText("Note");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await expect(sheet.getByText("Rahul says")).toBeVisible();
  await expect(sheet.getByText(NOTE)).toBeVisible();
  await sheet.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Ticket" })).toBeVisible();
  await expect(page.getByText("Rahul says")).toBeVisible();
  await expect(page.getByText(NOTE)).toBeVisible();
});

test("S5 an order with no note has no says block on the sheet", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("dialog", { name: "Order 0f0f0f0f" }).getByText(/says$/)).toHaveCount(0);
});
