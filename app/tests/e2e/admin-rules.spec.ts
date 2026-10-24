// Story H1 (#184): the Add kitchen and Add dish forms refuse a bad value before any call.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const fill = async (page: import("@playwright/test").Page, v: Partial<Record<string, string>> = {}) => {
  const f = { "Kitchen name": "Lajpat Nagar Kitchen", Address: "12 Lajpat Nagar, Delhi", Phone: "9876543210", "Pin codes": "110024", ...v };
  for (const [label, value] of Object.entries(f)) await page.getByLabel(label, { exact: true }).fill(value!);
};

test("S1 a kitchen with no pin code is refused before any call", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();   // H12: the forms live on the City tab
  await fill(page, { "Pin codes": "" });
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect(page.getByRole("alert")).toContainText("pin code");
  expect(net.calls.kitchenWrites).toHaveLength(0);
});

test("S1 a bad phone and the same opening and closing time are refused", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();   // H12: the forms live on the City tab
  await fill(page, { Phone: "12345" });
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect(page.getByRole("alert")).toContainText("phone");
  await fill(page);
  await page.getByLabel("Opens at").fill("10:00");
  await page.getByLabel("Closes at").fill("10:00");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect(page.getByRole("alert")).toContainText("time");
  expect(net.calls.kitchenWrites).toHaveLength(0);
});

test("S1 a complete kitchen is sent", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();   // H12: the forms live on the City tab
  await fill(page);
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBe(1);
  expect(net.calls.kitchenWrites[0].body).toMatchObject({ name: "Lajpat Nagar Kitchen", phone: "9876543210", pin_codes: ["110024"] });
});

test("S2 a price of zero or above 5000 rupees is refused before any call", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("tab", { name: "Menu" }).click();
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByLabel("Dish name").fill("Dal Makhani");
  for (const price of ["0", "5001"]) {
    await page.getByLabel("Price (₹)").fill(price);
    await page.getByRole("button", { name: "Add dish" }).click();
    await expect(page.getByRole("alert")).toContainText("price");
  }
  expect(net.calls.menuWrites).toHaveLength(0);
});
