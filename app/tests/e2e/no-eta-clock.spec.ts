// Story 1742 (owner, 19 and 20 Nov 2026, epic 1653): a promise is minutes, never a clock time. The live order screen shows the big minutes and no "By hh:mm" under them.
// "At your door hh:mm" on a delivered order stays: it already happened. Measured in a real browser at 360x640 and 390x844.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const NOW = new Date(2026, 10, 8, 12, 47, 0);
const row = (lo: number | null, late = false) => ({ rider_lat: null, rider_lng: null, eta_lo_min: lo, eta_hi_min: lo === null ? null : lo + 10, eta_late: late, updated_at: NOW.toISOString() });
const STAGES = ["placed", "accepted", "preparing", "ready", "out_for_delivery"] as const;
const SIZES = [[360, 640], [390, 844]];

async function open(page: Page, context: Parameters<typeof setup>[0], status: string, tracking: ReturnType<typeof row>, w: number, h: number) {
  const net = await setup(context, page, [order(status, "2020-01-01T10:02:00Z")]);
  net.state.tracking = tracking;
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/customer/");
}

for (const [w, h] of SIZES) {
  for (const status of STAGES) {
    test(`AC-1 and AC-2 ${status}: the big minutes show and no "By hh:mm" (${w}x${h})`, async ({ page, context }) => {
      await open(page, context, status, row(25), w, h);
      const big = page.locator(".ui-eta-big");
      await expect(big).toHaveText("25 min");
      await expect(page.locator("body")).not.toContainText(/By \d{1,2}:\d{2}/);
      const m = await big.evaluate((e) => { const r = e.getBoundingClientRect(), s = e.closest(".ui-slip")!.getBoundingClientRect(); return { size: getComputedStyle(e).fontSize, mid: Math.abs(r.left + r.width / 2 - (s.left + s.width / 2)) }; });
      expect(m.size).toBe("48px");   // the same size as before
      expect(m.mid).toBeLessThanOrEqual(1);   // and still on the middle of the slip
    });
  }

  test(`the working state is unchanged (${w}x${h})`, async ({ page, context }) => {
    await open(page, context, "preparing", row(null), w, h);
    await expect(page.getByText("Working out the time")).toBeVisible();
  });

  test(`the late state is unchanged (${w}x${h})`, async ({ page, context }) => {
    await open(page, context, "out_for_delivery", row(25, true), w, h);
    await expect(page.getByText("Running late, sorry")).toBeVisible();
  });
}

test("AC-3 a delivered order still shows At your door with its time", async ({ page, context }) => {
  const net = await setup(context, page, [order("out_for_delivery")]);
  await page.goto("/customer/");
  await expect(page.getByRole("list", { name: "Order progress" })).toBeVisible();
  net.push("UPDATE", { ...order("delivered", new Date(2026, 10, 14, 21, 30).toISOString()), delivered_at: new Date(2026, 10, 14, 20, 8).toISOString(), promised_at: new Date(2026, 10, 14, 20, 8).toISOString() });
  await expect(page.getByRole("region", { name: "Order, delivered" }).getByText("At your door 8:08 pm")).toBeVisible();
});
