// Story #324 (M.5): the demo rehearsal. Walks the customer steps of docs/demo/mvp2-demo.md on a real app: 1 pin, 2 menu, 3 two dishes and the bill, 4 place the order,
// 5 the order slip, then waits for the demo city to take the order through steps 6 to 8 by itself and does step 9: the question "Yes, I have it" comes first (story #593), then the slip says Delivered.
// Steps 6 to 8 by hand and step 10 need a Google sign-in: those are the owner's, in story #325.
// It fails on any error text and writes one row per step (step, pass, order number, seconds since the last step) to test-results/rehearsal-<run>.json for docs/demos/rehearsal-<date>.md.
// It places a REAL order in the demo kitchen of the pin, so it needs LIVE_URL set on purpose and never runs by accident. Pin: REHEARSAL_PIN (default 110016, Madras Tiffin Room).
// Run (prod only after the owner's yes): LIVE_URL=https://goserve-app.pages.dev npx playwright test -c playwright.rehearsal.config.ts
// Red until the prod city is seeded and demo mode is on: without them the pin says "Not here yet" or the order stays at placed.
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { confirmAndDelivered } from "./rehearsalEnd";

const PIN = process.env.REHEARSAL_PIN ?? "110016";
const ERROR_TEXT = /Not here yet|Closed now|Something went wrong|Could not|No network|No internet|is not set up|unavailable/i;
type Row = { step: string; pass: boolean; note: string; order: string | null; seconds: number };

test("S1 rehearsal: pin, menu, two dishes, bill, place order, the demo city delivers, Yes I have it", async ({ page }, info) => {
  if (!process.env.LIVE_URL) throw new Error("LIVE_URL is not set. This test places a real order in a real kitchen: set it on purpose.");
  const rows: Row[] = [];
  let last = Date.now(), order: string | null = null;
  const noErrors = async (p: Page) => {
    const found = await p.locator("[role=alert], [role=status]").allTextContents();
    const bad = found.filter((t) => ERROR_TEXT.test(t));
    expect(bad, `error text on the screen: ${bad.join(" | ")}`).toEqual([]);
  };
  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
      await noErrors(page);
      rows.push({ step: name, pass: true, note: "", order, seconds: Math.round((Date.now() - last) / 1000) });
    } catch (e) {
      rows.push({ step: name, pass: false, note: String(e instanceof Error ? e.message : e).replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0].slice(0, 200), order, seconds: Math.round((Date.now() - last) / 1000) });
      throw e;
    } finally {
      last = Date.now();
      mkdirSync("test-results", { recursive: true });
      writeFileSync(`test-results/rehearsal-${info.repeatEachIndex}.json`, JSON.stringify(rows, null, 2));
    }
  };

  await step("1 pin and See the menu", async () => {
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Type it by hand" }).click();   // story #668
    await page.getByLabel("Address · food gets delivered here").fill("Flat 4, Green Park, rehearsal");
    await page.getByLabel("Pin code").fill(PIN);
    await page.getByRole("button", { name: "See the menu" }).click();
    await page.getByRole("button", { name: /^Add / }).first().waitFor({ timeout: 20_000 });
  });
  await step("2 the menu: dishes, photos and Open till", async () => {
    await expect(page.getByText(/Open till/)).toBeVisible();
    expect(await page.getByRole("button", { name: /^Add / }).count()).toBeGreaterThanOrEqual(2);
  });
  await step("3 two dishes and View bill", async () => {
    const dishes = page.getByRole("button", { name: /^Add / });
    await dishes.nth(0).click();
    await dishes.nth(1).click();
    await page.getByRole("button", { name: /View bill/ }).click();
    await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
  });
  await step("4 name, phone, address and Place order", async () => {
    await page.getByLabel("Your name").fill("Rehearsal");
    await page.getByLabel("Phone").fill("9876543210");
    await page.getByLabel("Address").fill("Flat 4, Green Park, rehearsal");
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible({ timeout: 20_000 });
    order = (await page.locator(".ui-head .meta").first().textContent())?.match(/[0-9a-f]{8}/)?.[0] ?? null;
  });
  await step("5 the order slip", async () => {
    await expect(page.getByText("Cash at door")).toBeVisible();
    await expect(page.locator(".ui-stamp").first()).toBeVisible();
  });
  await step("6 to 9 the demo city delivers (about 11 to 15 minutes); the question Yes, I have it comes first, then Delivered and Paid: cash", async () => {
    await confirmAndDelivered(page);
  });
});
