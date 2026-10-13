// Story #39, scenario S1: the built app opens, links its manifest and registers a service worker.
import { test, expect } from "@playwright/test";

test("the app opens and shows the GoServe name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "GoServe" })).toBeVisible();
});

test("the manifest is linked and served", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const res = await request.get(href as string);
  expect(res.ok()).toBe(true);
  expect((await res.json()).name).toBe("GoServe");
});

test("a service worker registers", async ({ page }) => {
  await page.goto("/");
  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(registered).toBe(true);
});

test("the app shell loads offline after the first visit", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "GoServe" })).toBeVisible();
});
