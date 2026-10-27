// Story #593: the last step of the rehearsal, kept apart so a fake page can test its order. The question "Yes, I have it" comes before the slip says Delivered
// (confirm.ts asks at the earlier of ready + 3 min and placed + 8 min), so the spec waits for the question first, taps it, then expects Delivered and the cash line.
import { expect, type Page } from "@playwright/test";

export async function confirmAndDelivered(page: Page, ms = { ask: 15 * 60_000, done: 20 * 60_000 }) {
  await page.getByRole("button", { name: "Yes, I have it" }).click({ timeout: ms.ask });
  await expect(page.getByRole("heading", { name: "Delivered", exact: true })).toBeVisible({ timeout: ms.done });
  await expect(page.getByText(/Paid: cash/)).toBeVisible({ timeout: ms.done });
}
