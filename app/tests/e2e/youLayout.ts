// Story #640 (row T3), boards Y1 and Y2: on You the Google row sits under the details card with 16 px of air, never over it; the card has no fixed height; Edit opens the fields inside the card with Save and Cancel.
// One body for two projects: Chromium (Pixel 7) in you-layout.spec.ts and WebKit (iPhone 13) in you-layout.webkit.spec.ts.
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

export async function youLayout(page: Page, context: BrowserContext, theme: "day" | "night") {
  await context.addInitScript((t) => { try { localStorage.setItem("gs-theme", t); } catch { /* the default theme shows */ } }, theme);
  const net = await setup(context, page);
  net.state.customer = { user_id: "u", name: "Rahul Verma", phone: "9876543210", address: "B-12, Lajpat Nagar II, near the park gate", pin_code: "110024" };
  await page.goto("/customer/");
  await page.getByRole("button", { name: "You" }).click();
  const card = page.getByRole("region", { name: "Delivery details" });
  const google = page.getByTestId("google-signin");
  await expect(google).toBeVisible();
  const gap = async () => {
    const c = (await card.boundingBox())!, g = (await google.boundingBox())!;
    return { air: Math.round(g.y - (c.y + c.height)), overlap: g.y < c.y + c.height };
  };
  const rest = await gap();
  expect(rest.overlap).toBe(false);
  expect(rest.air).toBeGreaterThanOrEqual(16);
  await expect(page.getByText("Keeps your orders on every phone.")).toBeVisible();
  await page.getByRole("button", { name: "Edit delivery details" }).click();
  // The fields open inside the card, with Save and Cancel; the Google row moves down by their height and still has its air.
  const c = (await card.boundingBox())!;
  for (const b of [page.locator("#acc-name"), page.locator("#acc-phone"), page.locator("#acc-address"), page.getByRole("button", { name: "Save" }), page.getByRole("button", { name: "Cancel" })]) {
    const r = (await b.boundingBox())!;
    expect(r.y).toBeGreaterThanOrEqual(c.y);
    expect(r.y + r.height).toBeLessThanOrEqual(c.y + c.height);
  }
  const editing = await gap();
  expect(editing.overlap).toBe(false);
  expect(editing.air).toBeGreaterThanOrEqual(16);
  await page.locator("#acc-name").fill("Rahul V");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("account")).toContainText("Rahul Verma");   // Cancel keeps the old details
  await page.getByRole("button", { name: "Edit delivery details" }).click();
  await page.locator("#acc-name").fill("Rahul Verma Jr");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("account")).toContainText("Rahul Verma Jr");
}
