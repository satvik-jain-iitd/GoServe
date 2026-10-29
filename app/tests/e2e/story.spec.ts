// Story #503 (boards S1, S2, S3): the bare address is a scroll story with four doors. One static page, no app, no script but the theme switch.
// The demo console (all roles, split view) that used to live at "/" is at /console/ for tests and local work.
import { test, expect } from "@playwright/test";
import { scan } from "./helpers";

test("S1 the bare address tells the story word for word: hero, four parts, four doors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "GoServe" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 }).first()).toContainText("One hot thali.");
  await expect(page.getByText("A home kitchen near your pin code cooks the day's plate.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Four parts. One hot plate." })).toBeVisible();
  for (const n of ["01", "02", "03", "04"]) await expect(page.getByText(n, { exact: true })).toBeVisible();
  for (const h of ["Home kitchens in your pin code", "One app. Four hands.", "Cash first", "Our own riders"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Which hand are you?" })).toBeVisible();
  await expect(page.getByText("A test phase: the sign-in code is fixed.")).toBeVisible();
});

test("S2 the four doors open the four apps, and See today's thali opens the customer app", async ({ page }) => {
  await page.goto("/");
  const doors = page.getByRole("navigation", { name: "The four apps" });
  await expect(doors.getByRole("link", { name: /I want food/ })).toHaveAttribute("href", "/customer/");
  await expect(doors.getByRole("link", { name: /I cook/ })).toHaveAttribute("href", "/kitchen/");
  await expect(doors.getByRole("link", { name: /I ride/ })).toHaveAttribute("href", "/rider/");
  await expect(doors.getByRole("link", { name: /I run the city/ })).toHaveAttribute("href", "/admin/");
  await expect(page.getByRole("link", { name: "See today's thali", exact: true })).toHaveAttribute("href", "/customer/");
  await page.getByRole("link", { name: "See today's thali", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/$/);
});

for (const theme of ["day", "night"] as const) {
  test(`S3 ${theme}: no serious contrast or role violation, no sideways scroll at 390 px`, async ({ page, context }) => {
    await context.addInitScript((t) => { try { window.localStorage.setItem("gs-theme", t); } catch { /* blocked */ } }, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("heading", { level: 1, name: "GoServe" })).toBeVisible();   // the story, not the console
    expect(await scan(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("S4 the page is static: no app script, and the role picker is gone from the bare address", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => { if (r.resourceType() === "script") scripts.push(r.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "GoServe" })).toBeVisible();
  expect(scripts).toEqual([]);
  await expect(page.getByRole("navigation", { name: "Screen" })).toHaveCount(0);
});

test("S5 the demo console moved to /console/", async ({ page }) => {
  await page.goto("/console/");
  await expect(page.getByRole("navigation", { name: "Screen" })).toBeVisible();
});
