// Story #1659 layer 2: the admin sets the support phone customers call, on the Numbers tab.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

type P = import("@playwright/test").Page;
async function toSettings(page: P, context: import("@playwright/test").BrowserContext, getAnswer?: { status: number; body: object }) {
  const net = await setup(context, page);
  net.state.admin = true;
  if (getAnswer) await page.route("**/rest/v1/rpc/support_phone_get_v2", (r) => r.fulfill({ status: getAnswer.status, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(getAnswer.body) }));
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  return net;
}
const setCalls = (net: Awaited<ReturnType<typeof toSettings>>) => net.calls.rpc.filter((c) => c.name === "support_phone_set_v2");

test("P1 the Support group shows after Login with the phone now", async ({ page, context }) => {
  await toSettings(page, context);
  await expect(page.getByRole("heading", { name: "Support", exact: true })).toBeVisible();
  await expect(page.getByText("Support phone", { exact: true })).toBeVisible();
  await expect(page.getByText("Customers call this number. 10 digits.")).toBeVisible();
  await expect(page.getByLabel("Support phone")).toHaveValue("90000 00000");
  await expect(page.getByText(/^Now 90000 00000 · set by owner@goserve.test, /)).toBeVisible();
});

test("P2 a good number saves and the Now line shows it", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await page.getByLabel("Support phone").fill("98765 43210");
  await page.getByRole("region", { name: "Support" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Now 98765 43210 · set by you, /)).toBeVisible();
  expect(setCalls(net).map((c) => c.body)).toEqual([{ p_phone: "9876543210" }]);
});

test("P3 a bad number shows the error and sends nothing", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await page.getByLabel("Support phone").fill("12345");
  await page.getByRole("region", { name: "Support" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Type a 10-digit mobile number." })).toBeVisible();
  expect(setCalls(net)).toEqual([]);
});

test("P4 a failed read says so", async ({ page, context }) => {
  await toSettings(page, context, { status: 500, body: { code: "XX000", message: "boom" } });
  await expect(page.getByText("Could not load the setting. Try again.")).toBeVisible();
});

test("P5 an unset number shows Not set yet.", async ({ page, context }) => {
  await toSettings(page, context, { status: 200, body: { phone: null, updated_by: null, updated_at: null } });
  await expect(page.getByText("Not set yet.")).toBeVisible();
  await expect(page.getByLabel("Support phone")).toHaveValue("");
});

test("P6 at 360x640 the field and Save fill the group, with no sideways scroll", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await toSettings(page, context);
  const group = page.getByRole("region", { name: "Support" });
  const field = await page.getByLabel("Support phone").boundingBox();
  const save = await group.getByRole("button", { name: "Save" }).boundingBox();
  const other = await page.getByRole("region", { name: "Login" }).boundingBox();
  const mine = await group.boundingBox();
  expect(field && save && other && mine).toBeTruthy();
  expect(Math.abs(save!.x - field!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(save!.width - field!.width)).toBeLessThanOrEqual(1);
  expect(mine!.x).toBe(other!.x);
  expect(mine!.width).toBe(other!.width);
  expect(field!.width).toBeGreaterThan(mine!.width - 40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`P7 at ${w}x${h} no two boxes meet: heading, label, field, Save keep 8 px apart`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await toSettings(page, context);
    const group = page.getByRole("region", { name: "Support" });
    const head = await group.getByRole("heading", { name: "Support", exact: true }).boundingBox();
    const label = await group.locator("label[for=support-phone]").boundingBox();
    const field = await page.getByLabel("Support phone").boundingBox();
    const save = await group.getByRole("button", { name: "Save" }).boundingBox();
    expect(head && label && field && save).toBeTruthy();
    expect(label!.y - (head!.y + head!.height)).toBeGreaterThanOrEqual(8);   // line above (heading) to the label that opens the field
    expect(field!.y - (label!.y + label!.height)).toBeGreaterThanOrEqual(0);  // label sits on its field (ui-field gap)
    expect(save!.y - (field!.y + field!.height)).toBeGreaterThanOrEqual(8);   // field to Save
  });
}
