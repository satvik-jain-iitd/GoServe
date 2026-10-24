import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// All the pages the doorway ships. Every one must be reachable.
const PAGES = ["/", "/investors", "/pre-register"];

test.describe("pages load", () => {
  for (const path of PAGES) {
    test(`${path} returns 200 and has a title`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} status`).toBeLessThan(400);
      await expect(page).toHaveTitle(/GoServe/);
      // The nav brand must always be present.
      await expect(page.locator('nav[aria-label="Site"] a[href="/"]').first()).toBeVisible();
    });
  }
});

test.describe("no dead links", () => {
  for (const path of PAGES) {
    test(`every internal link on ${path} resolves`, async ({ page, request }) => {
      await page.goto(path);
      const hrefs = await page.$$eval("a[href]", (as) =>
        as
          .map((a) => a.getAttribute("href") || "")
          .filter((h) => h.startsWith("/"))
          .filter((h) => !h.startsWith("//")),
      );
      const unique = [...new Set(hrefs)];
      expect(unique.length).toBeGreaterThan(0);
      for (const href of unique) {
        const res = await request.get(href);
        expect(res.status(), `${path} -> ${href}`).toBeLessThan(400);
      }
    });
  }
});

test.describe("navigation", () => {
  test("primary nav moves between the three pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "For investors" }).first().click();
    await expect(page).toHaveURL(/\/investors\/?$/);
    await page.getByRole("link", { name: "Pre-register" }).first().click();
    await expect(page).toHaveURL(/\/pre-register\/?$/);
    await page.getByRole("link", { name: "How it works" }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the v1 pages redirect to the v2 pages", async ({ page }) => {
    for (const [from, to] of [["/how-it-works", /\/$/], ["/roadmap", /\/investors\/?$/], ["/technology", /\/investors\/?$/], ["/palette", /\/$/]] as const) {
      await page.goto(from);
      await expect(page, from).toHaveURL(to);
    }
  });
});

test.describe("404", () => {
  test("unknown path shows the branded not-found page", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/delivery/i);
    await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
  });
});

test.describe("pre-registration form", () => {
  test("shows validation errors, then submits successfully", async ({ page }) => {
    await page.route("**/goserve-preregister", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );
    await page.goto("/pre-register");

    // Empty submit should surface errors and not leave the page.
    await page.getByRole("button", { name: /join the list/i }).click();
    await expect(page.locator('[data-error-for="name"]')).toBeVisible();
    await expect(page.locator('[data-error-for="email"]')).toBeVisible();

    // Fill correctly.
    await page.fill("#pr-name", "Satvik Jain");
    await page.fill("#pr-email", "satvik@example.com");
    await page.fill("#pr-city", "Delhi");
    await page.selectOption("#pr-role", "investor");
    await page.fill("#pr-pin", "110024");
    let body: any;
    await page.unroute("**/goserve-preregister");
    await page.route("**/goserve-preregister", (route) => { body = route.request().postDataJSON(); return route.fulfill({ status: 200, body: "{}" }); });
    await page.getByRole("button", { name: /join the list/i }).click();

    await expect(page.locator("#preregister-status")).toContainText(/thank you/i);
    expect(body).toMatchObject({ name: "Satvik Jain", email: "satvik@example.com", city: "Delhi 110024", role: "investor" });   // the webhook keeps only today's fields, so the pin rides in city
  });
});

test.describe("investor form", () => {
  test("submits successfully after valid input", async ({ page }) => {
    await page.route("**/goserve-investor", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );
    await page.goto("/investors");

    await page.fill("#inv-name", "Anita Rao");
    await page.fill("#inv-firm", "FoF Ventures");
    await page.fill("#inv-email", "anita@fof.vc");
    await page.fill("#inv-message", "We would love to learn more about the round.");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.locator("#investor-status")).toContainText(/thank you/i);
  });
});

test.describe("accessibility", () => {
  for (const path of PAGES) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      // Motion starts words half-faded; axe would measure that mid-animation. Reduced motion shows the final page.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      const bad = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});

// Story #18, scenario S1: the pilot starts in Delhi (the founder is based in Kota).
test.describe("first city", () => {
  test("home and pre-register name Delhi as the first city", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toContainText("Delhi");
    await expect(page.locator("footer")).toContainText("Delhi");
    await page.goto("/pre-register");
    await expect(page.locator("#pr-city")).toHaveValue("Delhi");
  });

  for (const path of PAGES) {
    test(`${path} never says Kota`, async ({ page }) => {
      await page.goto(path);
      const html = await page.content();
      expect(html).not.toMatch(/Kota/);
    });
  }
});

test.describe("pin code on the home page", () => {
  test("See if we deliver carries the pin to the pre-register form", async ({ page }) => {
    await page.goto("/");
    await page.fill("#pin", "110024");
    await page.getByRole("button", { name: "See if we deliver" }).click();
    await expect(page).toHaveURL(/\/pre-register\/?\?pin=110024/);
    await expect(page.locator("#pr-pin")).toHaveValue("110024");
  });
});

test.describe("motion", () => {
  test("with reduced motion every heading and number shows its final text at once", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/investors");
    await expect(page.getByRole("heading", { level: 1, name: "Hot meals as quick commerce." })).toBeVisible();
    await expect(page.locator(".numbers .n b").first()).toHaveText("1");
    await expect(page.locator(".progress")).toBeHidden();
    expect(await page.locator("[style*='opacity']").count()).toBe(0);   // nothing is held half-hidden
    await ctx.close();
  });

  test("the final numbers are in the server HTML, so they read without JavaScript", async ({ request }) => {
    const html = await (await request.get("/investors")).text();
    expect(html).toContain("25–35");
    expect(html).toContain("Hot meals as quick commerce.");
  });
});

test.describe("review fixes", () => {
  test("the heading keeps its spaces in the page text and for copy and paste", async ({ page }) => {
    await page.goto("/");
    const text = await page.getByRole("heading", { level: 1 }).evaluate((h) => (h as HTMLElement).textContent);
    expect(text).toContain("Hot meals from our kitchen. At your door in 25 to 35 minutes.");
    const html = await (await page.request.get("/")).text();
    expect(html).toMatch(/Hot<\/span>\s*<span[^>]*>meals|Hot meals/);
  });

  test("the footer credits Wikimedia Commons and has no dead Privacy or Terms links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).toContainText("Punjabi Thali by Sarahbatra");
    await expect(page.locator("footer")).toContainText("Malwani Chicken Thali by Shailesh V Nigawale");
    await expect(page.locator("footer").getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute("href", /creativecommons\.org\/licenses\/by-sa\/4\.0/);
    await expect(page.locator("footer")).toContainText("Wikimedia Commons");
    await expect(page.locator("footer").getByRole("link", { name: /privacy|terms/i })).toHaveCount(0);
    expect(await page.locator('a[href="#"]').count()).toBe(0);
  });

  test("theme-color is the cream of the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#e4e6d9");
  });

  test("the nav comes from Watermelon UI and opens a menu on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "networkidle" });   // the menu is an island: wait for it to wake up
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "For investors" })).toBeVisible();
    await ctx.close();
  });
});

test.describe("phone width", () => {
  for (const path of PAGES) {
    test(`${path} does not scroll sideways at 390 px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      await ctx.close();
    });
  }
});
