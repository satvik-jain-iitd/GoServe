// Regression: one trip, many packets (boards RT1 and RT2, story 1441). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "../helpers";

test.use({ viewport: { width: 360, height: 640 } });
const NOW = new Date().toISOString();

test("TC R3.1 on a small phone a trip of two: Picked up all 2 stays off until both are ticked and stays on the screen, then picks up each once", async ({ page, context }) => {
  const second = "0a0a0a0a-1111-4222-8333-444444444444";
  const net = await setup(context, page, [{ ...order("ready", NOW, "2020-01-01T10:00:00Z"), rider_id: SESSION }, { ...order("ready", NOW, "2020-01-01T10:05:00Z"), id: second, rider_id: SESSION }]);
  await page.goto("/rider/");
  const all = page.getByRole("button", { name: "Picked up all 2" });
  await expect(all).toBeDisabled();
  const b = (await all.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(640);
  for (const box of await page.getByRole("checkbox").all()) await box.click();
  await all.click();
  await expect.poll(() => net.calls.status.map((c) => c.body.order_id)).toEqual(["0f0f0f0f-1111-4222-8333-444444444444", second]);
});
