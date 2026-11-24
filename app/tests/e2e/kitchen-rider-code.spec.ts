// Story 1667 (epic 1652), board k3code (owner, 21 Nov 2026): with the Kitchen handoff code switch on, a Ready ticket that has a rider shows "Enter code".
// The sheet "Rider's code" has four boxes and no button; the fourth digit checks the code by itself. Wrong: boxes empty and red, one red line. Right: a tick,
// "Given to the rider", the order goes On the way and the sheet closes by itself. Switch off: as today. The rpcs are mocked here.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
const READY = { ...order("ready", NOW), rider_id: SESSION, kitchen_id: "k-1", customer_name: "Customer 1" };
type Reply = { status: number; body: unknown } | "abort";
const WRONG: Reply = { status: 200, body: { ok: false, error: "wrong_code", message: "That code is not right. Ask the rider again.", tries_left: 3 } };
const LOCKED: Reply = { status: 200, body: { ok: false, error: "code_locked", message: "Too many wrong tries. Ask support." } };
const SWITCH_OFF: Reply = { status: 200, body: { ok: false, error: "switch_off", message: "The hand-over code is not on." } };
const RIGHT: Reply = { status: 200, body: { ok: true, order: { status: "out_for_delivery" } } };

async function open(context: BrowserContext, page: Page, on: boolean | "down", reply: Reply = RIGHT) {
  const net = await setup(context, page, [READY]);
  net.state.kitchen = "k-1";
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: null, online: true, lat: null, lng: null };
  net.state.pickupOn = on;
  const sent: { p_order: string; p_code: string }[] = [];
  await context.route("**/rest/v1/rpc/kitchen_handover_v1*", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    if (reply === "abort") return route.abort().catch(() => {});
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) }).catch(() => {});
  });
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Cooking", exact: true }).click();
  return { net, sent, sheet: page.getByRole("dialog", { name: "Rider's code" }) };
}
const enter = (page: Page) => page.getByRole("button", { name: /^Enter code/ });
const boxes = (page: Page) => page.getByRole("dialog").locator(".ui-code-boxes input");
async function type(page: Page, code: string) { for (let i = 0; i < code.length; i++) await boxes(page).nth(i).fill(code[i]); }

test("KC1 switch on: a Ready ticket with a rider has Enter code; switch off: it does not", async ({ page, context }) => {
  await open(context, page, true);
  await expect(enter(page)).toBeVisible();
  const lines = await enter(page).evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size; });
  expect(lines).toBe(1);   // one line, as the frame shows it
});

test("KC2 switch off: no Enter code, the rider line stays as today", async ({ page, context }) => {
  await open(context, page, false);
  await expect(page.getByText("Ready · give to the rider")).toBeVisible();
  await expect(enter(page)).toHaveCount(0);
  await expect(page.getByText("Amit Kumar")).toBeVisible();
});

test("KC3 the sheet: four boxes, the lead line, no submit button, Close is the link", async ({ page, context }) => {
  const { sheet } = await open(context, page, true);
  await enter(page).click();
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Ask the rider for the 4 digit code.");
  await expect(boxes(page)).toHaveCount(4);
  await expect(sheet.locator(".ui-btn")).toHaveCount(0);
  await expect(sheet.locator("button.ui-link.ui-sheet-close")).toHaveText("Close");
});

test("KC4 the fourth digit checks by itself: one call with the order and the four digits", async ({ page, context }) => {
  const { sent } = await open(context, page, true);
  await enter(page).click();
  await type(page, "123");
  expect(sent).toHaveLength(0);
  await boxes(page).nth(3).fill("4");
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].p_code).toBe("1234");
  expect(sent[0].p_order).toBe(READY.id);
});

test("KC5 wrong code: the frame's line, boxes empty and red, the order stays Ready, typing again works", async ({ page, context }) => {
  const { sheet, sent } = await open(context, page, true, WRONG);
  await enter(page).click();
  await type(page, "1111");
  await expect(sheet.getByRole("alert")).toHaveText("That code does not match this order. Ask the rider to read it again.");
  for (let i = 0; i < 4; i++) { await expect(boxes(page).nth(i)).toHaveValue(""); await expect(boxes(page).nth(i)).toHaveAttribute("aria-invalid", "true"); }
  await expect(enter(page)).toBeVisible();   // behind the sheet, still Ready
  await type(page, "2222");
  await expect.poll(() => sent.length).toBe(2);
});

test("KC6 right code: tick, Given to the rider, the sheet closes by itself and the ticket leaves Ready", async ({ page, context }) => {
  await open(context, page, true, RIGHT);
  const sheet = page.getByRole("dialog");
  await enter(page).click();
  await type(page, "1234");
  await expect(sheet.getByText("Given to the rider")).toBeVisible();
  await expect(sheet.getByText(/is on the way\.$/)).toBeVisible();
  await expect(sheet).toHaveCount(0, { timeout: 5000 });
  await expect(enter(page)).toHaveCount(0);
});

test("KC7 locked: the approved line, the boxes are asleep", async ({ page, context }) => {
  const { sheet } = await open(context, page, true, LOCKED);
  await enter(page).click();
  await type(page, "1111");
  await expect(sheet.getByRole("alert")).toHaveText("Too many wrong codes. This code is locked. Ask your admin to hand this order over.");
  for (let i = 0; i < 4; i++) await expect(boxes(page).nth(i)).toBeDisabled();
});

test("KC8 no network: the approved line and the boxes are empty to type again", async ({ page, context }) => {
  const { sheet } = await open(context, page, true, "abort");
  await enter(page).click();
  await type(page, "1111");
  await expect(sheet.getByRole("alert")).toHaveText("We could not check the code. Check your internet and type it again.");
  await expect(boxes(page).nth(0)).toHaveValue("");
  await expect(boxes(page).nth(0)).toBeEnabled();
});

test("KC9 switch turned off while the sheet is open: the approved line, the rider can tap Picked up", async ({ page, context }) => {
  const { sheet } = await open(context, page, true, SWITCH_OFF);
  await enter(page).click();
  await type(page, "1111");
  await expect(sheet.getByRole("alert")).toHaveText("The hand-over code is switched off now. The rider can tap Picked up, as before.");
});

for (const size of SIZES) {
  test(`KC10 no line wraps past two lines and the boxes do not move when a line appears, at ${size.width}x${size.height}`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const { sheet } = await open(context, page, true, LOCKED);
    await enter(page).click();
    await page.waitForTimeout(600);   // the sheet slides up first
    const before = await boxes(page).nth(0).boundingBox();
    await type(page, "1111");
    const line = sheet.getByRole("alert");
    await expect(line).toBeVisible();
    const after = await boxes(page).nth(0).boundingBox();
    expect(after!.y).toBeCloseTo(before!.y, 0);
    const lh = await line.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
    expect((await line.boundingBox())!.height).toBeLessThanOrEqual(lh * 2 + 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  });
}
