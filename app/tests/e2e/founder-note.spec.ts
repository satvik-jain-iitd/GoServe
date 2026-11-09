// Story #1129 (board NK-L2): after Tell me when you come here, a short letter from the co-founder with the Rs 100 first-order promise. The promise is shown only when the stored row holds it.
import { test, expect, type Page } from "@playwright/test";
import { setup, typePlace } from "./helpers";

async function toNote(page: Page) {
  await page.goto("/customer/");
  await typePlace(page, "110099", "Sector 62, Noida, Uttar Pradesh 201301");

  await page.getByRole("button", { name: "Tell me when you come here" }).click();
}
const slip = (page: Page) => page.getByRole("group", { name: "A letter from co-founder Satvik Jain" });

test("S1 the letter says sorry for the place, makes the Rs 100 promise, gives the motto, the sign and both links", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await toNote(page);
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();
  await expect(slip(page)).toContainText("We don't reach Sector 62 yet.");
  await expect(slip(page)).toContainText("the day we open in Sector 62, your first order is ₹100 off");
  await expect(slip(page)).toContainText("Pahle banda, phir dhanda.");
  await expect(slip(page)).toContainText("People first, business after.");
  await expect(slip(page).getByText("Satvik", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/satvik-jain-iitd/");
  await expect(page.getByRole("link", { name: "letsdwelo.in" })).toHaveAttribute("href", "https://letsdwelo.in/");
  await expect(page.getByRole("button", { name: "Share this note" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tell me when you come here" })).toHaveCount(0);
});

test("S2 no promise on the stored row means no promise in the letter", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.areaRequest = { ok: true };
  await toNote(page);
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();
  await expect(slip(page)).not.toContainText("₹100");
  await expect(slip(page)).not.toContainText("promise");
  await expect(slip(page)).toContainText("Pahle banda, phir dhanda.");
});

test("S3 Share this note opens the phone share sheet with the letter's words and the link", async ({ page, context }) => {
  await page.addInitScript(() => { (window as any).__shared = null; (navigator as any).share = async (d: unknown) => { (window as any).__shared = d; }; });
  await setup(context, page, [], { pin: null });
  await toNote(page);
  await page.getByRole("button", { name: "Share this note" }).click();
  const d = await page.evaluate(() => (window as any).__shared);
  expect(d.url).toBe("https://letsdwelo.in/");
  expect(d.text).toContain("Pahle banda, phir dhanda");
});

test("S4 where the phone cannot share, the text is copied and the screen says so", async ({ page, context }) => {
  await page.addInitScript(() => { (navigator as any).share = undefined; (window as any).__copied = null; Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => { (window as any).__copied = t; } } }); });
  await setup(context, page, [], { pin: null });
  await toNote(page);
  await page.getByRole("button", { name: "Share this note" }).click();
  await expect(page.getByRole("status")).toContainText("Copied");
  expect(await page.evaluate(() => (window as any).__copied)).toContain("Pahle banda, phir dhanda");
});

test("S5 Change location stays at the bottom, so the letter is never a dead end", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await toNote(page);
  await expect(slip(page).getByRole("button", { name: "Change location" })).toBeVisible();
  await page.getByRole("button", { name: "Change location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
});
