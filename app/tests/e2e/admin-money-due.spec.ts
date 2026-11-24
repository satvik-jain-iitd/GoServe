// Story #1319: a Delivered order with money due shows "! Money not collected · reason" under its sub line; the tag does not move.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const D = (id: string, over: object = {}) => ({ ...order("delivered"), id, kitchen_id: "k-1", customer_name: "Asha", cancel_reason: null, ...over });
const A = "0a0a0a0a-1111-4222-8333-444444444444", B = "0f0f0f0f-1111-4222-8333-444444444444";

test("a row with money due shows the line in red bold; a row without prints nothing", async ({ page, context }) => {
  const net = await setup(context, page, [D(A, { money_due_reason: "will_pay_later" }), D(B)]);
  net.state.admin = true;
  await page.goto("/admin/");
  const due = page.getByRole("button", { name: /^Open order 0a0a0a0a/ }), fine = page.getByRole("button", { name: /^Open order 0f0f0f0f/ });
  await expect(due).toContainText("! Money not collected · Will pay later");
  await expect(fine).not.toContainText("Money not collected");
  const line = due.locator(".ui-order-due");
  expect(await line.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
});

for (const [reason, note, words] of [["says_already_paid", null, "Says it is already paid"], ["did_not_have_money", null, "Did not have the money"], ["other", "Gate was locked", "Gate was locked"]]) {
  test(`reason ${reason} reads ${words}`, async ({ page, context }) => {
    const net = await setup(context, page, [D(A, { money_due_reason: reason, money_due_note: note })]);
    net.state.admin = true;
    await page.goto("/admin/");
    await expect(page.getByRole("button", { name: /^Open order 0a0a0a0a/ })).toContainText(`! Money not collected · ${words}`);
  });
}

test("the Delivered tag keeps its top with and without the line", async ({ page, context }) => {
  const net = await setup(context, page, [D(A, { money_due_reason: "will_pay_later" }), D(B)]);
  net.state.admin = true;
  await page.goto("/admin/");
  const top = async (id: string) => { const r = page.getByRole("button", { name: new RegExp(`^Open order ${id}`) }); const t = (await r.locator(".ui-tag").boundingBox())!.y, b = (await r.boundingBox())!.y; return t - b; };
  expect(await top("0a0a0a0a")).toBe(await top("0f0f0f0f"));
});

test("a database without the money-due columns still lists the orders, with no mark", async ({ page, context }) => {
  const net = await setup(context, page, [D(A), D(B)]);
  net.state.admin = true;
  await context.route((u) => u.pathname.endsWith("/rest/v1/orders") && u.search.includes("money_due_reason"), (route) =>
    route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "42703", message: "column orders.money_due_reason does not exist" }) }));
  await page.goto("/admin/");
  await expect(page.getByRole("button", { name: /^Open order 0a0a0a0a/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open order 0f0f0f0f/ })).toBeVisible();
  await expect(page.getByText("Money not collected")).toHaveCount(0);
});
