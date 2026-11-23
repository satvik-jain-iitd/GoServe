// Story #1792 (layer customer): an order GoServe (admin) cancelled shows the declined box with the owner's words.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { order, setup } from "./helpers";

const REASON = "Out of stock tonight.";
const LINE = "GoServe cancelled this order.";

async function open(context: BrowserContext, page: Page, by: string, reason: string | null) {
  await setup(context, page, [{ ...order("cancelled", "2020-01-01T10:02:00Z"), cancelled_by: by, cancel_reason: reason }]);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Butter Chicken/ }).click();
  await expect(page.locator(".ui-declined")).toBeVisible();
}

test("A1 admin cancel: first line, quoted reason, time line, money line", async ({ page, context }) => {
  await open(context, page, "admin", REASON);
  const box = page.locator(".ui-declined");
  await expect(box.locator("p").first()).toHaveText(LINE);
  await expect(box).toContainText(`“${REASON}”`);
  await expect(box.locator(".ui-declined-when")).toContainText("Cancelled");
  await expect(page.locator(".ui-slip-total")).toContainText("Nothing to pay");
  await expect(page.getByText("could not take this order")).toHaveCount(0);
  await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1792-admin-cancel-390x844.png" });
});

for (const [by, word] of [["admin", "Cancelled"], ["kitchen", "Declined"]]) {
  test(`A5 ${by}: stamp, heading and History say ${word}`, async ({ page, context }) => {
    await open(context, page, by, REASON);
    await expect(page.locator(".ui-stamp")).toHaveText(word);
    await expect(page.getByRole("heading", { name: word })).toBeVisible();
    await page.getByRole("button", { name: "Back to History" }).click();
    await expect(page.locator(".ui-order-row .ui-order-word.bad")).toHaveText(word);
  });
}

test("A2 blank reason shows no empty quotes; markup is plain text", async ({ page, context }) => {
  await open(context, page, "admin", "   ");
  await expect(page.locator(".ui-declined")).not.toContainText("“");
  await open(context, page, "admin", "<b>x</b>");
  await expect(page.locator(".ui-declined")).toContainText("“<b>x</b>”");
  await expect(page.locator(".ui-declined b")).toHaveCount(0);
});

test("A3 the kitchen decline box is unchanged", async ({ page, context }) => {
  await open(context, page, "kitchen", REASON);
  await expect(page.locator(".ui-declined")).toContainText("could not take this order");
  await expect(page.locator(".ui-declined")).not.toContainText(LINE);
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`A4 admin box equals kitchen box (${w}x${h})`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(context, page, "kitchen", REASON);
    // The kitchen's first line carries the kitchen's name and may wrap to two lines at 360 px; the owner's words never do. So the height is compared without the first line.
    const m = async () => ({ ...(await page.locator(".ui-declined").boundingBox())!, first: (await page.locator(".ui-declined strong").boundingBox())!.height });
    const k = await m();
    await open(context, page, "admin", REASON);
    const a = await m();
    for (const key of ["x", "y", "width"] as const) expect(Math.abs(a[key] - k[key])).toBeLessThanOrEqual(1);
    expect(Math.abs((a.height - a.first) - (k.height - k.first))).toBeLessThanOrEqual(1);
    console.log(`MEASURE ${w}x${h} kitchen ${JSON.stringify(k)} admin ${JSON.stringify(a)}`);
  });
}
