// Story 1718 (owner, 20 Nov 2026): a ghost "Call support" button above "Collect" on the rider's On the way screen.
// It is a tel: link to the number the admin set. No number: no button, and Collect is exactly as before.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const NUMBER = "9000000000";
const NEAR = { latitude: 28.56842, longitude: 77.2432 };
const job = () => ({ ...order("out_for_delivery"), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", total_paise: 64000, drop_lat: 28.5677, drop_lng: 77.2432 });
const open = async (page: Page, context: BrowserContext, phone: string | null) => {
  await context.grantPermissions(["geolocation"]); await context.setGeolocation(NEAR);
  const net = await setup(context, page, [job()]);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: "9810011223", online: true, lat: null, lng: null };
  net.state.supportPhone = phone; net.state.arrivingAt = "2026-11-13T09:12:00Z";   // step 3: Say at the door and Collect
  await page.goto("/rider/");
  await expect(page.getByRole("button", { name: "Collect", exact: true })).toBeVisible();
  await page.waitForTimeout(300);
};
const box = async (page: Page, sel: ReturnType<Page["locator"]>) => (await sel.boundingBox())!;
const scrolls = (page: Page) => page.locator(".ui-scroll").first().evaluate((e) => e.scrollHeight > e.clientHeight);

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`CS1 at ${w} x ${h} with a number: Call support above Collect, same width, 56 tall, 8 px apart, one line, tel link, Collect does not move`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, context, null);
    const collect = page.getByRole("button", { name: "Collect", exact: true });
    const before = await box(page, collect);
    const scrollBefore = await scrolls(page);
    await page.close();
    const p2 = await context.newPage();
    await p2.setViewportSize({ width: w, height: h });
    await open(p2, context, NUMBER);
    const call = p2.getByRole("link", { name: "Call support" });
    await expect(call).toHaveAttribute("href", `tel:${NUMBER}`);
    const c = await box(p2, call), k = await box(p2, p2.getByRole("button", { name: "Collect", exact: true }));
    console.log(`PX ${w}: call ${JSON.stringify(c)} collect ${JSON.stringify(k)} before ${JSON.stringify(before)}`);
    expect(c.y + c.height + 8).toBeCloseTo(k.y, 0);   // 8 px between, Call support above
    expect(c.width).toBeCloseTo(k.width, 0);
    expect(c.height).toBeCloseTo(56, 0);
    expect(k.height).toBeCloseTo(56, 0);
    expect(c.height).toBeLessThan(60);   // one line
    expect(k.y + k.height).toBeCloseTo(before.y + before.height, 0);   // Collect's bottom edge and height as without the number
    expect(k.height).toBeCloseTo(before.height, 0);
    expect(await scrolls(p2)).toBe(scrollBefore);
  });
}

test("CS2 no number: no Call support, no tel link to the support number, one button in the bottom zone", async ({ page, context }) => {
  await open(page, context, null);
  await expect(page.getByText("Call support")).toHaveCount(0);
  await expect(page.locator(`a[href="tel:${NUMBER}"]`)).toHaveCount(0);
  await expect(page.locator(".ui-bottom button")).toHaveCount(1);
});
