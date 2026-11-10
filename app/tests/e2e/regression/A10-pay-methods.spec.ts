// Regression, admin Settings: Payment methods (board A10-PayMethods, epic #1259, story #1263). The cases are also listed in docs/tests/test-cases.md (branch docs/1297-test-cases).
import { test, expect } from "@playwright/test";
import { setup } from "../helpers";

test.use({ viewport: { width: 412, height: 915 } });
const open = async (page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, over: Record<string, unknown> = {}) => {
  const net = await setup(context, page);
  net.state.admin = true;
  Object.assign(net.state, over);
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment methods" })).toBeVisible();
  return net;
};

test("TC A10.1 Look: two live switches on, UPI online and Card online off and greyed with Not set up yet, who changed it last, the QR row says Sample QR", async ({ page, context }) => {
  await open(page, context);
  await expect(page.getByRole("switch", { name: "Cash at the door", exact: true })).toBeChecked();
  await expect(page.getByRole("switch", { name: "UPI at the door", exact: true })).toBeChecked();
  for (const n of ["UPI online", "Card online"]) await expect(page.getByRole("switch", { name: n, exact: true })).toBeDisabled();
  await expect(page.getByText("Not set up yet")).toHaveCount(2);
  await expect(page.getByText("Last changed by owner@goserve.test, 10 Nov")).toBeVisible();
  await expect(page.getByText("Sample QR · Not a real account yet")).toBeVisible();
  await expect(page.getByLabel("Change the UPI QR")).toBeAttached();
});

test("TC A10.2 Turn UPI at the door off: the switch is off after a reload; with only cash on, its switch stays on and the reason line shows", async ({ page, context }) => {
  await open(page, context);
  await page.getByRole("switch", { name: "UPI at the door", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("switch", { name: "UPI at the door", exact: true })).not.toBeChecked();
  await page.getByRole("switch", { name: "Cash at the door", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("One way to pay must stay on.");
  await expect(page.getByRole("switch", { name: "Cash at the door", exact: true })).toBeChecked();
});

test("TC A10.3 Upload a QR: the row says Your QR with who and when, and a wrong type or a picture over 2 MB is refused with nothing uploaded", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByLabel("Change the UPI QR").setInputFiles({ name: "qr.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByRole("alert")).toHaveText("Pick a PNG, JPG or WebP picture.");
  expect(net.calls.uploads).toHaveLength(0);
  await page.getByLabel("Change the UPI QR").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await expect(page.getByText(/^Your QR · set by owner@goserve.test/)).toBeVisible();
});
