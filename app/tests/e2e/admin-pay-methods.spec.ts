// Story #1263 (epic #1259, board A10-PayMethods): the admin turns the ways to pay at the door on and off, and uploads the UPI QR the rider shows.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan } from "./helpers";

const OBJ = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png";
const PNG = { name: "qr.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") };
const toSettings = async (page: Page, context: Parameters<typeof setup>[0], over: Record<string, unknown> = {}) => {
  const net = await setup(context, page);
  net.state.admin = true;
  Object.assign(net.state, over);
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment methods" })).toBeVisible();
  return net;
};
const sw = (page: Page, name: string) => page.getByRole("switch", { name: new RegExp(`^${name}`) });   // the UPI switch also reads its one-line hint

test("A1 Settings shows Cash at the door and UPI at the door on, UPI online and Card online off, greyed, Not set up yet", async ({ page, context }) => {
  await toSettings(page, context);
  await expect(sw(page, "Cash at the door")).toBeChecked();
  await expect(sw(page, "UPI at the door")).toBeChecked();
  for (const name of ["UPI online", "Card online"]) { await expect(sw(page, name)).not.toBeChecked(); await expect(sw(page, name)).toBeDisabled(); }
  await expect(page.getByText("Not set up yet")).toHaveCount(2);
  await expect(page.getByText("Last changed by owner@goserve.test, 10 Nov")).toBeVisible();
});

test("A2 turning UPI at the door on saves, is still on after a reload, and the customer's bill offers it", async ({ page, context }) => {
  const net = await toSettings(page, context, { payAdmin: ["cash"], doorMethods: ["cash"], qrObject: OBJ });
  await sw(page, "UPI at the door").click();
  await expect(sw(page, "UPI at the door")).toBeChecked();
  await expect.poll(() => net.calls.rpc.filter((r) => r.name === "payment_methods_set_v2").map((r) => r.body)).toEqual([{ p_method: "upi_door", p_on: true }]);
  await page.reload();
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(sw(page, "UPI at the door")).toBeChecked();   // after a reload it is still on
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("radio", { name: /^UPI at the door/ })).toBeVisible();   // the customer's bill offers it
});

test("A2b turning UPI at the door off saves and the customer's bill no longer offers it", async ({ page, context }) => {
  const net = await toSettings(page, context, { qrObject: OBJ });
  await sw(page, "UPI at the door").click();
  await expect(sw(page, "UPI at the door")).not.toBeChecked();
  expect(net.state.payAdmin).toEqual(["cash"]);
});

test("A3 the last method stays on: the switch does not move and the line says one way always stays on", async ({ page, context }) => {
  await toSettings(page, context, { payAdmin: ["cash"] });
  await sw(page, "Cash at the door").click();
  await expect(page.getByRole("alert")).toHaveText("One way to pay must stay on.");
  await expect(sw(page, "Cash at the door")).toBeChecked();
});

test("A3b Cash cannot go off while no QR is uploaded: the line says Upload the UPI QR first and the switch stays on", async ({ page, context }) => {
  await toSettings(page, context);   // both methods on, no QR
  await expect(page.getByText("Customers see it once a QR is uploaded.")).toBeVisible();
  await sw(page, "Cash at the door").click();
  await expect(page.getByRole("alert")).toHaveText("Upload the UPI QR first.");
  await expect(sw(page, "Cash at the door")).toBeChecked();
});

test("A4 a failed save leaves the switch where the server holds it and shows an error", async ({ page, context }) => {
  const net = await toSettings(page, context);
  net.state.payFail = true;
  await sw(page, "UPI at the door").click();
  await expect(page.getByRole("alert")).toHaveText("Could not save. Try again.");
  await expect(sw(page, "UPI at the door")).toBeChecked();
});

test("A5 the QR row says No QR yet until one is uploaded; Change uploads the picture and sets it by its object name", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await expect(page.getByText("No QR yet. Riders cannot take UPI.")).toBeVisible();
  await page.getByLabel("Change the UPI QR").setInputFiles(PNG);
  await expect(page.getByText(/^Your QR · set by owner@goserve.test/)).toBeVisible();
  expect(net.calls.uploads.some((u) => /\/upi-qr\/qr-[0-9a-f-]{36}\.png$/.test(u))).toBe(true);
  expect(net.state.qrSets).toHaveLength(1);
  expect(net.state.qrSets[0]).toMatch(/^qr-[0-9a-f-]{36}\.png$/);   // a name, never an address
  await expect(page.getByRole("img", { name: "The UPI QR now in use" })).toHaveAttribute("src", /^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/upi-qr\/qr-/);
});

test("A6 a picture that is not PNG, JPG or WebP, or is over 2 MB, is refused with a line and nothing is uploaded", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await page.getByLabel("Change the UPI QR").setInputFiles({ name: "qr.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByRole("alert")).toHaveText("Pick a PNG, JPG or WebP picture.");
  await page.getByLabel("Change the UPI QR").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  await expect(page.getByRole("alert")).toHaveText("The picture is over 2 MB. Pick a smaller one.");
  expect(net.calls.uploads).toHaveLength(0);
});

test("A7 a failed upload shows a line and the QR stays as it was", async ({ page, context }) => {
  const net = await toSettings(page, context, { qrFail: "upload" });
  await page.getByLabel("Change the UPI QR").setInputFiles(PNG);
  await expect(page.getByRole("alert")).toHaveText("The picture could not be uploaded. Check the network and try again.");
  await expect(page.getByText("No QR yet. Riders cannot take UPI.")).toBeVisible();
  expect(net.state.qrSets).toEqual([]);
});

test("A7b a failed load of the settings shows a line with Try again, and Try again loads them", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true; net.state.payFail = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByText("Could not load the payment settings.")).toBeVisible();
  net.state.payFail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(sw(page, "Cash at the door")).toBeChecked();
});

test("A8 the payment settings have no serious contrast or role violation, day and Night", async ({ page, context }) => {
  for (const theme of ["day", "night"]) {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    await toSettings(page, context);
    expect(await scan(page, ["wcag2a", "wcag2aa"])).toEqual([]);
  }
});
