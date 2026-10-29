// Story #771 (E22 #249): Google Play needs a way to delete the account from inside the app. The You screen has "Delete my account" with a confirm sheet; the
// database function delete_my_account() does the work (checked on dev in scripts/test_delete_account.py). The privacy page has a "Delete your account" section.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const openSheet = async (page: import("@playwright/test").Page) => {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "You" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  return page.getByRole("dialog", { name: "Delete your account?" });
};

test("S1 the You screen has the row, and it opens the confirm sheet with the board's words", async ({ page, context }) => {
  await setup(context, page);
  const sheet = await openSheet(page);
  await expect(sheet).toHaveClass(/\bui-sheet\b/);
  await expect(sheet.getByText("Your orders, saved details and Google link are deleted. This cannot be undone.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Keep it" })).toBeVisible();
});

test("S2 Keep it closes the sheet and deletes nothing", async ({ page, context }) => {
  const net = await setup(context, page);
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Keep it" }).click();
  await expect(sheet).toHaveCount(0);
  expect(net.calls.rpc.filter((r) => r.name === "delete_my_account")).toEqual([]);
});

test("S3 Delete calls delete_my_account once, clears this phone and lands on the first screen with Account deleted", async ({ page, context }) => {
  const net = await setup(context, page);
  const sheet = await openSheet(page);
  await page.evaluate(() => localStorage.setItem("gs-test-keep", "x"));
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Account deleted" })).toBeVisible();
  expect(net.calls.rpc.filter((r) => r.name === "delete_my_account")).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("gs-test-keep"))).toBeNull();
});

test("S4 a refusal (an order on its way) is shown in the sheet and the account stays", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.deleteReply = { ok: false, error: "order_active", message: "Wait until your order is delivered, then delete the account." };
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Wait until your order is delivered, then delete the account.");
  await expect(page.getByRole("status").filter({ hasText: "Account deleted" })).toHaveCount(0);
});

test("S5 the kitchen, rider and admin apps never show the row", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();
  await expect(page.getByText("Delete my account")).toHaveCount(0);
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "You are offline" }).or(page.getByRole("heading", { name: "Waiting for a delivery" }))).toBeVisible();
  await expect(page.getByText("Delete my account")).toHaveCount(0);
  net.state.admin = true;
  await page.goto("/admin/");
  await expect(page.getByRole("button", { name: "City", exact: true })).toBeVisible();
  await expect(page.getByText("Delete my account")).toHaveCount(0);
});

test("S6 the privacy page has a Delete your account section at #delete, and no draft or test-version words", async ({ page, request }) => {
  const html = await (await request.get("/privacy/")).text();
  expect(html).toContain('id="delete"');
  expect(html).toContain("Delete your account");
  expect(html).toContain("Delete my account");
  expect(html).toContain("avinturetech@gmail.com");
  for (const w of ["draft", "lawyer-checked", "Test version, 25 October"]) expect(html.toLowerCase()).not.toContain(w.toLowerCase());   // the Play reviewer reads "draft" as an unfinished policy
  expect(html).toContain("Last updated: 29 October 2026");
  expect(html).toContain("test version of the app only");   // the PostHog line stays: a true fact, nothing softened
  await page.goto("/privacy/#delete");
  await expect(page.getByRole("heading", { name: "Delete your account" })).toBeInViewport();
});
