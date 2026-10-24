// Story #50: the rider screen and the customer's live tracker. The network and the live socket are answered by the test (see helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const openRider = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Rider" }).click();
  await expect(page.getByRole("heading", { name: "Rider" })).toBeVisible();
};

test("S1 rider steps: pick up, arriving, delivered each send their step as the rider", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  await openRider(page);
  await expect(page.getByText("Order 0f0f0f0f")).toBeVisible();
  await page.getByRole("button", { name: "Pick up 0f0f0f0f" }).click();
  await expect(page.getByText("On the way", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Arriving 0f0f0f0f" }).click();
  await expect(page.getByRole("button", { name: "Arriving 0f0f0f0f" })).toBeDisabled();   // done once; the server refuses a repeat
  await page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true }).click();
  await expect(page.getByText("Order 0f0f0f0f")).toHaveCount(0);   // delivered orders leave the rider list
  expect(net.calls.status.map((c) => c.body)).toEqual([
    { action: "status", session_id: SESSION, order_id: ID, to_status: "out_for_delivery", actor: "rider" },
    { action: "event", session_id: SESSION, order_id: ID, event: "order.arriving", actor: "rider" },
    { action: "status", session_id: SESSION, order_id: ID, to_status: "delivered", actor: "rider" },
  ]);
  expect(net.calls.status[0].headers["x-gs-token"]).toBe("demo-token");
});

test("S1 the rider list shows only ready and on-the-road orders, and a live order appears", async ({ page, context }) => {
  const net = await setup(context, page, [order("preparing")]);
  await openRider(page);
  await expect(page.getByText("No deliveries yet.")).toBeVisible();
  net.push("UPDATE", order("ready", "2020-01-01T10:05:00Z"));
  await expect(page.getByRole("button", { name: "Pick up 0f0f0f0f" })).toBeVisible({ timeout: 5000 });
});

test("S1 a refused rider tap shows the reason", async ({ page, context }) => {
  const net = await setup(context, page, [order("ready")]);
  net.state.reply = { status: 409, body: { ok: false, error: "illegal_step", message: "That step is not allowed now." } };
  await openRider(page);
  await page.getByRole("button", { name: "Pick up 0f0f0f0f" }).click();
  await expect(page.getByRole("alert")).toHaveText("That step is not allowed now.");
});

test("S1 Arriving was already sent (the page was reloaded): it is treated as done, not as an error", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery")]);
  net.state.reply = { status: 409, body: { ok: false, error: "already_done", message: "Already done." } };
  await openRider(page);
  await page.getByRole("button", { name: "Arriving 0f0f0f0f" }).click();
  await expect(page.getByRole("button", { name: "Arriving 0f0f0f0f" })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("S2 the customer sees every step live, without a refresh, and it ends at Delivered", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();

  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  const current = page.locator('[aria-current="step"]');
  await expect(current).toHaveText("Placed");
  await expect(page.getByRole("list", { name: "Order progress" }).getByRole("listitem")).toHaveCount(6);

  const steps: [string, string][] = [["accepted", "Accepted"], ["preparing", "Cooking"], ["ready", "Ready"], ["out_for_delivery", "On the way"], ["delivered", "Delivered"]];
  for (const [i, [status, label]] of steps.entries()) {
    net.push("UPDATE", order(status, `2020-01-01T10:0${i + 1}:00Z`));
    if (label === "Delivered") await expect(page.getByRole("heading", { name: "Delivered" })).toBeVisible({ timeout: 6000 });
    else await expect(current).toHaveText(label, { timeout: 6000 });
  }
  await expect(page.getByText(/Thank you for eating with GoServe/)).toBeVisible();
});
