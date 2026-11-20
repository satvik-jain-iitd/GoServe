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
  await page.evaluate(() => { localStorage.setItem("gs-test-keep", "x"); localStorage.setItem("gs-loc-ok", "1"); });   // story 1610: the mark "a find worked on this phone" goes too
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Account deleted" })).toBeVisible();
  expect(net.calls.rpc.filter((r) => r.name === "delete_my_account")).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem("gs-test-keep"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("gs-loc-ok"))).toBeNull();
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

// Story 1705 (owner, 20 Nov 2026, epic 1690): the two answers are an equal half and half pair, 56 px tall, red "Delete" left, "Keep it" right. Both are asleep while it deletes and keep their size.
type Pg = import("@playwright/test").Page;
const rect = (loc: ReturnType<Pg["locator"]>) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const lines = (loc: ReturnType<Pg["locator"]>) => loc.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return { text: r.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }; });
const settle = (page: Pg) => page.evaluate(async () => { await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))); });
for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S7 the answers are an equal pair, 56 px tall: red Delete left, Keep it right, same top, together as wide as the sheet's content, one line each (${w}x${h})`, async ({ page, context }) => {
    await setup(context, page);
    await page.setViewportSize({ width: w, height: h });
    const sheet = await openSheet(page);
    await settle(page);
    const del = sheet.getByRole("button", { name: "Delete", exact: true }), keep = sheet.getByRole("button", { name: "Keep it", exact: true });
    const [a, b, s] = [await rect(del), await rect(keep), await rect(sheet)];
    const pad = await sheet.evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth), r: parseFloat(c.paddingRight) + parseFloat(c.borderRightWidth) }; });
    expect(a.x).toBeLessThan(b.x);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.h - 56)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.h - 56)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.x - (s.x + pad.l))).toBeLessThanOrEqual(1);
    expect(Math.abs(b.x + b.w - (s.x + s.w - pad.r))).toBeLessThanOrEqual(1);
    for (const l of [await lines(del), await lines(keep)]) expect(l.text).toBeLessThan(1.5 * l.line);
  });
}

test("S8 while it deletes both buttons are asleep and keep their size, and Deleting stays on one line", async ({ page, context }) => {
  await setup(context, page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.route("**/rpc/delete_my_account*", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.fallback(); });
  const sheet = await openSheet(page);
  await settle(page);
  const del = sheet.getByRole("button", { name: "Delete", exact: true }), keep = sheet.getByRole("button", { name: "Keep it", exact: true });
  const [a0, b0] = [await rect(del), await rect(keep)];
  await del.click();
  const busy = sheet.getByRole("button", { name: "Deleting…" });
  await expect(busy).toBeDisabled();
  await expect(keep).toBeDisabled();
  const [a1, b1] = [await rect(busy), await rect(keep)];
  expect(a1).toEqual(a0);
  expect(b1).toEqual(b0);
  const l = await lines(busy);
  expect(l.text).toBeLessThan(1.5 * l.line);
});
