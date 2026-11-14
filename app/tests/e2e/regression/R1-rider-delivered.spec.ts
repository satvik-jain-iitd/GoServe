// Regression: the rider's Delivered slip (boards DV1, DV2, CP1, story 1448). Rows also in docs/tests/test-cases.md.
import { test, expect } from "@playwright/test";
import { ID, SESSION, order, setup } from "../helpers";

const NOW = new Date().toISOString();
test.use({ viewport: { width: 360, height: 640 } });

test("TC R1.1 a wrong cash tap is put right on a small phone: the slip and Done fit with no scroll, Change saves UPI, the cash line drops to zero", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("out_for_delivery", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma" }]);
  net.state.qrObject = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png";
  await page.goto("/rider/");
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: /^Collect ₹/ }).click();
  await page.getByRole("button", { name: "Took cash ₹640" }).click();
  await expect(page.getByText("Cash aapke paas ₹640", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(640);
  const done = (await page.getByRole("button", { name: "Done", exact: true }).boundingBox())!;
  expect(done.y + done.height).toBeLessThanOrEqual(640);
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("button", { name: "Paid by UPI ₹640" }).click();
  await expect(page.getByText("Paid by UPI", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash aapke paas ₹0", { exact: true })).toBeVisible();
});
