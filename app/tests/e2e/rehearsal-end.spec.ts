// Story #593, changed by story 1740: the rehearsal's last step waits for the slip to say Delivered (no question to tap any more). A fake page shows that order.
import { test, expect } from "@playwright/test";
import { waitDelivered } from "../live/rehearsalEnd";

const fake = `<main><div id="out"></div></main>
<script>setTimeout(() => { document.getElementById("out").innerHTML = '<h1>Delivered</h1><ol><li aria-current="step">At your door</li></ol>'; }, 500);</script>`;

test("S1 Delivered shows by itself: the last step passes", async ({ page }) => {
  await page.setContent(fake);
  await waitDelivered(page, { done: 3_000 });
  await expect(page.locator('[aria-current="step"]')).toHaveText("At your door");
});
