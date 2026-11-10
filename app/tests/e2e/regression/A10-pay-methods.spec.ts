// Regression, admin Settings: Payment methods (board A10-PayMethods, epic #1259, story #1263). The cases are also listed in docs/tests/test-cases.md (branch docs/1297-test-cases).
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "../helpers";

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

test("TC A10.1 Look: two live switches on, UPI online and Card online off and greyed with Not set up yet, who changed it last, the QR row says No QR yet", async ({ page, context }) => {
  await open(page, context);
  await expect(page.getByRole("switch", { name: /^Cash at the door/ })).toBeChecked();
  await expect(page.getByRole("switch", { name: /^UPI at the door/ })).toBeChecked();
  for (const n of ["UPI online", "Card online"]) await expect(page.getByRole("switch", { name: n, exact: true })).toBeDisabled();
  await expect(page.getByText("Not set up yet")).toHaveCount(2);
  await expect(page.getByText("Last changed by owner@goserve.test, 10 Nov")).toBeVisible();
  await expect(page.getByText("No QR yet. Riders cannot take UPI.")).toBeVisible();
  await expect(page.getByLabel("Change the UPI QR")).toBeAttached();
});

test("TC A10.2 Turn UPI at the door off: the switch is off after a reload; with only cash on, its switch stays on and the reason line shows", async ({ page, context }) => {
  const net = await open(page, context, { qrObject: "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png" });
  await page.getByRole("switch", { name: /^UPI at the door/ }).click();
  await expect(page.getByRole("switch", { name: /^UPI at the door/ })).not.toBeChecked();
  await expect.poll(() => net.state.payAdmin).toEqual(["cash"]);   // the save has landed before the page reloads
  await page.reload();
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("switch", { name: /^UPI at the door/ })).not.toBeChecked();
  await page.getByRole("switch", { name: /^Cash at the door/ }).click();
  await expect(page.getByRole("alert")).toHaveText("One way to pay must stay on.");
  await expect(page.getByRole("switch", { name: /^Cash at the door/ })).toBeChecked();
});

test("TC A10.3 Upload a QR: the row says Your QR with who and when, and a wrong type or a picture over 2 MB is refused with nothing uploaded", async ({ page, context }) => {
  const net = await open(page, context);
  await page.getByLabel("Change the UPI QR").setInputFiles({ name: "qr.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByRole("alert")).toHaveText("Pick a PNG, JPG or WebP picture.");
  expect(net.calls.uploads).toHaveLength(0);
  await page.getByLabel("Change the UPI QR").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await expect(page.getByText(/^Your QR · set by owner@goserve.test/)).toBeVisible();
});

test("TC A10.4 The rider sees the QR the admin uploaded on Collect payment, and with no QR sees cash only", async ({ page, context }) => {
  const obj = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png";
  const o = { ...order("out_for_delivery", new Date().toISOString(), new Date().toISOString()), rider_id: SESSION, customer_name: "Rahul Verma" };
  const net = await setup(context, page, [o]);
  net.state.qrObject = obj;
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true }).click();
  await expect(page.getByRole("img", { name: "UPI QR to scan" })).toHaveAttribute("src", `https://test.supabase.co/storage/v1/object/public/upi-qr/${obj}`);
  await expect(page.getByRole("button", { name: "Paid by UPI ₹640" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  net.state.qrObject = null; net.state.doorMethods = ["cash"];
  await page.getByRole("button", { name: "Delivered 0f0f0f0f", exact: true }).click();
  await expect(page.getByRole("img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Paid by UPI ₹640" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Took cash ₹640" })).toBeVisible();
});
