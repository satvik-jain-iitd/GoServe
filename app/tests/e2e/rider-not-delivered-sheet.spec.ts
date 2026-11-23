// Story 1711 (owner yes 20 Nov 2026, frame notdelivered-sheet): Could not deliver? asks in our own sheet, never a browser box.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { ID, order, setup } from "./helpers";

const open = async (page: Page, context: BrowserContext) => {
  const net = await setup(context, page, [order("out_for_delivery", "2020-01-01T10:05:00Z")]);
  net.state.rider = { user_id: "7e57ab1e-0000-4000-8000-0000000000a1", name: "Rider", online: true, lat: null, lng: null };
  let browserBox = 0;
  page.on("dialog", (d) => { browserBox++; void d.dismiss(); });
  await page.goto("/rider/");
  await page.getByRole("button", { name: "Could not deliver?" }).click();
  return { net, boxes: () => browserBox };
};
const sheet = (page: Page) => page.getByRole("dialog", { name: `Mark order ${ID.slice(0, 8)} as not delivered?` });
const refusals = (net: Awaited<ReturnType<typeof open>>["net"]) => net.calls.rpc.filter((c) => c.name === "rider_refused");

test("ND1 the question is our own sheet with the same words, not a browser box; focus is on Go back", async ({ page, context }) => {
  const { boxes } = await open(page, context);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page)).toContainText("The customer refused it or was not there.");
  await expect(sheet(page).getByRole("button", { name: "Go back" })).toBeFocused();
  expect(boxes()).toBe(0);
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`ND2 at ${w} x ${h} the two buttons are equal halves on one line, red Not delivered left, Go back right`, async ({ page, context }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, context);
    await page.waitForTimeout(600);   // the sheet slides in; measure when it rests
    const red = (await sheet(page).getByRole("button", { name: "Not delivered", exact: true }).boundingBox())!;
    const back = (await sheet(page).getByRole("button", { name: "Go back", exact: true }).boundingBox())!;
    expect(Math.abs(red.width - back.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(red.height - back.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(red.y - back.y)).toBeLessThanOrEqual(1);
    expect(red.x).toBeLessThan(back.x);
    if (w === 390) await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.claude/handoff/dev/1711-not-delivered-sheet-390x844.png" });   // a picture for the reviewer, outside git
  });
}

test("ND3 Go back, Escape and a tap outside close the sheet and send nothing", async ({ page, context }) => {
  const { net } = await open(page, context);
  await sheet(page).getByRole("button", { name: "Go back" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Could not deliver?" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Could not deliver?" }).click();
  await page.mouse.click(5, 5);
  await expect(sheet(page)).toHaveCount(0);
  expect(refusals(net)).toHaveLength(0);
});

test("ND4 the phone Back closes the sheet and sends nothing", async ({ page, context }) => {
  const { net } = await open(page, context);
  await expect(sheet(page)).toBeVisible();
  await page.goBack();
  await expect(sheet(page)).toHaveCount(0);
  expect(refusals(net)).toHaveLength(0);
});

test("ND5 the red button sends rider_refused once and the order leaves the list", async ({ page, context }) => {
  const { net } = await open(page, context);
  await sheet(page).getByRole("button", { name: "Not delivered", exact: true }).click();
  await expect(page.getByText("No deliveries yet.")).toBeVisible();
  expect(refusals(net).map((c) => c.body)).toEqual([{ p_order: ID }]);
});
