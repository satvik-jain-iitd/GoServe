import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// All the pages the doorway ships. Every one must be reachable.
const PAGES = [
  "/",
  "/palette",
  "/how-it-works",
  "/technology",
  "/roadmap",
  "/investors",
  "/pre-register",
];

test.describe("pages load", () => {
  for (const path of PAGES) {
    test(`${path} returns 200 and has a title`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `${path} status`).toBeLessThan(400);
      await expect(page).toHaveTitle(/GoServe/);
      // The header brand must always be present.
      await expect(page.locator("header .brand")).toBeVisible();
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
  test("primary nav moves between pages with no redirect failure", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Palette" }).first().click();
    await expect(page).toHaveURL(/\/palette\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/palette/i);

    await page.getByRole("link", { name: "Roadmap" }).first().click();
    await expect(page).toHaveURL(/\/roadmap\/?$/);

    await page.getByRole("link", { name: "Pre-register" }).first().click();
    await expect(page).toHaveURL(/\/pre-register\/?$/);
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
    await page.getByRole("button", { name: /pre-register my interest/i }).click();
    await expect(page.locator('[data-error-for="name"]')).toBeVisible();
    await expect(page.locator('[data-error-for="email"]')).toBeVisible();

    // Fill correctly.
    await page.fill("#pr-name", "Satvik Jain");
    await page.fill("#pr-email", "satvik@example.com");
    await page.fill("#pr-city", "Kota");
    await page.selectOption("#pr-role", "investor");
    await page.getByRole("button", { name: /pre-register my interest/i }).click();

    await expect(page.locator("#preregister-status")).toContainText(/thank you/i);
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
    await page.getByRole("button", { name: /send message/i }).click();

    await expect(page.locator("#investor-status")).toContainText(/thank you/i);
  });
});

test.describe("accessibility", () => {
  for (const path of PAGES) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(path);
      // Reveal-on-scroll starts elements at opacity 0. Force them visible so
      // axe checks the real, fully-shown page and not a partially hidden one.
      await page.addStyleTag({
        content:
          ".reveal{opacity:1 !important;transform:none !important;transition:none !important;}",
      });
      const results = await new AxeBuilder({ page }).analyze();
      const bad = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});
