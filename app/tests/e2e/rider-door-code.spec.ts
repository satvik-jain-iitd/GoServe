// Story 1669 (epic 1652), board k4door (owner, 21 Nov 2026): with the Customer handoff code switch on, Took cash or Paid by UPI opens the sheet "Customer's code"
// (four boxes, no button, the fourth digit checks). The right code marks the order Delivered on the existing Delivered screen. Switch off: as today. The rpcs are mocked here.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const KITCHEN = { id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
const onTheWay = () => ({ ...order("out_for_delivery", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" });
const SIZES = [{ width: 360, height: 640 }, { width: 390, height: 844 }];
type Reply = { status: number; body: unknown } | "abort";
const WRONG: Reply = { status: 200, body: { ok: false, error: "wrong_code", message: "That code is not right. Ask the customer again.", tries_left: 3 } };
const LOCKED: Reply = { status: 200, body: { ok: false, error: "code_locked", message: "Too many wrong tries. Call support." } };
const OFF: Reply = { status: 200, body: { ok: false, error: "switch_off", message: "The delivery code is not on." } };
const RIGHT: Reply = { status: 200, body: { ok: true, order: { id: ID, status: "delivered", updated_at: new Date().toISOString(), paid_by: "cash" } } };

async function open(context: BrowserContext, page: Page, on: boolean | "down", reply: Reply = RIGHT) {
  const net = await setup(context, page, [onTheWay()]);
  net.state.qrObject = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png";
  net.state.kitchens = [KITCHEN];
  net.state.dropOn = on;
  const sent: { p_order: string; p_code: string; p_method: string | null }[] = [];
  await context.route("**/rest/v1/rpc/rider_deliver_v1*", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    if (reply === "abort") return route.abort().catch(() => {});
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) }).catch(() => {});
  });
  await page.goto("/rider/");
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: "Collect", exact: true }).click();
  return { net, sent, sheet: page.getByRole("dialog", { name: "Customer's code" }) };
}
const took = (page: Page, how = "Took cash") => page.getByRole("button", { name: new RegExp(`^${how}`) });
const boxes = (page: Page) => page.getByRole("dialog").locator(".ui-code-boxes input");
async function type(page: Page, code: string) { for (let i = 0; i < code.length; i++) await boxes(page).nth(i).fill(code[i]); }

test("DC1 switch on: Took cash opens the sheet, not Delivered; four boxes, the lead line, no button, Close is the link", async ({ page, context }) => {
  const { sheet } = await open(context, page, true);
  await took(page).click();
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Ask the customer for the 4 digit code on their order screen.");
  await expect(boxes(page)).toHaveCount(4);
  await expect(sheet.locator(".ui-btn")).toHaveCount(0);
  await expect(sheet.locator("button.ui-link.ui-sheet-close")).toHaveText("Close");
  await expect(page.getByText("Delivered", { exact: true })).toHaveCount(0);
});

test("DC2 switch off: Took cash marks Delivered at once, no sheet", async ({ page, context }) => {
  await open(context, page, false);
  await took(page).click();
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("DC3 the fourth digit checks by itself: one call with the order, the digits and the way it was paid", async ({ page, context }) => {
  const { sent } = await open(context, page, true);
  await took(page, "Paid by UPI").click();
  await type(page, "123");
  expect(sent).toHaveLength(0);
  await boxes(page).nth(3).fill("4");
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ p_order: ID, p_code: "1234", p_method: "upi_door" });
});

test("DC4 right code: the sheet goes and the existing Delivered screen shows", async ({ page, context }) => {
  await open(context, page, true, RIGHT);
  await took(page).click();
  await type(page, "1234");
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("DC5 wrong code: the line, boxes empty and red, still on Collect payment, typing again works", async ({ page, context }) => {
  const { sheet, sent } = await open(context, page, true, WRONG);
  await took(page).click();
  await type(page, "1111");
  await expect(sheet.getByRole("alert")).toHaveText("That code does not match this order. Ask the customer to read it again.");
  for (let i = 0; i < 4; i++) { await expect(boxes(page).nth(i)).toHaveValue(""); await expect(boxes(page).nth(i)).toHaveAttribute("aria-invalid", "true"); }
  await type(page, "2222");
  await expect.poll(() => sent.length).toBe(2);
});

test("DC6 locked: the approved line, the boxes are asleep", async ({ page, context }) => {
  const { sheet } = await open(context, page, true, LOCKED);
  await took(page).click();
  await type(page, "1111");
  await expect(sheet.getByRole("alert")).toHaveText("Too many wrong codes. This code is locked. Ask your admin to mark this order delivered.");
  for (let i = 0; i < 4; i++) await expect(boxes(page).nth(i)).toBeDisabled();
});

test("DC7 no network: the approved line, boxes empty and awake", async ({ page, context }) => {
  const { sheet } = await open(context, page, true, "abort");
  await took(page).click();
  await type(page, "1111");
  await expect(sheet.getByRole("alert")).toHaveText("We could not check the code. Check your internet and type it again.");
  await expect(boxes(page).nth(0)).toHaveValue("");
  await expect(boxes(page).nth(0)).toBeEnabled();
});

test("DC8 switch turned on after the screen read it off: the tap is refused with code_required and the sheet opens with the approved line", async ({ page, context }) => {
  const { sheet } = await open(context, page, false);
  await context.route("**/functions/v1/order-actions*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "code_required", message: "Ask the customer for the code." }) }));
  await took(page).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("status")).toHaveText("The customer's code is switched on now. Ask the customer for the 4 digit code on their order screen.");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const size of SIZES) {
  test(`DC9 locked line is two lines at most and the boxes do not move when it appears, at ${size.width}x${size.height}`, async ({ page, context }) => {
    await page.setViewportSize(size);
    const { sheet } = await open(context, page, true, LOCKED);
    await took(page).click();
    await page.waitForTimeout(600);
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

test("DC10 a focused box turns its own border the brand colour: no ring, the box keeps its size", async ({ page, context }) => {
  await open(context, page, true);
  await took(page).click();
  const first = boxes(page).nth(0);
  await page.getByRole("dialog").getByRole("heading").click();
  const rest = await first.boundingBox();
  await first.focus();
  const st = await first.evaluate((e) => { const c = getComputedStyle(e); return { outline: c.outlineStyle, border: c.borderTopWidth, color: c.borderTopColor }; });
  expect(st.outline).toBe("none");
  expect(st.border).toBe("2px");
  expect(st.color).not.toBe(await boxes(page).nth(1).evaluate((e) => getComputedStyle(e).borderTopColor));
  const now = await first.boundingBox();
  expect([now!.width, now!.height]).toEqual([rest!.width, rest!.height]);
});

for (const size of SIZES) {
  test(`DC11 the four boxes sit in the middle of the sheet: equal space left and right at ${size.width}x${size.height}`, async ({ page, context }) => {
    await page.setViewportSize(size);
    await open(context, page, true);
    await took(page).click();
    await page.waitForTimeout(600);
    const sheet = (await page.getByRole("dialog").boundingBox())!;
    const f = (await boxes(page).nth(0).boundingBox())!;
    const l = (await boxes(page).nth(3).boundingBox())!;
    expect(Math.abs((f.x - sheet.x) - (sheet.x + sheet.width - (l.x + l.width)))).toBeLessThanOrEqual(1);
  });
}

test("DC-1671 the sheet has one link Call GoServe under the boxes (no skip); a wrong code moves neither the boxes nor the red line", async ({ page, context }) => {
  const { net, sheet } = await open(context, page, true, WRONG);
  net.state.supportPhone = "9000000000";
  await page.reload();
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: "Collect", exact: true }).click();
  await took(page).click();
  await expect(sheet).toBeVisible();
  const link = sheet.getByRole("link", { name: "Call GoServe" });
  await expect(link).toHaveAttribute("href", "tel:9000000000");
  await expect(sheet.getByRole("button", { name: /skip|deliver/i })).toHaveCount(0);
  const at = async () => ({ boxes: await sheet.locator(".ui-code-boxes").boundingBox(), line: await sheet.locator(".ui-code-line").boundingBox(), link: await link.boundingBox() });
  let before = await at();
  await expect.poll(async () => { const prev = before; before = await at(); return JSON.stringify(prev) === JSON.stringify(before); }).toBe(true);   // the sheet has stopped sliding in
  expect(before.link!.y).toBeGreaterThanOrEqual(before.line!.y + before.line!.height - 1);
  expect(before.link!.height).toBeGreaterThanOrEqual(44);
  await type(page, "1234");
  await expect(sheet.locator(".ui-code-line")).toContainText("That code does not match this order");
  expect(await at()).toEqual(before);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.worktrees/hc/.claude/handoff/dev/1671-door-link-390x844.png" });
});
