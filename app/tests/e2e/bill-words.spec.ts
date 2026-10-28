// Story #659 (copy audit D.5 to D.8 and table L): the words on the bill and the one customer line for every server refusal.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const toBill = async (page: import("@playwright/test").Page) => {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
};
const fill = async (page: import("@playwright/test").Page) => {
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
};

test("S1 the address label says where the food goes, and the cash note is gone", async ({ page, context }) => {
  await setup(context, page);
  await toBill(page);
  await expect(page.getByLabel("Address · food gets delivered here")).toBeVisible();
  await expect(page.getByLabel("Phone · the rider calls this")).toBeVisible();
  await expect(page.getByText("Pay the rider cash at the door.")).toHaveCount(0);
});

test("S2 while name, phone or address is missing one line says so above the grey button, and it goes when all three are filled", async ({ page, context }) => {
  await setup(context, page);
  await toBill(page);
  const line = page.getByText("Add your name, phone and address to place the order.");
  await expect(line).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
  await fill(page);
  await expect(line).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("S3 while the order is sent the button reads Placing…", async ({ page, context }) => {
  await setup(context, page);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await context.route("https://orders.test/**", async (route) => { if (route.request().method() === "POST") await gate; await route.fallback(); });
  await toBill(page);
  await fill(page);
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("button", { name: /Placing…/ })).toBeDisabled();
  release();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
});

for (const [name, reply, line] of [
  ["a kitchen that just closed", { status: 409, body: { ok: false, error: "kitchen_closed", message: "The kitchen is closed right now. Please try again later." } }, "The kitchen closed just now. Check back later."],
  ["the session cap", { status: 429, body: { ok: false, error: "session_order_cap", message: "Too many orders in this demo session." } }, "That is the most orders one phone can place today."],
  ["a bad order", { status: 400, body: { ok: false, error: "invalid_request", message: "The order is not valid." } }, "Something in the bill did not go through. Check it and try again."],
  ["an unknown action", { status: 400, body: { ok: false, error: "unknown", message: "Unknown action." } }, "Something went wrong. Please try again."],
] as const) {
  test(`S4 ${name}: the customer sees our line, never the server's`, async ({ page, context }) => {
    const net = await setup(context, page);
    net.state.reply = reply as never;
    await toBill(page);
    await fill(page);
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByRole("alert")).toHaveText(line);
    await expect(page.locator("body")).not.toContainText(reply.body.message);
  });
}
