// Story #953: a disabled control gives no feedback of any kind: no press animation, no highlight, nothing under the finger reacts. (iOS keeps :active on disabled buttons.)
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 a disabled .ui-btn ignores touch: pointer-events none, no tap highlight, and no press animation while the mouse is down on it", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  const place = page.getByRole("button", { name: /Place order/ });
  await expect(place).toBeDisabled();
  const css = await place.evaluate((e) => { const s = getComputedStyle(e); return { pe: s.pointerEvents, hl: getComputedStyle(e).getPropertyValue("-webkit-tap-highlight-color") }; });
  expect(css.pe).toBe("none");
  expect(css.hl.replace(/\s/g, "")).toMatch(/^rgba\(0,0,0,0\)$|^transparent$/);
  const b = (await place.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  expect(await place.evaluate((e) => getComputedStyle(e).transform)).toBe("none");
  await page.mouse.up();
});

test("S2 an enabled .ui-btn still gives its press animation", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  const view = page.getByRole("button", { name: /View bill/ });
  await expect(view).toBeEnabled();
  const b = (await view.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  expect(await view.evaluate((e) => getComputedStyle(e).transform)).not.toBe("none");
  await page.mouse.up();
});
