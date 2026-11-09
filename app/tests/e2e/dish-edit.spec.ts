// Story #936 (option B, boards M1-DishRows-B and M2-DishEdit): a dish row carries no buttons, tapping it opens one Edit sheet with every field,
// and Delete is the danger sheet of #955. The invite row's Cancel is a trash icon.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const open = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await expect(page.getByText("Butter Chicken", { exact: true })).toBeVisible();
  return net;
};

test("S1 a dish row carries no buttons of its own: the row itself is one tap target named Edit <dish>", async ({ page, context }) => {
  await open(page, context);
  const menu = page.getByRole("region", { name: "Menu" });
  await expect(menu.getByRole("button", { name: "Edit Butter Chicken" })).toBeVisible();
  for (const gone of [/Mark .* sold out/, /Put .* back in stock/, /Save price of/, /^Delete /]) await expect(menu.getByRole("button", { name: gone })).toHaveCount(0);
  await expect(menu.getByLabel("New price for Butter Chicken")).toHaveCount(0);
  const inRow = await menu.getByRole("button", { name: "Edit Butter Chicken" }).evaluate((e) => e.querySelectorAll("button, input, a").length);
  expect(inRow).toBe(0);   // nothing nested: a tap anywhere on the row opens the sheet
});

test("S2 tapping the row opens the Edit sheet with every field", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("button", { name: "Edit Butter Chicken" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Butter Chicken" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Change photo")).toBeVisible();
  for (const label of ["Dish name", "Price (₹)", "Category"]) await expect(sheet.getByLabel(label)).toBeVisible();
  await expect(sheet.getByRole("switch", { name: "Veg" })).toBeVisible();
  await expect(sheet.getByRole("switch", { name: "In stock" })).toBeChecked();
  await expect(sheet.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Delete this dish" })).toBeVisible();
  await expect(sheet.getByLabel("Dish name")).toHaveValue("Butter Chicken");
  await expect(sheet.getByLabel("Price (₹)")).toHaveValue("320");
});

test("S3 a new name, price and category are saved in one update, and only what changed is sent", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Edit Butter Chicken" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Butter Chicken" });
  await sheet.getByLabel("Dish name").fill("Butter Chicken Half");
  await sheet.getByLabel("Price (₹)").fill("350");
  await sheet.getByLabel("Category").fill("Mains");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0]).toMatchObject({ method: "PATCH", body: { name: "Butter Chicken Half", price_paise: 35000, category: "Mains" } });
  expect(Object.keys(net.calls.menuWrites[0].body).sort()).toEqual(["category", "name", "price_paise"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("S4 In stock off marks the dish sold out; a bad price is refused in words and nothing is sent", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Edit Butter Chicken" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Butter Chicken" });
  await sheet.getByLabel("Price (₹)").fill("abc");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("alert")).toContainText("Type the price in rupees");
  expect(net.calls.menuWrites).toHaveLength(0);
  await sheet.getByLabel("Price (₹)").fill("320");
  await sheet.getByRole("switch", { name: "In stock" }).uncheck();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0]).toMatchObject({ method: "PATCH", body: { available: false } });
});

test("S5 Delete this dish opens the danger sheet, not window.confirm; the word DELETE wakes the red button", async ({ page, context }) => {
  const net = await open(page, context);
  let native = 0;
  page.on("dialog", (d) => { native++; void d.dismiss(); });
  await page.getByRole("button", { name: "Edit Butter Chicken" }).click();
  await page.getByRole("dialog", { name: "Edit Butter Chicken" }).getByRole("button", { name: "Delete this dish" }).click();
  const danger = page.getByRole("dialog", { name: "Delete Butter Chicken?" });
  await expect(danger).toHaveClass(/\bui-danger\b/);
  const red = danger.getByRole("button", { name: "Delete this dish" });
  await expect(red).toBeDisabled();
  await danger.getByLabel("Type DELETE to go on").fill("DELETE");
  await expect(red).toBeEnabled();
  await red.click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0].method).toBe("DELETE");
  expect(native).toBe(0);
});

test("S6 a new photo is uploaded and its address is saved on the dish", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByRole("button", { name: "Edit Butter Chicken" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit Butter Chicken" });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await sheet.locator("input[type=file]").setInputFiles({ name: "dish.png", mimeType: "image/png", buffer: png });
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => net.calls.uploads.length).toBe(1);
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0].body.image_url).toMatch(/\/storage\/v1\/object\/public\/menu\//);
});

test("S7 an invited row's Cancel is a red trash icon button, 40 px round, with a screen-reader label", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.invites = [{ id: "i-9", email: "sunita.devi@gmail.com", kind: "kitchen", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen", created_at: "2026-11-04T10:00:00Z" }];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  const trash = page.getByRole("region", { name: "Staff" }).getByRole("button", { name: "Cancel the invite for sunita.devi@gmail.com" });
  await expect(trash).toBeVisible();
  const m = await trash.evaluate((e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return { w: Math.round(b.width), h: Math.round(b.height), round: parseFloat(s.borderTopLeftRadius) >= 20, svg: !!e.querySelector("svg"), text: (e.textContent ?? "").trim() }; });
  expect(m).toEqual({ w: 40, h: 40, round: true, svg: true, text: "" });
});
