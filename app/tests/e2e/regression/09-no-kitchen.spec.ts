// Regression, screen 9: NK-A No kitchen here and NK-L2 the founder's letter. Cases: .claude/handoff/qa/screens/09-NK.md (epic #1196, story #1197). Reached with the shared steps STEPS["no-kitchen"] and STEPS["founder-note"].
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";
import { typePlace } from "../helpers";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const box = async (loc: import("@playwright/test").Locator) => (await loc.boundingBox())!;
const bg = (loc: import("@playwright/test").Locator) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);
const screen = (page: Page) => page.getByRole("group", { name: "No kitchen here" });
const letter = (page: Page) => page.getByRole("group", { name: "A letter from co-founder Satvik Jain" });
const noKitchenHeading = (page: Page) => page.getByRole("heading", { name: "We don't reach here yet" });
const tellButton = (page: Page) => page.getByRole("button", { name: "Tell me when you come here" });
const letterHeading = (page: Page) => page.getByRole("heading", { name: "You found us early. Thank you." });

test("TC 9.1 an address no kitchen serves: We don't reach here yet, the place row, filled Change location, outline Tell me when you come here, Step 4 of 4", async ({ page, context }) => {
  await STEPS["no-kitchen"](context, page, PATH);
  await expect(screen(page)).toBeVisible();   // the screen shows first, so the lines below can fail
  await expect(noKitchenHeading(page)).toBeVisible();
  await expect(screen(page)).toContainText("Step 4 of 4");
  await expect(screen(page).getByText("Sector 62", { exact: true })).toBeVisible();   // the place row
  await expect(screen(page)).toContainText("Noida, Uttar Pradesh 201301");
  const change = page.getByRole("button", { name: "Change location" });
  const tell = tellButton(page);
  await expect(change).toBeVisible();
  await expect(tell).toBeVisible();
  expect(await bg(change)).not.toBe("rgba(0, 0, 0, 0)");   // filled
  expect(await bg(tell)).toBe("rgba(0, 0, 0, 0)");         // outline
  const c = await box(change);
  const t = await box(tell);
  expect(c.y + c.height).toBeLessThanOrEqual(t.y);         // Change location above Tell me
});

test("TC 9.2 Tell me when you come here: the letter with the place, the Rs 100 promise, the motto, the signature, Share this note and Change location", async ({ page, context }) => {
  await STEPS["founder-note"](context, page, PATH);
  await expect(letter(page)).toBeVisible();   // the letter shows first, so the lines below can fail
  await expect(letterHeading(page)).toBeVisible();
  await expect(letter(page)).toContainText("We don't reach Sector 62 yet");   // the place name in the text
  await expect(letter(page).getByText("₹100 off", { exact: true })).toBeVisible();   // the promise the server stored (10000 paise)
  await expect(letter(page)).toContainText("Pahle banda, phir dhanda.");
  await expect(letter(page).locator(".ui-founder-sign")).toHaveText("Satvik");
  await expect(page.getByRole("button", { name: "Share this note" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change location" })).toBeVisible();
  await expect(screen(page)).toHaveCount(0);   // the letter replaces the No kitchen screen
});

test("TC 9.4 Change location goes to the map", async ({ page, context }) => {
  await STEPS["no-kitchen"](context, page, PATH);
  await expect(noKitchenHeading(page)).toBeVisible();   // the screen shows first
  await page.getByRole("button", { name: "Change location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await expect(noKitchenHeading(page)).toHaveCount(0);
});

test("TC 9.5 ask twice for the same place: both asks carry the same pin and both end on the same letter", async ({ page, context }) => {
  // Client half only. The rule "one wish per person and pin" lives in the area_request_add_v2 database function, which the test answers with ok every time.
  const sent: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/rpc/area_request_add_v2")) sent.push(r.postData() ?? ""); });
  await STEPS["no-kitchen"](context, page, PATH);
  await tellButton(page).click();
  await expect(letterHeading(page)).toBeVisible();
  await page.reload();   // back on the No kitchen screen for the same pin
  await expect(noKitchenHeading(page)).toBeVisible();
  await tellButton(page).click();
  await expect(letterHeading(page)).toBeVisible();
  await expect(letter(page)).toContainText("We don't reach Sector 62 yet");
  await expect.poll(() => sent.length).toBe(2);
  expect(sent.map((b) => JSON.parse(b).p_pin)).toEqual(["110099", "110099"]);
});

test("TC 9.6 a long place name wraps inside the letter; nothing is cut and the page does not scroll sideways", async ({ page, context }) => {
  const place = "Plot 14B Shanti Kunj Apartments Phase Two Extension Behind Metro Station Gate Four";
  await STEPS["no-kitchen"](context, page, PATH);
  // The shared step saved "Sector 62" as this customer's address, and the app picks a saved address on reload. Show an empty saved list for the read, so the long name stays.
  await context.route("https://test.supabase.co/rest/v1/addresses*", (r) => (r.request().method() === "GET" ? r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }) : r.fallback()));
  await typePlace(page, "110099", `${place}, Sector 62, Noida, Uttar Pradesh 201301`);   // the same screen, a long place name
  await expect(noKitchenHeading(page)).toBeVisible();
  await page.getByRole("button", { name: "Tell me when you come here" }).click();
  await expect(letterHeading(page)).toBeVisible();
  await expect(letter(page)).toContainText(`We don't reach ${place} yet`);   // the whole name is in the text
  const wrapped = letter(page).locator("p").filter({ hasText: "We don't reach Plot 14B" });
  const lineHeight = await wrapped.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  expect((await box(wrapped)).height).toBeGreaterThan(lineHeight * 1.5);   // it takes more than one line
  const slip = await box(letter(page));
  expect(slip.x).toBeGreaterThanOrEqual(0);
  expect(slip.x + slip.width).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const clipped = await letter(page).evaluate((root) => Array.from(root.querySelectorAll("p, b, h2")).filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(clipped).toBe(0);   // no text cut off inside the letter
});
