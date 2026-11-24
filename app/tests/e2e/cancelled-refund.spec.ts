// Story #1793: a paid-online order GoServe cancelled shows the true money fact; pay-at-door keeps "Nothing to pay".
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { order, setup } from "./helpers";

const SHOT = "/Users/satvikjain/Documents/GoServe/.worktrees/hc/.claude/handoff/dev/1793-money-390x844.png";
const base = { ...order("cancelled", "2020-01-01T10:02:00Z"), cancelled_by: "admin", cancel_reason: "Out of stock tonight.", total_paise: 64000 };

async function open(context: BrowserContext, page: Page, extra: object) {
  await setup(context, page, [{ ...base, ...extra }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.locator(".ui-declined")).toBeVisible();
}

test("R1 paid online + admin cancel: Coming back to you, two full-ink lines, no grey line", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(context, page, { payment_method: "online", paid_at: "2026-11-10T09:00:00Z" });
  await expect(page.locator(".ui-slip-total")).toContainText("Coming back to you");
  await expect(page.locator(".ui-slip-total")).toContainText("₹640");
  await expect(page.locator(".ui-slip-total")).not.toContainText("Nothing to pay");
  const ps = page.locator(".ui-declined p");
  await expect(ps.nth(1)).toHaveText("“Out of stock tonight.”");
  await expect(ps.nth(2)).toHaveText("You paid ₹640 online.");
  await expect(ps.nth(3)).toHaveText("It comes back in 5 to 7 days.");
  await expect(ps.nth(4)).toHaveClass(/ui-declined-when/);
  await expect(page.getByText("Nothing was charged.")).toHaveCount(0);
  await page.screenshot({ path: SHOT });
});

test("R2 pay at door + admin cancel keeps Nothing to pay and Nothing was charged (AC-2)", async ({ page, context }) => {
  await open(context, page, {});
  await expect(page.locator(".ui-slip-total")).toContainText("Nothing to pay");
  await expect(page.getByText("Nothing was charged.")).toBeVisible();
  await expect(page.getByText("You paid")).toHaveCount(0);
});

test("R3 History row of the paid cancelled order shows no price, same true word (AC-3)", async ({ page, context }) => {
  await setup(context, page, [{ ...base, payment_method: "online", paid_at: "2026-11-10T09:00:00Z" }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  const row = page.locator(".ui-order-row").first();
  await expect(row).toContainText("Cancelled");
  await expect(row).not.toContainText("₹");
});

test("R4 the total row keeps its box (no layout shift)", async ({ page, context }) => {
  await open(context, page, {});
  const a = (await page.locator(".ui-slip-total").boundingBox())!;
  await open(context, page, { payment_method: "online", paid_at: "2026-11-10T09:00:00Z" });
  const b = (await page.locator(".ui-slip-total").boundingBox())!;
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
});
