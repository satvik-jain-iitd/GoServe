// Story S-M5: /privacy and /terms are plain pages, not the app, also when the service worker is active (Google's consent screen links to them).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S3 the privacy page says what a feedback report carries", async ({ request }) => {
  const html = await (await request.get("/privacy/")).text();
  for (const w of ["phone and browser type", "order number and its status", "last taps"]) expect(html).toContain(w);
});

for (const [path, heading] of [["/privacy/", "Privacy policy"], ["/terms/", "Terms of service"]] as const) {
  test(`S1 ${path} is a plain page with its own heading, not the app`, async ({ page, request }) => {
    const html = await (await request.get(path)).text();
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).not.toContain('id="root"');
    expect(html).toContain("klickbae8yt@gmail.com");
    expect(html).toContain('<a href="/customer/">Back to GoServe</a>');   // not the demo console at /
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

// Google brand check: the home page names what GoServe does and links the policy pages; the domain file proves we own the site.
test("S4 every page of the app has a footer with what GoServe does and links to Privacy and Terms", async ({ page, context }) => {
  await setup(context, page, []);
  await page.goto("/customer/");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("GoServe: order food, the kitchen cooks, a rider brings it");
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
  await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms/");
  await page.goto("/kitchen/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacy" })).toBeVisible();
});

test("S5 the privacy page has a Google sign-in data block", async ({ request }) => {
  const html = await (await request.get("/privacy/")).text();
  expect(html).toContain("<h2>Google sign-in data</h2>");
  for (const w of ["name, email and profile picture", "never shared or sold", "deleted when you write to us"]) expect(html).toContain(w);
});

test("S6 the Google Search Console file answers its one line", async ({ request }) => {
  const res = await request.get("/google55109da819aaecf2.html");
  expect(res.status()).toBe(200);
  expect((await res.text()).trim()).toBe("google-site-verification: google55109da819aaecf2.html");
});
