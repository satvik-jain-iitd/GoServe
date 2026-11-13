// Story 1417 (boards BF1, BF2, BC1; owner 13 Nov 2026): the Bill asks the phone once and never the name.
// BF1: one field "Phone number · the rider calls you on it", Place order off until ten digits. BF2: the saved phone on one line with Change.
// BC1: Change turns the row into the BF1 field in place, filled, focused. Ten digits together, no gap. The kitchen ticket and the rider take the sign-in name, else "The customer".
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const LABEL = "Phone number · the rider calls you on it";
const toBill = async (page: Page) => {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeVisible();
};
const SAVED = { name: null, phone: "9876543210", address: "C-128, Green Park, New Delhi" };

test("P1 (BF1) a first order: one phone field with its reason, no name field, Place order off until ten digits", async ({ page, context }) => {
  await setup(context, page);
  await toBill(page);
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  const field = page.getByLabel(LABEL);
  await expect(field).toBeVisible();
  await page.getByLabel("Address").fill("C-128, Green Park");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
  await expect(page.getByText("Add your 10 digit phone number.")).toBeVisible();
  await field.fill("98765");
  await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
  await field.fill("9876543210");
  await expect(page.getByText("Add your 10 digit phone number.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("P2 (BF2) a saved phone: one line with the ten digits together and Change, no field", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.customer = SAVED;
  await toBill(page);
  await expect(page.getByLabel(LABEL)).toHaveCount(0);
  await expect(page.getByText("The rider calls you on")).toBeVisible();
  await expect(page.getByText("9876543210", { exact: true })).toBeVisible();   // no gap after five
  await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("P3 (BC1) Change turns the row into the field, filled and focused; a new number goes with Place order and the next bill shows it", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.customer = SAVED;
  await toBill(page);
  await page.getByRole("button", { name: "Change" }).click();
  const field = page.getByLabel(LABEL);
  await expect(field).toHaveValue("9876543210");
  await expect(field).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);   // no sheet
  await field.fill("9123456780");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect.poll(() => net.calls.customerWrites.length).toBeGreaterThan(0);
  expect(net.calls.customerWrites.at(-1)!.body).toMatchObject({ phone: "9123456780" });
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.state.customer = { ...SAVED, phone: "9123456780" };
  await page.goto("/customer/");   // a fresh load; a reload before it raced the goto on CI (ERR_ABORTED)
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByText("9123456780", { exact: true })).toBeVisible();
});

test("P4 no name typed: the sign-in name goes with the order", async ({ page, context }) => {
  const net = await setup(context, page);
  await toBill(page);
  await page.getByLabel("Address").fill("C-128, Green Park");
  await page.getByLabel(LABEL).fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect.poll(() => net.calls.customerWrites.length).toBeGreaterThan(0);
  expect(net.calls.customerWrites.at(-1)!.body).toMatchObject({ name: "Amit Kumar", phone: "9876543210" });
});

test("P5 no sign-in name and none saved: the save sends no name (null), never an empty one", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.phoneUser = true;   // a phone sign-in: no name from Google
  await toBill(page);
  await page.getByLabel("Address").fill("C-128, Green Park");
  await page.getByLabel(LABEL).fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect.poll(() => net.calls.customerWrites.length).toBeGreaterThan(0);
  expect(net.calls.customerWrites.at(-1)!.body.name).toBeNull();
});

test("P6 with the phone code switch on, checkout from the Bill opens no number sheet, no code sheet and no name sheet; the phone is the Bill's field", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.phoneUser = true;   // signed in, no name, no phone linked
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  await toBill(page);
  await page.getByLabel("Address").fill("C-128, Green Park");
  await page.getByLabel(LABEL).fill("9876543210");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(net.calls.customerWrites.at(-1)!.body).toMatchObject({ phone: "9876543210", name: null });
});
