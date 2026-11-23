// Story 1794 (owner, 23 Nov 2026), rider layer: an order the admin cancelled is one line: number, Declined, OK. Never a job.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const NEXT = "1a1a1a1a-2222-4333-8444-555555555555";
const stage: Record<string, [string, boolean]> = { "to the kitchen": ["ready", false], "on the way": ["out_for_delivery", false], "at the door": ["out_for_delivery", true] };
const gone = () => ({ ...order("cancelled", new Date().toISOString()), cancelled_by: "admin", cancel_reason: "admin cancelled", rider_id: "r-1" });
const open = async (page: Page, context: BrowserContext, status: string, arriving: boolean, extra: object[] = []) => {
  const net = await setup(context, page, [order(status), ...extra]);
  net.state.rider = { user_id: "7e57ab1e-0000-4000-8000-0000000000a1", name: "Rider", online: true, lat: null, lng: null };
  if (arriving) net.state.events.push({ order_id: ID, event: "order.arriving" });
  await page.goto("/rider/");
  return net;
};
const row = (page: Page) => page.getByRole("status").filter({ hasText: "Order declined" });

for (const [name, [status, arriving]] of Object.entries(stage)) {
  test(`DR1 rider ${name}: the cancelled order is one Declined line with OK, no step buttons`, async ({ page, context }) => {
    const net = await open(page, context, status, arriving);
    await expect(page.getByRole("button", { name: /Pick up|Arriving|Delivered|Collect|I am at the door/ }).first()).toBeVisible();
    net.push("UPDATE", gone());
    await expect(row(page)).toContainText(`No. ${ID.slice(0, 8)}`);
    await expect(row(page).getByRole("button", { name: "OK" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pick up|Arriving|Delivered|Collect|Could not deliver/ })).toHaveCount(0);
  });
}

test("DR2 it is not a job: the next job shows above it, no more waiting, OK removes it and a reload keeps it away", async ({ page, context }) => {
  const next = { ...order("ready", "2020-01-01T10:00:00Z", "2020-01-01T11:00:00Z"), id: NEXT };
  const net = await open(page, context, "ready", false, [next]);
  net.push("UPDATE", gone());
  await expect(row(page)).toBeVisible();
  await expect(page.getByText("more waiting")).toHaveCount(0);
  const job = (await page.getByRole("region", { name: /Pick up order/ }).boundingBox())!;
  expect(job.y).toBeLessThan((await row(page).boundingBox())!.y);
  await row(page).getByRole("button", { name: "OK" }).click();
  await expect(row(page)).toHaveCount(0);
  net.state.orders = [gone(), next];   // what the server holds on a reload
  await page.reload();
  await expect(page.getByRole("region", { name: /Pick up order/ })).toBeVisible();
  await expect(row(page)).toHaveCount(0);
});

test("DR3 a tap just before the cancel says This order was declined.", async ({ page, context }) => {
  const net = await open(page, context, "ready", false);
  const pick = page.getByRole("button", { name: /Pick up/ });
  await expect(pick).toBeVisible();
  net.state.reply = { status: 409, body: { ok: false, error: "bad_step", message: "bad_step" } };
  await pick.click({ noWaitAfter: true });
  net.state.orders = [gone()];   // the server has it cancelled; the phone has not heard yet
  await expect(page.getByText("This order was declined.")).toBeVisible();
  await expect(page.getByText(/Could not mark it|Try again/)).toHaveCount(0);
});

test("DR4 a declined order adds nothing to cash in hand", async ({ page, context }) => {
  const net = await open(page, context, "delivered", false);
  net.push("UPDATE", { ...gone(), total_paise: 99900, paid_by: "cash" });
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByText(/999/)).toHaveCount(0);
});

const lum = (c: string) => { const v = c.match(/[\d.]+/g)!.slice(0, 3).map((x) => { const n = +x / 255; return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
for (const [w, h] of [[360, 640], [390, 844]]) {
  for (const withJob of [false, true]) {
    test(`DR5 at ${w} x ${h} ${withJob ? "under a Ready job" : "alone"}: red-edged box in the gutter, one line, OK 44px, no scroll, no reason`, async ({ page, context }) => {
      await page.setViewportSize({ width: w, height: h });
      const net = await open(page, context, "ready", false, withJob ? [{ ...order("ready", "2020-01-01T10:00:00Z", "2020-01-01T11:00:00Z"), id: NEXT }] : []);
      net.push("UPDATE", gone());
      await expect(row(page)).toBeVisible();
      const box = (await row(page).boundingBox())!;
      expect(Math.round(box.x)).toBe(20); expect(Math.round(box.width)).toBe(w - 40);
      const ok = (await row(page).getByRole("button", { name: "OK" }).boundingBox())!;
      expect(ok.height).toBeGreaterThanOrEqual(44); expect(ok.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThan(90);   // short lines, no wrap
      const st = await row(page).evaluate((el) => { const c = getComputedStyle(el), h = getComputedStyle(el.querySelector("b")!); return { w: c.borderLeftWidth, bc: c.borderLeftColor, bg: c.backgroundColor, fg: h.color, size: h.fontSize, wt: h.fontWeight }; });
      expect(st.w).toBe("4px"); expect(st.bc).toBe(st.fg); expect(st.size).toBe("17px");
      const [a, b] = [lum(st.fg), lum(st.bg)].sort((x, y) => y - x);
      expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
      await expect(row(page)).not.toContainText(/admin cancelled|Cancelled|reason/i);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (w === 390) await page.screenshot({ path: `/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1794-rider-declined${withJob ? "-job" : ""}-390x844.png` });
    });
  }
}
