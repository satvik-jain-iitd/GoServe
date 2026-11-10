// Regression, screen 7: C6d Pin outside our area. Cases: .claude/handoff/qa/screens/07-C6d.md (epic #1196, story #1197). Reached with the shared step STEPS["pin-map-far"].
import { test, expect } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const box = async (loc: import("@playwright/test").Locator) => (await loc.boundingBox())!;
const invite = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Invite the founders here" });   // the far pin's main button

test("TC 7.1 pin a place no kitchen serves: yellow distance, red Not in our area yet, filled Invite the founders here, no Confirm", async ({ page, context }) => {
  await STEPS["pin-map-far"](context, page, PATH);
  await expect(invite(page)).toBeVisible();   // the sheet is up, so the next lines can fail
  const map = page.getByRole("region", { name: "Pin map" });
  const distance = map.getByText(/km from where you are now$/);
  const area = map.getByText("Not in our area yet", { exact: true });
  await expect(distance).toBeVisible();
  await expect(area).toBeVisible();
  expect((await box(distance)).y).toBeLessThan((await box(area)).y);   // the yellow distance line sits above the area line
  const warnBg = await distance.evaluate((e) => getComputedStyle(e).backgroundColor);
  const errBg = await area.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(warnBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(errBg).not.toBe("rgba(0, 0, 0, 0)");
  const [wr, wg, wb] = (warnBg.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const [er, eg, eb] = (errBg.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  expect(wb, `yellow colour ${warnBg}`).toBeLessThan(Math.min(wr, wg) / 2);   // yellow: red and green both far above blue
  expect(er, `red colour ${errBg}`).toBeGreaterThan(Math.max(eg, eb) * 2);   // red: red far above green and blue
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);   // live: the invite button is in the same card, so the Confirm is really gone
  const bg = await invite(page).evaluate((e) => ({ cls: e.className, bg: getComputedStyle(e).backgroundColor }));
  expect(bg.cls).not.toContain("ghost");   // filled, not the outline style
  expect(bg.bg).not.toBe("rgba(0, 0, 0, 0)");
});

test("TC 7.2 Invite the founders here: the founder's letter for that place, and the ask is saved for that pin", async ({ page, context }) => {
  await STEPS["pin-map-far"](context, page, PATH);
  await expect(invite(page)).toBeVisible();   // the sheet is up before the tap
  const asked = page.waitForRequest((r) => r.url().includes("/rest/v1/rpc/area_request_add_v2"));
  await invite(page).click();
  expect((await asked).postDataJSON().p_pin).toBe("471001");   // the ask is for the pin the map read, not another spot
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();
  const letter = page.locator(".ui-founder-text");
  await expect(letter).toContainText("We don't reach Green Avenue Colony yet");   // the letter names that place
  await expect(letter).toContainText("the day we open in Green Avenue Colony, your first order is ₹100 off");   // the promise, from the stored offer
  await expect(page.getByRole("button", { name: "Share this note" })).toBeVisible();
});

test("TC 7.3 location off: the distance line is hidden, not 0 km", async ({ page, context }) => {
  await STEPS["pin-map-far-off"](context, page, PATH);   // the step asserts the sheet is up and that no distance line or 0 km shows
  await expect(invite(page)).toBeVisible();   // the far sheet still has its main button
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);
});

test("TC 7.4 drag the pin back into a served area: the sheet turns back into C6e with Confirm", async ({ page, context }) => {
  await STEPS["pin-map-far"](context, page, PATH);
  await expect(invite(page)).toBeVisible();   // the far sheet is up before the drag
  // The served answer changes for the rest of this test: a route registered after the shared step wins over the step's own.
  await context.route("https://test.supabase.co/functions/v1/serviceability**", async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = { ok: true, serviceable: true, request_here: false, kitchens: [{ kitchen_id: "k-1", name: "Hauz Khas Kitchen", distance_m: 1230, eta_min: 30, open: true }] };
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
  });
  const b = await box(page.locator(".ui-pinmap-map"));
  const x = b.x + b.width / 2, y = b.y + b.height / 3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y + 40, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText(/We deliver here · the kitchen is/)).toBeVisible();   // the served strip is up: the screen moved and answered
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toBeEnabled();   // C6e: Confirm, after the pin rests
  await expect(invite(page)).toHaveCount(0);
  await expect(page.getByText("Not in our area yet")).toHaveCount(0);
});
