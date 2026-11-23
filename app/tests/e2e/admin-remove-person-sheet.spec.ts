// Story 1713: removing a person asks in our own sheet (red Remove left, Keep right, equal halves), not a browser box.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const RIDER = { kind: "rider", user_id: "r-9", email: "rider@example.com", kitchen_id: null, kitchen_name: null };
const open = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.people = [RIDER];
  net.state.riders = [{ user_id: "r-9", name: "Amit Kumar", phone: null, online: false }];
  let browserBox = 0;
  page.on("dialog", (d) => { browserBox++; void d.dismiss(); });
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  return { net, sheet: page.getByRole("dialog", { name: "Remove rider@example.com? They lose access at once." }), boxes: () => browserBox };
};
const removes = (net: Awaited<ReturnType<typeof open>>["net"]) => net.calls.rpc.filter((c) => c.name === "admin_remove_person");

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`S1 our own sheet opens, equal halves on one line at ${w}x${h}`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    const { sheet, boxes } = await open(page, context);
    await expect(sheet).toBeVisible();
    expect(boxes()).toBe(0);
    const remove = sheet.getByRole("button", { name: "Remove", exact: true });
    const keep = sheet.getByRole("button", { name: "Keep", exact: true });
    await expect(keep).toBeFocused();
    await page.waitForTimeout(600);   // the sheet slides in; measure after it rests
    const a = (await remove.boundingBox())!, b = (await keep.boundingBox())!;
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(a.x).toBeLessThan(b.x);   // red on the left
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(a.height).toBeLessThan(64);   // one line
    await expect(sheet.locator("a.ui-sheet-close, button.ui-sheet-close")).toHaveText("Close");
    if (w === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1713-remove-sheet-390x844.png" });
  });
}

test("S2 Keep closes and sends nothing", async ({ page, context }) => {
  const { net, sheet } = await open(page, context);
  await sheet.getByRole("button", { name: "Keep", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await page.waitForTimeout(200);
  expect(removes(net)).toHaveLength(0);
});

test("S3 Escape and a tap outside close with no change", async ({ page, context }) => {
  const { net, sheet } = await open(page, context);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  await page.mouse.click(180, 20);
  await expect(sheet).toHaveCount(0);
  expect(removes(net)).toHaveLength(0);
});

test("S4 Remove sends the same rpc as before", async ({ page, context }) => {
  const { net, sheet } = await open(page, context);
  await sheet.getByRole("button", { name: "Remove", exact: true }).click();
  await expect.poll(() => removes(net)[0]?.body).toEqual({ p_kind: "rider", p_user: "r-9", p_kitchen: null });
});

test("S5 Back closes the sheet", async ({ page, context }) => {
  const { net, sheet } = await open(page, context);
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  expect(removes(net)).toHaveLength(0);
});
