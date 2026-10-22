// Story S-M5: /privacy and /terms are plain pages, not the app, also when the service worker is active (Google's consent screen links to them).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

for (const [path, heading] of [["/privacy/", "Privacy policy"], ["/terms/", "Terms of service"]] as const) {
  test(`S1 ${path} is a plain page with its own heading, not the app`, async ({ page, request }) => {
    const html = await (await request.get(path)).text();
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).not.toContain('id="root"');
    expect(html).toContain("klickbae8yt@gmail.com");
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });

  test(`S2 ${path} still shows the page after the service worker is ready`, async ({ page, context }) => {
    await setup(context, page, []);
    await page.goto("/customer/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto(path);
    await page.reload();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add / })).toHaveCount(0);
  });
}
