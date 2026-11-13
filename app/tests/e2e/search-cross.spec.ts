// Story 1248 (boards SX1-SearchOneCross and SX1L-SearchLongLine, owner 13 Nov 2026): one small grey cross inside a search box, our own; the browser's cross is hidden.
// A tap empties the box and keeps the focus. The cross never closes anything; on the map, Back closes the search. A long line slides left; the box never grows.
import { test, expect, type Page, type Locator } from "@playwright/test";
import { setup } from "./helpers";

const LONG = "Shri Ram Colony near the old water tank behind Sharma General Store on the second lane past the temple gate ok".padEnd(120, " x").slice(0, 120);
const box = (input: Locator) => input.locator("xpath=..");

async function menu(page: Page, context: Parameters<typeof setup>[0]) {
  await setup(context, page);
  await page.goto("/customer/");
  return page.getByRole("searchbox", { name: "Search dishes" });
}
async function map(page: Page, context: Parameters<typeof setup>[0]) {
  await setup(context, page, [], { pin: null });
  await context.addInitScript(() => { try { localStorage.setItem("gs_alerts_asked", "1"); } catch { /* blocked */ } });
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Enter address manually" }).click();
  return page.getByRole("searchbox", { name: "Search an area or address" });
}
// getComputedStyle cannot read the browser's own cross, so the check reads the page's rules: one hides it.
async function deliver(page: Page, context: Parameters<typeof setup>[0]) {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^(Home|Deliver to)\b/ }).first().click();
  return page.getByRole("searchbox", { name: "Search an area or address" });
}
const browserCross = (input: Locator) => input.evaluate(() => [...document.styleSheets].flatMap((sh) => [...sh.cssRules]).some((r) => r instanceof CSSStyleRule && r.selectorText.includes("::-webkit-search-cancel-button") && r.style.display === "none") ? "none" : "shown");

for (const [where, go] of [["menu", menu], ["map", map], ["deliver to", deliver]] as const) {
  test(`X1 ${where}: no words, no cross; with words, exactly one cross at the right end inside the box; the browser's cross is hidden`, async ({ page, context }) => {
    const input = await go(page, context);
    await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
    await input.fill("dal");
    const cross = page.getByRole("button", { name: "Clear search" });
    await expect(cross).toHaveCount(1);
    const b = (await box(input).boundingBox())!, c = (await cross.locator("svg").boundingBox())!, i = (await input.boundingBox())!;   // the drawn cross; its 44 px touch area may reach past the edge
    expect(c.x).toBeGreaterThanOrEqual(i.x + i.width - 1);   // right of the words
    expect(c.x + c.width).toBeLessThanOrEqual(b.x + b.width + 1);
    expect(c.y).toBeGreaterThanOrEqual(b.y - 1);
    expect(c.y + c.height).toBeLessThanOrEqual(b.y + b.height + 1);   // inside the box
    expect(Math.abs((c.y + c.height / 2) - (i.y + i.height / 2))).toBeLessThanOrEqual(2);   // centred on the line of words (review of PR 1433: it sat low in Deliver to)
    expect(await browserCross(input)).toBe("none");
  });

  test(`X2 ${where}: a tap on the cross empties the box and keeps the focus in it`, async ({ page, context }) => {
    const input = await go(page, context);
    await input.fill("dal");
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(input).toBeVisible();   // the cross closed nothing
  });

  test(`X3 ${where}: 120 letters: the box keeps its height, the cross keeps its place and is not covered, and the 44 px touch area`, async ({ page, context }) => {
    const input = await go(page, context);
    const h0 = (await box(input).boundingBox())!.height;
    await input.fill("dal");
    const c3 = (await page.getByRole("button", { name: "Clear search" }).boundingBox())!;
    await input.fill(LONG);
    await input.press("End");
    expect((await box(input).boundingBox())!.height).toBe(h0);
    const c = (await page.getByRole("button", { name: "Clear search" }).boundingBox())!;
    expect(c).toEqual(c3);
    expect(c.width).toBeGreaterThanOrEqual(44);
    expect(c.height).toBeGreaterThanOrEqual(44);
    const top = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest("button")?.getAttribute("aria-label") ?? null, [c.x + c.width / 2, c.y + c.height / 2]);
    expect(top).toBe("Clear search");
    const i = (await input.boundingBox())!;
    expect(i.x + i.width).toBeLessThanOrEqual(c.x + 1);   // the words never run under the cross
    expect(await input.evaluate((el: HTMLInputElement) => el.scrollLeft)).toBeGreaterThan(0);   // the words slid left: the end stays in view
  });
}

test("X4 map: the Back arrow closes the search and keeps the map", async ({ page, context }) => {
  const input = await map(page, context);
  await input.fill("dal");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(input).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close search" })).toHaveCount(0);   // one cross only: the old close cross is gone
});

test("X5 map: the phone's Back closes the open search first and keeps the map; the next Back closes the map", async ({ page, context }) => {
  const input = await map(page, context);
  await input.fill("dal");
  await page.goBack();
  await expect(input).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("region", { name: "Pin map" })).toHaveCount(0);
});
