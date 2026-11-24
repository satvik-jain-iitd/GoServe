// Story #1660: one "Help" link in the order screen head, right of the Live mark. It dials the admin's support number; none set, no link. Nothing else moves.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { order, setup } from "./helpers";

const DIR = "/Users/satvikjain/Documents/GoServe/.worktrees/hc/.claude/handoff/dev";

async function open(context: BrowserContext, page: Page, phone: string | null, o = order("placed")) {
  const net = await setup(context, page, [o]);
  net.state.supportPhone = phone;
  await page.goto("/customer/");
}
const ready = (page: Page) => expect(page.locator(".ui-head h1")).toBeVisible();
const boxes = async (page: Page) => ({
  head: await page.locator(".ui-head").boundingBox(),
  h1: await page.locator(".ui-head h1").boundingBox(),
  back: await page.locator(".ui-head button").first().boundingBox(),
  slip: await page.locator(".ui-slip").boundingBox(),
});

test("H1 Help dials the support number, 44px tap box, right of Live, inside the screen", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(context, page, "9000000000", order("accepted", "2020-01-01T10:01:00Z"));
  await ready(page);
  const help = page.locator(".ui-head").getByRole("link", { name: "Help" });
  await expect(help).toHaveAttribute("href", "tel:9000000000");
  await expect(help).toHaveClass(/ui-link/);
  const b = (await help.boundingBox())!;
  expect(b.height).toBeGreaterThanOrEqual(44);
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.x + b.width).toBeLessThanOrEqual(390 - 8);
  const live = (await page.locator(".ui-livemark").boundingBox())!;
  expect(b.x).toBeGreaterThan(live.x + live.width - 1);
  await page.screenshot({ path: `${DIR}/1660-help-390x844.png` });
});

test("H2 no number set: no link", async ({ page, context }) => {
  await open(context, page, null);
  await ready(page);
  await expect(page.getByRole("link", { name: "Help" })).toHaveCount(0);
});

for (const [w, h] of [[390, 844], [360, 640]]) {
  test(`H3 the link moves nothing else and the title does not wrap (${w}x${h})`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    const o = order("accepted", "2020-01-01T10:01:00Z");
    await open(context, page, null, o);
    await ready(page);
    const a = await boxes(page);
    await open(context, page, "9000000000", o);
    await ready(page);
    await expect(page.getByRole("link", { name: "Help" })).toBeVisible();
    const b = await boxes(page);
    for (const k of ["head", "back", "slip"] as const) for (const m of ["x", "y", "width", "height"] as const) expect(Math.abs(b[k]![m] - a[k]![m]), `${k}.${m}`).toBeLessThanOrEqual(1);
    expect(Math.abs(b.h1!.x - a.h1!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.h1!.height - a.h1!.height)).toBeLessThanOrEqual(1);   // "Your order" stays on one line
    await expect(page.locator(".ui-head h1")).toHaveText("Your order");
    if (w === 360) await page.screenshot({ path: `${DIR}/1660-help-360x640.png` });
  });
}

test("H4 Help shows on a delivered order and a cancelled one", async ({ page, context }) => {
  await open(context, page, "9000000000", order("delivered", "2020-01-01T10:30:00Z"));
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.locator(".ui-head").getByRole("link", { name: "Help" })).toBeVisible();
  await open(context, page, "9000000000", order("cancelled", "2020-01-01T10:02:00Z"));
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.locator(".ui-head").getByRole("link", { name: "Help" })).toBeVisible();
});
