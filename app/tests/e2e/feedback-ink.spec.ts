// Story (canvas audit, 29 Oct 2026, boards F1 and F3): the Feedback sheet is built from the design system (ui-sheet, ui-btn, ui-field), not the old
// sheet-back, btn and demobar classes. The words are unchanged. The sending itself is tested in feedback.spec.ts.
import { test, expect } from "@playwright/test";
import { scan, setup } from "./helpers";

test("S1 the sheet uses the ui classes, with Send as ui-btn and Close as ui-btn ghost, and none of the old classes", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "You" }).click();
  await page.getByRole("button", { name: /Send feedback/ }).click();
  const sheet = page.getByRole("dialog", { name: "Feedback" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveClass(/\bui-sheet\b/);
  await expect(page.locator(".ui-sheet-back")).toHaveCount(1);
  await expect(sheet.getByRole("button", { name: "Send" })).toHaveClass(/\bui-btn\b/);
  await expect(sheet.getByRole("button", { name: "Close" })).toHaveClass(/\bui-btn\b.*\bghost\b|\bghost\b.*\bui-btn\b/);
  expect(await page.locator(".sheet-back, .demobar, .sheet, #root .btn").count()).toBe(0);   // the old classes are gone from the page while the sheet is open
});

test("S2 the words are the boards' words and the sheet has no serious contrast or role violation", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "You" }).click();
  await page.getByRole("button", { name: /Send feedback/ }).click();
  const sheet = page.getByRole("dialog", { name: "Feedback" });
  await expect(sheet.getByLabel("What happened?")).toBeVisible();
  await expect(sheet.getByLabel("What were you doing?")).toBeVisible();
  await expect(sheet.getByLabel("Add a screenshot (optional)")).toBeVisible();
  await expect(sheet.getByText("Take one with your phone buttons first, then pick it here.")).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
