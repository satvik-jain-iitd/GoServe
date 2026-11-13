// Story 1324 (boards PL3, PL4; owner design rule 11, 10 Nov 2026): white paper is torn at the TOP only. The tear is a row of a fixed count of whole teeth
// (25, as on the boards) in the paper's own colour with the slip's hairline, stretched to the slip's width so no tooth is ever cut. The bottom stays straight.
// On the bill and on the order slip (the tracker). Staff slips, the first-open steps and the status rows keep their straight top.
import { test, expect, type Page } from "@playwright/test";
import { setup, order } from "./helpers";
import { STEPS } from "./screensSteps";

async function check(page: Page, slipName: string | RegExp) {
  const slip = page.getByRole("region", { name: slipName });
  await expect(slip).toBeVisible();
  const tear = slip.locator(".ui-torn-top");
  await expect(tear).toBeVisible();
  const [t, s] = [(await tear.boundingBox())!, (await slip.boundingBox())!];   // the slip box includes its side hairlines
  expect(Math.abs(t.width - s.width)).toBeLessThanOrEqual(1);   // stretched to the slip's width
  expect(Math.abs(t.x - s.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(t.y + t.height - s.y)).toBeLessThanOrEqual(1);   // sits right on the slip's top, no gap
  expect(Math.round(t.height)).toBe(10);
  const teeth = await tear.locator("polygon").evaluate((p) => (p.getAttribute("points") ?? "").trim().split(/\s+/).filter((xy) => xy.endsWith(",0")).length);
  expect(teeth).toBe(25);   // a fixed count of whole teeth
  expect(await tear.getAttribute("preserveAspectRatio")).toBe("none");
  const st = await slip.evaluate((e) => { const c = getComputedStyle(e); const b = getComputedStyle(e, "::before"); return { top: c.borderTopWidth, bottom: c.borderBottomStyle, before: b.display }; });
  expect(st).toEqual({ top: "0px", bottom: "solid", before: "none" });   // the straight bottom; the old hairline top is gone
}

for (const [w, h] of [[320, 640], [390, 844], [412, 915]]) {
  test(`T1 at ${w} wide the bill slip is torn at the top in 25 whole teeth, straight at the bottom`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await STEPS.bill(context, page, "/customer/");
    await check(page, "Items");
  });
  test(`T2 at ${w} wide the order slip is torn at the top in 25 whole teeth, straight at the bottom`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await setup(context, page, [order("preparing")]);
    await page.goto("/customer/");
    await check(page, "Order");
  });
}

test("T3 a staff slip and the welcome slip keep a straight top", async ({ page, context }) => {
  await setup(context, page, [], { guest: true });
  await page.goto("/customer/");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.locator(".ui-torn-top")).toHaveCount(0);
});
