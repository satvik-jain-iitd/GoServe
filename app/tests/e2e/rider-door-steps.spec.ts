// Story 1182 (owner, 13 Nov 2026, DECIDED, boards RY1 to RY3): the rider's door steps. The bottom zone holds one button at a time.
// Far from the pin: the distance and a quiet "I am at the door" link. Near: "Arriving · tell <first name>". After Arriving: the "Say at the door" card and "Collect ₹<amount>".
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const PIN = { drop_lat: 28.5677, drop_lng: 77.2432 };
const FAR = { latitude: 28.5785, longitude: 77.2432 };   // about 1.2 km north of the pin
const NEAR = { latitude: 28.56842, longitude: 77.2432 };   // about 80 m north of the pin
const job = (extra: Record<string, unknown> = {}) => ({ ...order("out_for_delivery"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", total_paise: 64000, ...PIN, ...extra });
const open = async (page: Page, context: BrowserContext, at: { latitude: number; longitude: number } | null, o = job(), state: Record<string, unknown> = {}) => {
  if (at) { await context.grantPermissions(["geolocation"]); await context.setGeolocation(at); }
  const net = await setup(context, page, [o]);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  Object.assign(net.state, state);
  await page.goto("/rider/");
  return net;
};
const bottom = (page: Page) => page.locator(".ui-bottom button");
const arriving = (page: Page) => page.locator(".ui-bottom button", { hasText: "Arriving · tell Rahul" });   // its name for a screen reader keeps the order number

test("RY1 far from the pin: no Arriving button and no Collect button; the link I am at the door is there", async ({ page, context }) => {
  const net = await open(page, context, FAR);
  await expect(page.getByText("1.2 km to the door")).toBeVisible();
  await expect(page.getByText("The Arriving button shows here when you are near.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Arriving/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Collect/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Delivered/ })).toHaveCount(0);
  await page.getByRole("button", { name: "I am at the door" }).click();
  await expect(arriving(page)).toBeVisible();   // the way out when the pin or the phone's place is wrong
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "rider_at_door").map((c) => c.body)).toEqual([{ p_order: job().id, p_metres: expect.any(Number) }]);
  const m = net.calls.rpc.find((c) => c.name === "rider_at_door")!.body.p_metres;
  expect(m).toBeGreaterThan(1100);
  expect(m).toBeLessThan(1300);
});

test("RY2 near the pin: exactly one button in the bottom zone, Arriving · tell <first name>", async ({ page, context }) => {
  await open(page, context, NEAR);
  await expect(page.getByText(/^\d+ m to the door$/)).toBeVisible();
  await expect(bottom(page)).toHaveCount(1);
  await expect(bottom(page)).toHaveText("Arriving · tell Rahul");
  await expect(page.getByRole("button", { name: "I am at the door" })).toHaveCount(0);
});

test("RY3 after Arriving: the card Say at the door with the rider's own first name; exactly one button, Collect ₹<amount>; it opens Collect payment", async ({ page, context }) => {
  await open(page, context, NEAR);
  await arriving(page).click();
  const card = page.getByRole("region", { name: "Say at the door" });
  await expect(card).toContainText("Namaste sir, main Amit, GoServe kitchen team se. Thank you for ordering.");
  await expect(page.getByText(/^Rahul was told at \d\d:\d\d$/)).toBeVisible();
  await expect(bottom(page)).toHaveCount(1);
  await expect(bottom(page)).toHaveText("Collect ₹640");
  await bottom(page).click();
  await expect(page.getByRole("region", { name: /^Collect payment/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Took cash/ })).toBeVisible();
});

test("RY3b after Arriving, a reload still shows step 3", async ({ page, context }) => {
  await open(page, context, NEAR, job(), { arrivingAt: "2026-11-13T09:12:00Z" });   // the server has the Arriving row from an earlier tap or another phone
  await expect(page.getByRole("region", { name: "Say at the door" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Collect ₹640" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Arriving/ })).toHaveCount(0);
});

test("RY4 no pin on the order: step 2 shows at once", async ({ page, context }) => {
  await open(page, context, FAR, job({ drop_lat: null, drop_lng: null }));
  await expect(arriving(page)).toBeVisible();
  await expect(page.getByText(/to the door$/)).toHaveCount(0);
});

test("RY4b the phone gives no place: step 2 shows at once", async ({ page, context }) => {
  await open(page, context, null);
  await expect(arriving(page)).toBeVisible();
});

for (const [name, at, state] of [["step 1", FAR, {}], ["step 2", NEAR, {}], ["step 3", NEAR, { arrivingAt: "2026-11-13T09:12:00Z" }]] as const) {
  test(`RY5 at 360 x 640 ${name} fits with no scroll, card included`, async ({ page, context }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await open(page, context, at, job({ instructions: "Ring the bell twice, gate is blue" }), state);
    await expect(page.locator(".ui-bottom")).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(640);
    for (const el of await page.locator(".ui-bottom button, .ui-rx-say, .ui-rx-door").all()) {
      const b = (await el.boundingBox())!;
      expect(b.y + b.height).toBeLessThanOrEqual(640);
    }
  });
}

// Review of PR 1420 (13 Nov 2026).
test("RY6 near, then the place jumps far with no tap: Arriving stays, and no I am at the door call is made", async ({ page, context }) => {
  const net = await open(page, context, NEAR);
  await expect(arriving(page)).toBeVisible();
  await context.setGeolocation(FAR);
  await page.waitForTimeout(1500);
  await expect(arriving(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "I am at the door" })).toHaveCount(0);
  expect(net.calls.rpc.filter((c) => c.name === "rider_at_door")).toEqual([]);
});

test("RY7 the boards' look: a quiet underlined link, a surface card with a green left edge and a mono head, muted mono lines", async ({ page, context }) => {
  const style = (sel: ReturnType<Page["locator"]>) => sel.evaluate((el) => { const c = getComputedStyle(el); return { size: c.fontSize, weight: c.fontWeight, line: c.textDecorationLine, color: c.color, family: c.fontFamily, left: c.borderLeftWidth, top: c.borderTopWidth, bg: c.backgroundColor }; });
  await open(page, context, FAR);
  const link = await style(page.getByRole("button", { name: "I am at the door" }));
  expect({ size: link.size, weight: link.weight, line: link.line }).toEqual({ size: "14px", weight: "400", line: "underline" });
  expect((await page.getByRole("button", { name: "I am at the door" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const dist = await style(page.getByText("1.2 km to the door"));
  expect(dist.size).toBe("13px");
  expect(/mono/i.test(dist.family)).toBe(true);
  expect(dist.color).toBe(link.color);   // both muted
  expect((await style(page.getByRole("button", { name: "Could not deliver?" }))).color).toBe(link.color);
  await page.getByRole("button", { name: "I am at the door" }).click();
  await arriving(page).click();
  const card = await style(page.getByRole("region", { name: "Say at the door" }));
  expect({ left: card.left, top: card.top }).toEqual({ left: "4px", top: "1px" });
  expect(card.bg).not.toMatch(/, 0\)$/);   // a filled card, not see-through
  const head = await style(page.getByRole("region", { name: "Say at the door" }).getByText("Say at the door", { exact: true }));
  expect({ size: head.size, weight: head.weight, mono: /mono/i.test(head.family), color: head.color }).toEqual({ size: "12px", weight: "400", mono: true, color: link.color });
});
