// Story #1118 (board Y4b-YouPageCards, owner picked 9 Nov): "You" is a full page, not a sheet. Back arrow and the title, a lime name card with Edit, white cards by group,
// and a last card with the two risky actions in the error colour and no arrow. Page background #EEEFE6. Nothing of the menu shows behind it.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

async function open(page: Page, context: Parameters<typeof setup>[0]) {
  const net = await setup(context, page);
  net.state.customer = { user_id: "u", name: "Asha Rao", phone: "9876543210", address: "Flat 4, Green Park", pin_code: "110016" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^You: / }).click();
  await expect(page.getByRole("heading", { name: "You", exact: true })).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
}
const pageOf = (page: Page) => page.locator(".ui-you-page");

test("S1 Back returns to the menu", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(pageOf(page)).toHaveCount(0);
});

test("S2 the page fills the viewport on the page background, with no strip of the menu at the top or the bottom", async ({ page, context }) => {
  await open(page, context);
  const vp = page.viewportSize()!;
  const box = (await pageOf(page).boundingBox())!;
  expect([Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)]).toEqual([0, 0, vp.width, vp.height]);
  expect(await pageOf(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(238, 239, 230)");
  for (const y of [2, vp.height - 2]) expect(await page.evaluate(([x, yy]) => !!document.elementFromPoint(x, yy)?.closest(".ui-you-page"), [vp.width / 2, y])).toBe(true);
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeHidden();   // nothing of the menu is reachable behind it
});

test("S3 the rows sit in white cards by group, and the lime card has the name and Edit", async ({ page, context }) => {
  await open(page, context);
  const cards = pageOf(page).locator(".ui-you-card");
  await expect(cards.filter({ hasText: "Asha Rao" }).first()).toHaveClass(/lime/);
  await expect(cards.filter({ hasText: "Asha Rao" }).getByRole("button", { name: "Edit delivery details" })).toBeVisible();
  const group = (names: string[]) => cards.filter({ has: page.getByText(names[0], { exact: true }) });
  await expect(group(["Saved addresses"]).getByText("Your orders", { exact: true })).toBeVisible();
  await expect(group(["Order alerts"]).getByText("Look", { exact: true })).toBeVisible();
  await expect(group(["Send feedback"]).getByText("Saved addresses")).toHaveCount(0);
});

test("S4 the risky actions are the last card, in the error colour, with no arrow", async ({ page, context }) => {
  await open(page, context);
  const cards = pageOf(page).locator(".ui-you-card");
  const last = cards.last();
  const out = last.getByRole("button", { name: "Sign out of this phone" }), del = last.getByRole("button", { name: "Delete my account" });
  await expect(out).toBeVisible();
  await expect(del).toBeVisible();
  await expect(last.locator(".go")).toHaveCount(0);
  const err = await page.evaluate(() => { const e = document.createElement("i"); e.style.color = "var(--md-error)"; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; });
  for (const b of [out, del]) expect(await b.evaluate((el) => getComputedStyle(el).color)).toBe(err);
  const [prev, l] = [(await cards.nth((await cards.count()) - 2).boundingBox())!, (await last.boundingBox())!];
  expect(Math.abs(l.y - (prev.y + prev.height) - 24)).toBeLessThanOrEqual(2);   // 24 px of air above it
});

test("S5 Look has two chips only; a fresh install is Day, and a saved By the clock falls back to Day", async ({ page, context }) => {
  await context.addInitScript(() => { try { localStorage.setItem("gs-theme", "clock"); } catch { /* blocked */ } });
  await open(page, context);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("day");
  await expect(pageOf(page).getByRole("region", { name: "Look" }).getByRole("button")).toHaveText(["Day", "Night"]);
  await expect(page.getByRole("button", { name: /By the clock/ })).toHaveCount(0);
});
