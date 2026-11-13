// Regression, screen 8: C7a Address details. Cases: .claude/handoff/qa/screens/08-C7a.md (epic #1196, story #1197). Reached with the shared step STEPS["pin-details"].
import { test, expect, type Page } from "@playwright/test";
import { STEPS } from "../screensSteps";

const PATH = "/customer/";
test.use({ viewport: { width: 390, height: 844 } });

const sheet = (page: Page) => page.getByRole("dialog", { name: "Address details" });
const house = (page: Page) => sheet(page).getByLabel("House, flat, floor");
const saveBtn = (page: Page) => sheet(page).getByRole("button", { name: "Save address" });
const confirm = (page: Page) => page.getByRole("button", { name: "Confirm & proceed" });
const geocodes = (page: Page) => {
  const looked: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/functions/v1/geocode")) looked.push(r.url()); });   // the map asks for the words at its centre once it settles
  return looked;
};

// WCAG contrast, the same arithmetic as the C7a spec (story #1117).
const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const toRgb = (page: Page, css: string) => page.evaluate((v) => { const cv = document.createElement("canvas").getContext("2d")!; cv.fillStyle = v; cv.fillRect(0, 0, 1, 1); return Array.from(cv.getImageData(0, 0, 1, 1).data).slice(0, 3); }, css);

test("TC 8.1 the sheet: Address details, no step count, the place with Change, two fields with e.g. examples, Home on, Save address grey", async ({ page, context }) => {
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();   // proves the screen shows, so the lines below can fail
  await expect(sheet(page).getByRole("heading", { name: "Address details" })).toBeVisible();
  await expect(sheet(page).getByText(/Step \d of \d/)).toHaveCount(0);   // 1404 (owner, 13 Nov): no step count anywhere
  await expect(sheet(page).getByRole("button", { name: "Change" })).toBeVisible();
  const placeRow = sheet(page).getByRole("button", { name: "Change" }).locator("..");   // the row holds the place name beside Change
  await expect.poll(async () => ((await placeRow.textContent()) ?? "").replace("Change", "").trim().length).toBeGreaterThan(0);
  await expect(house(page)).toHaveAttribute("placeholder", /^e\.g\./);
  await expect(sheet(page).getByLabel("Landmark (optional)")).toHaveAttribute("placeholder", /^e\.g\./);
  await expect(sheet(page).getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(saveBtn(page)).toBeDisabled();
  const grey = await saveBtn(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b] = (await toRgb(page, grey));
  expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(16);   // the grey look of a sleeping button: a warm grey is allowed, a lime or brand colour is not
  // the example is in the same font and size as typed text, and lighter than it
  const f = await house(page).evaluate((el) => {
    const st = getComputedStyle(el), ph = getComputedStyle(el, "::placeholder");
    return { font: st.fontFamily === ph.fontFamily, size: st.fontSize === ph.fontSize, text: st.color, ph: ph.color };
  });
  expect(f.font).toBe(true);
  expect(f.size).toBe(true);
  expect(f.ph).not.toBe(f.text);
  expect(lum(await toRgb(page, f.ph))).toBeGreaterThan(lum(await toRgb(page, f.text)));
});

test("TC 8.2 the field edges are at least 3:1 against the sheet", async ({ page, context }) => {
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();
  const c = await house(page).evaluate((el) => ({ border: getComputedStyle(el).borderTopColor, bg: getComputedStyle(el.closest(".ui-pinmap-details")!).backgroundColor }));
  const landmark = await sheet(page).getByLabel("Landmark (optional)").evaluate((el) => ({ border: getComputedStyle(el).borderTopColor, bg: getComputedStyle(el.closest(".ui-pinmap-details")!).backgroundColor }));
  expect(ratio(await toRgb(page, c.border), await toRgb(page, c.bg))).toBeGreaterThanOrEqual(3);
  expect(ratio(await toRgb(page, landmark.border), await toRgb(page, landmark.bg))).toBeGreaterThanOrEqual(3);
});

test("TC 8.3 type a house number, Save address: the menu opens and the address is saved as Home (owner checks the look)", async ({ page, context }) => {
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();
  await house(page).fill("12B, 2nd floor");
  await expect(saveBtn(page)).toBeEnabled();
  await saveBtn(page).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Home\b/ })).toContainText("12B, 2nd floor");   // the menu shows the saved address
  await expect(page.getByRole("button", { name: "Confirm & proceed" })).toHaveCount(0);
});

test("TC 8.4 Save address with the house empty: the button stays grey and a reason line says what is missing", async ({ page, context }) => {
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();   // the screen shows before the absence is checked
  await expect(saveBtn(page)).toBeVisible();
  await expect(saveBtn(page)).toBeDisabled();
  await expect(sheet(page).getByRole("status")).toHaveText("Add your house or flat number.");
  await house(page).fill("1");
  await expect(saveBtn(page)).toBeEnabled();
  await expect(sheet(page).getByRole("status")).toHaveCount(0);   // the reason line goes away once it is true (the count is live)
});

test("TC 8.5 pick Other: a name field appears for the label", async ({ page, context }) => {
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByLabel("Name this place")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Other", exact: true }).click();
  await expect(sheet(page).getByLabel("Name this place")).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Other", exact: true })).toHaveAttribute("aria-pressed", "true");
});

// Expected: Change goes back to the map at the same pin, so the address saved after it is the pin the sheet was opened on.
// Found in run: Change moves the map about 260 m south (28.5677 to 28.5653); the Save after it stores the moved pin.
test("TC 8.6 tap Change: back to the map at the same pin", async ({ page, context }) => {
  const posts: string[] = [];
  const looked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/functions/v1/geocode")) looked.push(r.url());
    if (r.url().includes("/rest/v1/addresses") && r.method() === "POST") posts.push(r.postData() ?? "");
  });
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();
  await expect.poll(() => looked.length).toBeGreaterThan(0);   // the words for the pin were asked for before the sheet opened
  const pin = new URL(looked.at(-1)!).searchParams;
  await sheet(page).getByRole("button", { name: "Change" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(confirm(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
  await confirm(page).click();
  await expect(sheet(page)).toBeVisible();
  await house(page).fill("12B");
  await saveBtn(page).click();
  await expect.poll(() => posts.length).toBe(1);
  const saved = JSON.parse(posts[0]);
  expect(saved.lat).toBeCloseTo(Number(pin.get("lat")), 4);   // the same pin as before Change (about 10 m)
  expect(saved.lng).toBeCloseTo(Number(pin.get("lng")), 4);
});

test("TC 8.7 200 letters in House: the field takes them up to its limit and Save stays on screen", async ({ page, context }) => {
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();
  const long = "a".repeat(200);
  await house(page).fill(long);
  await expect(house(page)).toHaveValue(/^a+$/);
  const len = await house(page).inputValue();
  expect(len.length).toBe(120);   // the field's own limit (maxLength 120): the letters go in, the rest is cut, no error
  await expect(saveBtn(page)).toBeEnabled();
  const b = (await saveBtn(page).boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(844);   // still on the phone's screen
});

test("TC 8.8 no kitchen serves the pin when saving: NK-A shows, not an error", async ({ page, context }) => {
  await STEPS["pin-details"](context, page, PATH);
  await expect(sheet(page)).toBeVisible();
  // the kitchens answer now without a kitchen for this pin, as if none serves it when the address is saved
  await context.route("https://test.supabase.co/rest/v1/kitchens**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
  await house(page).fill("12B");
  await saveBtn(page).click();
  await expect(page.getByRole("heading", { name: "We don't reach here yet" })).toBeVisible();
  await expect(page.getByRole("group", { name: "No kitchen here" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
