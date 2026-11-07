// Story #940: placing and every order step carry the signed-in user, never a field the phone chooses. The wrong user is refused by the server (S4) and shown its line.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

test("S1 the n8n order webhook is not called for a status tap, a Yes or a place", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  let v1 = 0;
  await context.route("https://orders.test/**", async (route) => { if (route.request().method() !== "OPTIONS") v1++; return route.fallback(); });
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect.poll(() => net.calls.status.length).toBe(1);
  expect(net.calls.status).toHaveLength(1);
  expect(JSON.stringify(net.calls.status[0].body)).not.toMatch(/session_id|actor/);   // nothing the phone could choose to be someone else
  expect(v1).toBe(0);
});

test("S2 a kitchen tap the server refuses shows the server's line and changes nothing", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  net.state.reply = { status: 403, body: { ok: false, error: "not_allowed", message: "You cannot do this step on this order." } };
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByText("You cannot do this step on this order.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept 0f0f0f0f" })).toBeVisible();   // still at Accept
});

