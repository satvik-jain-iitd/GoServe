// Story #990, board K-EditKitchen: an admin edits a kitchen's details after Add. Location keeps its own map.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const K = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II, back lane", phone: "9876500011", pin_codes: ["110024", "110025"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" };
const open = async (page: Page, context: any) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = [K];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await page.getByRole("button", { name: "Edit details" }).click();
  return net;
};

test("S1 the sheet opens filled with the kitchen's details", async ({ page, context }) => {
  await open(page, context);
  const d = page.getByRole("dialog", { name: "Edit Tau Ka Dhaba" });
  await expect(d.getByLabel("Kitchen name")).toHaveValue("Tau Ka Dhaba");
  await expect(d.getByLabel("Pin codes")).toHaveValue("110024, 110025");
  await expect(d.getByLabel("Opens at")).toHaveValue("11:00");
  await expect(d.getByLabel("Closes at")).toHaveValue("22:00");
  await expect(d.getByLabel("Phone")).toHaveValue("9876500011");
  await expect(d.getByLabel("Address")).toHaveValue("C-4, Lajpat Nagar II, back lane");
  await expect(d).not.toContainText("the location pin has its own map");   // story #1044
});

test("S2 Save sends the new details and no location columns", async ({ page, context }) => {
  const net = await open(page, context);
  const d = page.getByRole("dialog", { name: "Edit Tau Ka Dhaba" });
  await d.getByLabel("Pin codes").fill("110024");
  await d.getByLabel("Phone").fill("9876500022");
  await d.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBeGreaterThan(0);
  const w = net.calls.kitchenWrites[0];
  expect(w.method).toBe("PATCH");
  expect(w.url).toContain("id=eq.k-1");
  expect(w.body).toMatchObject({ name: "Tau Ka Dhaba", pin_codes: ["110024"], phone: "9876500022", opens_at: "11:00", closes_at: "22:00" });
  expect(w.body).not.toHaveProperty("lat");
  await expect(d).toBeHidden();
});

test("S3 a bad phone is named in plain words and nothing is sent", async ({ page, context }) => {
  const net = await open(page, context);
  const d = page.getByRole("dialog", { name: "Edit Tau Ka Dhaba" });
  await d.getByLabel("Phone").fill("12345");
  await d.getByRole("button", { name: "Save" }).click();
  await expect(d.getByRole("alert")).toContainText("ten digits");
  expect(net.calls.kitchenWrites).toHaveLength(0);
});

test("S4 the close button leaves with no change", async ({ page, context }) => {
  const net = await open(page, context);
  const d = page.getByRole("dialog", { name: "Edit Tau Ka Dhaba" });
  await d.getByLabel("Kitchen name").fill("Other");
  await d.getByRole("button", { name: "Close" }).click();
  await expect(d).toBeHidden();
  expect(net.calls.kitchenWrites).toHaveLength(0);
});
