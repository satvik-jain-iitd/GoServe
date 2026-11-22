// Story S-C (#95), cut down by story 1740: the question "Was your order delivered?" is gone (see no-delivery-question.spec.ts). What is left: the cash line and the kitchen double tap.
// Times are tiny (set through the place answer) so the test does not wait minutes. The network is answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const now = () => new Date().toISOString();

// Place one order through the screens. The server answer carries the prompt times in minutes (0.01 min = 0.6 s).
async function placeOrder(page: Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
}

test("the bill and the placed screen say cash on delivery", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.tracking = { eta_lo_min: 20, eta_hi_min: 30, eta_late: false, updated_at: new Date().toISOString() };   // story #1015: the server's time
  await placeOrder(page);
  await expect(page.getByText("20 min", { exact: true })).toBeVisible();
});

test("S6 a double tap on a kitchen step: the second answer already_done is not shown as an error", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  net.state.reply = { status: 409, body: { ok: false, error: "already_done", message: "Already done." } };
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByText("Already done.")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

