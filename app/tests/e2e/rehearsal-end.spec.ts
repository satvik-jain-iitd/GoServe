// Story #593: on the real app the question "Yes, I have it" comes BEFORE the slip says Delivered (confirm.ts asks at the earlier of ready + 3 min and placed + 8 min).
// A fake page shows that order; the rehearsal's last step must pass on it.
import { test, expect } from "@playwright/test";
import { confirmAndDelivered } from "../live/rehearsalEnd";

const fake = `<main><button id="yes">Yes, I have it</button><div id="out"></div></main>
<script>document.getElementById("yes").onclick = () => { document.getElementById("yes").remove();
  document.getElementById("out").innerHTML = '<h1>Delivered</h1><p>Paid: cash</p>'; };</script>`;

test("S1 the question first, Delivered after the tap: the last step passes", async ({ page }) => {
  await page.setContent(fake);
  await confirmAndDelivered(page, { ask: 3_000, done: 3_000 });
  await expect(page.getByText(/Paid: cash/)).toBeVisible();
});
