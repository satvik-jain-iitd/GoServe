// Story #593, changed by story 1740: the last step of the rehearsal, kept apart so a fake page can test it. The customer app no longer asks "Was your order delivered?";
// the slip says Delivered when the rider (here the demo city) marks it, so the spec only waits for Delivered and the last status row.
import { expect, type Page } from "@playwright/test";

export async function waitDelivered(page: Page, ms = { done: 20 * 60_000 }) {
  await expect(page.getByRole("heading", { name: "Delivered", exact: true })).toBeVisible({ timeout: ms.done });
  await expect(page.locator('[aria-current="step"]')).toBeVisible({ timeout: ms.done });   // the status rows end on the delivered step (the thank-you line left in story 1324)
}
