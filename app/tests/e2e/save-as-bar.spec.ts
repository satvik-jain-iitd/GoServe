// Story 1422 (board NC2-SheetNoCount, owner 13 Nov 2026): on the Address details sheet "Save as" is the joined bar (design system N7), not three pills.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "./screensSteps";

const toSheet = async (page: Page, context: Parameters<(typeof STEPS)["first-open-pin"]>[0]) => {
  await STEPS["first-open-pin"](context, page, "/customer/");
  await page.getByRole("button", { name: "Confirm & proceed" }).click();
  await expect(page.getByRole("dialog", { name: "Address details" })).toBeVisible();
};
const SHEET_MAX = 513;   // the sheet with the pills, measured at 360 x 640 on dev ac75847 (512.3 px)
const bar = (page: Page) => page.getByRole("group", { name: "Save as" });

test("B1 the sheet shows one group Save as with three buttons in one row, each the same width, no gap between them", async ({ page, context }) => {
  await toSheet(page, context);
  const parts = bar(page).getByRole("button");
  await expect(parts).toHaveText(["Home", "Office", "Other"]);
  const boxes = await Promise.all([0, 1, 2].map(async (i) => (await parts.nth(i).boundingBox())!));
  for (const b of boxes) { expect(Math.abs(b.y - boxes[0].y)).toBeLessThanOrEqual(0.5); expect(Math.abs(b.width - boxes[0].width)).toBeLessThanOrEqual(1); }
  expect(Math.abs(boxes[1].x - (boxes[0].x + boxes[0].width))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(boxes[2].x - (boxes[1].x + boxes[1].width))).toBeLessThanOrEqual(1.5);
});

test("B2 Home is chosen at first; a tap on Office moves the fill", async ({ page, context }) => {
  await toSheet(page, context);
  await expect(bar(page).getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true");
  await bar(page).getByRole("button", { name: "Office" }).click();
  await expect(bar(page).getByRole("button", { name: "Office" })).toHaveAttribute("aria-pressed", "true");
  await expect(bar(page).getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "false");
});

test("B3 Other shows Name this place", async ({ page, context }) => {
  await toSheet(page, context);
  await expect(page.getByLabel("Name this place")).toHaveCount(0);
  await bar(page).getByRole("button", { name: "Other" }).click();
  await expect(page.getByLabel("Name this place")).toBeVisible();
});

test("B4 measured in the browser: 44 px high, and the chosen fill is the lime-soft token with on-surface 14 px 600 text", async ({ page, context }) => {
  await toSheet(page, context);
  const home = bar(page).getByRole("button", { name: "Home" });
  expect(Math.round((await bar(page).boundingBox())!.height)).toBe(44);
  const got = await home.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.background = "var(--gs-lime-soft)"; probe.style.color = "var(--md-on-surface)";
    document.body.appendChild(probe);
    const want = getComputedStyle(probe); const c = getComputedStyle(el);
    const r = { fill: c.backgroundColor === want.backgroundColor, ink: c.color === want.color, size: c.fontSize, weight: c.fontWeight };
    probe.remove();
    return r;
  });
  expect(got).toEqual({ fill: true, ink: true, size: "14px", weight: "600" });
});

test("B5 at 360 x 640 the sheet is not taller than the pills made it (the Save address button stays in view)", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await toSheet(page, context);
  const save = (await page.getByRole("button", { name: "Save address" }).boundingBox())!;
  expect(save.y + save.height).toBeLessThanOrEqual(640);
  const sheet = (await page.getByRole("dialog", { name: "Address details" }).boundingBox())!;
  expect(sheet.height).toBeLessThanOrEqual(SHEET_MAX);
});
