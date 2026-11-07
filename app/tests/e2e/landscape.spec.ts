// Story #983: a phone turned sideways (iOS cannot be locked) must look like the app, not a narrow column in the middle of a wide empty screen.
// At 844 x 390 the shell fills the width and nothing scrolls sideways. At desktop size the centred column stays.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const KITCHEN = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4", phone: "9876500011", pin_codes: ["110024"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" };
const measure = async (page: Page) => page.evaluate(() => {
  const frame = document.querySelector("main.frame, .shell") as HTMLElement;
  const logo = document.querySelector(".ui-logo, .ui-lockup") as HTMLElement | null;
  return { logoH: logo ? Math.round(logo.getBoundingClientRect().height) : 0, frame: Math.round(frame.getBoundingClientRect().width), scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth };
});

for (const [name, path] of [["customer menu", "/customer/"], ["kitchen tickets", "/kitchen/"], ["rider deliveries", "/rider/"], ["admin city", "/admin/"]] as const) {
  test(`S1 ${name} at 844 x 390 fills the width with no sideways scroll`, async ({ page, context }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    const net = await setup(context, page, name === "kitchen tickets" ? [order("placed")] : []);
    net.state.kitchen = "k-1"; net.state.admin = true; net.state.kitchens = [KITCHEN];
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const m = await measure(page);
    expect(m.frame, `${name}: the shell is wider than 700 px`).toBeGreaterThan(700);
    expect(m.logoH, `${name}: the logo does not swallow the short screen`).toBeLessThan(100);
    expect(m.scrollW, `${name}: no horizontal overflow`).toBeLessThanOrEqual(m.innerW);
  });
}

test("S2 a desktop browser at 1280 x 800 keeps the centred 28 rem column", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setup(context, page);
  await page.goto("/customer/");
  await page.waitForLoadState("networkidle");
  const m = await measure(page);
  expect(m.frame).toBeLessThanOrEqual(448);
});

test("S3 a phone upright (390 x 844) is unchanged: the shell is the screen width", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(context, page);
  await page.goto("/customer/");
  await page.waitForLoadState("networkidle");
  const m = await measure(page);
  expect(m.frame).toBe(390);
});
