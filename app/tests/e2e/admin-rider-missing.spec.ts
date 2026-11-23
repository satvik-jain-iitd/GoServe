// Story 1655 part 2: the City list marks a rider with no name or no number and offers Add. Made-up names, phone 9000000000.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const RIDERS = [
  { user_id: "r-1", name: "Ravi Kumar", phone: "9000000000", online: true },
  { user_id: "r-2", name: null, phone: null, online: true },
  { user_id: "r-3", name: "Sunil Yadav", phone: null, online: false },
];
const MARK = "Name and number missing";
const open = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page); net.state.admin = true; net.state.riders = RIDERS.map((r) => ({ ...r }));
  const sets: any[] = [];
  await page.route("**/rpc/admin_set_rider", async (route) => {   // the mock has no such rpc: answer it here and keep the list in step
    const b = route.request().postDataJSON(); sets.push(b);
    const r = (net.state.riders as any[]).find((x) => x.user_id === b.p_user); if (r) { r.name = b.p_name; r.phone = b.p_phone; }
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click();
  await expect(page.getByText("Ravi Kumar")).toBeVisible();
  return { net, sets };
};
const rows = (page: Page) => page.locator('section[aria-label="Riders"] .ui-row-static');

test("M1 only a rider with no name or no number has the mark and Add", async ({ page, context }) => {
  await open(page, context);
  await expect(page.getByText(MARK)).toHaveCount(2);
  await expect(rows(page).getByRole("button", { name: "Add", exact: true })).toHaveCount(2);
  await expect(rows(page).filter({ hasText: "Ravi Kumar" }).getByText(MARK)).toHaveCount(0);
  await expect(rows(page).filter({ hasText: "Sunil Yadav" }).getByText(MARK)).toBeVisible();
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`M2 the marked row is as tall as a named row at ${w}x${h}`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, context);
    const named = (await rows(page).filter({ hasText: "Ravi Kumar" }).boundingBox())!.height;
    const marked = (await rows(page).filter({ hasText: "Sunil Yadav" }).boundingBox())!.height;
    const bare = (await rows(page).filter({ hasText: MARK }).first().boundingBox())!.height;
    expect(Math.abs(marked - named)).toBeLessThanOrEqual(1);
    expect(Math.abs(bare - named)).toBeLessThanOrEqual(1);
    if (w === 390) await rows(page).first().locator("xpath=..").screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1655-rider-missing-390x844.png" });
  });
}

test("M3 Add opens the sheet, a 9-digit number is refused, a good save sends and clears the mark", async ({ page, context }) => {
  const { sets } = await open(page, context);
  await rows(page).filter({ hasText: "Sunil Yadav" }).getByRole("button", { name: "Add" }).click();
  const sheet = page.getByRole("dialog", { name: "Rider's name and number" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Mobile number (10 digits)").fill("900000000");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Type a 10-digit mobile number.");
  expect(sets).toHaveLength(0);
  await sheet.getByLabel("Mobile number (10 digits)").fill("9000000000");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => sets.length).toBe(1);
  expect(sets[0]).toMatchObject({ p_user: "r-3", p_name: "Sunil Yadav", p_phone: "9000000000" });
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText(MARK)).toHaveCount(1);
  await expect(rows(page).filter({ hasText: "Sunil Yadav" }).getByText("9000000000")).toBeVisible();
});

test("M4 Not now and the phone Back close the sheet and send nothing", async ({ page, context }) => {
  const { sets } = await open(page, context);
  const sheet = page.getByRole("dialog", { name: "Rider's name and number" });
  const add = rows(page).filter({ hasText: "Sunil Yadav" }).getByRole("button", { name: "Add" });
  await add.click(); await sheet.getByRole("button", { name: "Not now" }).click(); await expect(sheet).toHaveCount(0);
  await add.click(); await expect(sheet).toBeVisible(); await page.goBack(); await expect(sheet).toHaveCount(0);
  expect(sets).toHaveLength(0);
});
