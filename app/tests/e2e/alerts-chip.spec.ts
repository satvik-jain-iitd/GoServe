// Stories 1375, 1376, 1377 (board N0c-AlertsChip, owner's frame A, 13 Nov 2026): the alerts ask says why, shows a sample alert that drops in once under the bell, and says it can be turned on later.
// 1377 (the small label repeated the title) is already solved by 1404: the slip has no top line at all, so no "Set up" label is added back.
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "./screensSteps";

const PATH = "/customer/";
const sample = (page: Page) => page.locator(".ui-alert-sample");

test("N1 (1375) the reason line under the title and the later line above the buttons", async ({ page, context }) => {
  await STEPS["alerts-ask"](context, page, PATH);
  const slip = page.getByRole("group", { name: "Order alerts" });
  await expect(slip.getByText("We tell you when your food leaves the kitchen and when it is at your door.")).toBeVisible();
  await expect(slip.getByText("You can turn this on later in You.")).toBeVisible();
  const later = (await slip.getByText("You can turn this on later in You.").boundingBox())!;
  const ghost = (await page.getByRole("button", { name: "I'll check the app myself" }).boundingBox())!;
  expect(later.y + later.height).toBeLessThanOrEqual(ghost.y);   // above the two buttons; the green button stays last
});

test("N2 (1376) a sample alert under the bell, hidden from screen readers, that drops in once", async ({ page, context }) => {
  await STEPS["alerts-ask"](context, page, PATH);
  await expect(sample(page)).toBeVisible();
  await expect(sample(page)).toContainText("GOSERVE · now");
  await expect(sample(page)).toContainText("Your thali is at the door");
  await expect(sample(page)).toHaveAttribute("aria-hidden", "true");
  const anim = await sample(page).evaluate((e) => { const c = getComputedStyle(e); return { name: c.animationName, count: c.animationIterationCount }; });
  expect(anim).toEqual({ name: "ui-alert-drop", count: "1" });   // plays once in the app; the board repeats it only so it can be seen
  const bell = (await page.locator(".ui-bellbadge").boundingBox())!;
  const card = (await sample(page).boundingBox())!;
  const ghost = (await page.getByRole("button", { name: "I'll check the app myself" }).boundingBox())!;
  expect(card.y).toBeGreaterThanOrEqual(bell.y + bell.height);   // under the bell
  expect(card.y + card.height).toBeLessThanOrEqual(ghost.y - 8);   // never over the buttons
});

test("N3 (1376) reduce motion: the sample is just there, no animation", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await STEPS["alerts-ask"](context, page, PATH);
  await expect(sample(page)).toBeVisible();
  expect(await sample(page).evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
});

test("N4 (1377) no small label repeats the title", async ({ page, context }) => {
  await STEPS["alerts-ask"](context, page, PATH);
  await expect(page.getByRole("group", { name: "Order alerts" }).getByText("Order alerts", { exact: true })).toHaveCount(0);
});

test("N6 a short phone (360 by 649): the sample is left out so nothing scrolls (the story's own rule: fit, or hide the sample there)", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 649 });
  await STEPS["alerts-ask"](context, page, PATH);
  await expect(page.getByText("You can turn this on later in You.")).toBeVisible();
  await expect(sample(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(false);
});

for (const [w, h] of [[360, 780], [390, 844]]) {
  test(`N5 at ${w} by ${h} the sample sits between the bell and the buttons, and the page does not scroll`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await STEPS["alerts-ask"](context, page, PATH);
    await page.waitForTimeout(1200);   // the drop has ended
    const bell = (await page.locator(".ui-bellbadge").boundingBox())!;
    const card = (await sample(page).boundingBox())!;
    const later = (await page.getByText("You can turn this on later in You.").boundingBox())!;
    expect(card.y).toBeGreaterThanOrEqual(bell.y + bell.height + 8);
    expect(card.y + card.height).toBeLessThanOrEqual(later.y - 8);
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(false);
    await page.screenshot({ path: `test-results/alerts-chip-${w}x${h}.png` });
  });
}

// Review of PR 1464: on short phones the later line sat 4 px on the bell; the forced break left "kitchen" alone at 320 wide.
for (const [w, h] of [[360, 649], [320, 568]] as const) {
  test(`N7 at ${w} x ${h} the later line keeps 8 px or more under the bell`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await STEPS["alerts-ask"](context, page, PATH);
    const bell = (await page.locator(".ui-bellbadge").boundingBox())!;
    const later = (await page.getByText("You can turn this on later in You.").boundingBox())!;
    expect(later.y - (bell.y + bell.height)).toBeGreaterThanOrEqual(8);
    const slip = (await page.locator(".ui-slip").first().boundingBox())!;
    expect(Math.abs(bell.y + bell.height / 2 - slip.y - 238)).toBeLessThanOrEqual(2);   // the shared hero line on a short phone: top 190 + half of 96, as the pin
  });
}

test("N8 at 320 wide the reason line has no word alone on a line, and no forced break", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await STEPS["alerts-ask"](context, page, PATH);
  const why = page.getByText("We tell you when your food leaves the kitchen and when it is at your door.");
  expect(await why.locator("br").count()).toBe(0);
  const words = await why.evaluate((e) => {   // the words on each line, measured with a range per word
    const lines = new Map<number, number>();
    const text = e.firstChild as Text;
    const re = /\S+/g; let m;
    while ((m = re.exec(text.data))) { const r = document.createRange(); r.setStart(text, m.index); r.setEnd(text, m.index + m[0].length); const y = Math.round(r.getBoundingClientRect().top); lines.set(y, (lines.get(y) ?? 0) + 1); }
    return [...lines.values()];
  });
  expect(Math.min(...words)).toBeGreaterThan(1);
});
