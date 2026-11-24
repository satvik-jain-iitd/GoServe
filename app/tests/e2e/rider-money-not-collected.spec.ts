// Story 1319 (owner approved notpaid-frames): Collect payment has a quiet link "Money not collected?". It opens the sheet with four reasons, Other asks for words,
// red Not collected (asleep until a reason is picked) on the left, Go back on the right. The save is one rpc; the order ends on the Delivered screen.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const KITCHEN = { id: "k", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "00:00:00", closes_at: "23:59:00" };
const onTheWay = () => ({ ...order("out_for_delivery", NOW, NOW), rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210", total_paise: 64000 });

async function open(context: BrowserContext, page: Page, reply: object = { ok: true, order: { id: ID, status: "delivered" } }) {
  const net = await setup(context, page, [onTheWay()]);
  net.state.kitchens = [KITCHEN];
  const sent: { p_order: string; p_reason: string; p_note: string | null }[] = [];
  await context.route("**/rest/v1/rpc/rider_money_not_collected_v1*", async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) }).catch(() => {});
  });
  await page.goto("/rider/");
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: "Collect", exact: true }).click();
  return { sent, sheet: page.getByRole("dialog", { name: "Money not collected" }) };
}

test("MN1 the link opens the sheet; four full-width rows; red Not collected asleep until a reason; Other asks for words; one rpc; Delivered screen", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { sent, sheet } = await open(context, page);
  const took = await page.getByRole("button", { name: /^Took cash/ }).boundingBox();
  await page.getByRole("button", { name: "Money not collected?" }).click();
  await expect(sheet).toBeVisible();
  expect(await page.getByRole("button", { name: /^Took cash/ }).boundingBox()).toEqual(took);   // nothing behind the sheet moved
  await expect(sheet.locator("button.ui-link.ui-sheet-close")).toHaveText("Close");
  await expect(sheet).toContainText(`Order ${ID.slice(0, 8)} · ₹640. Why? Pick one.`);
  const rows = sheet.locator(".ui-pay-row");
  await expect(rows).toHaveText(["Says it is already paid", "Will pay later", "Did not have the money", "Other"]);
  const w = await rows.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(new Set(w).size).toBe(1);
  const red = sheet.getByRole("button", { name: "Not collected", exact: true });
  const back = sheet.getByRole("button", { name: "Go back", exact: true });
  await expect(red).toBeDisabled();
  await page.waitForTimeout(600);
  const [r, b] = [(await red.boundingBox())!, (await back.boundingBox())!];
  expect(Math.abs(r.width - b.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.y - b.y)).toBeLessThanOrEqual(1);
  expect(r.x).toBeLessThan(b.x);
  await rows.nth(3).click();
  await expect(red).toBeDisabled();   // Other needs words
  await sheet.getByLabel("Say why").fill("Wallet at home");
  await expect(red).toBeEnabled();
  await page.screenshot({ path: "/Users/satvikjain/Documents/GoServe/.worktrees/hc/.claude/handoff/dev/1319-sheet-390x844.png" });
  await red.click();
  await expect(sheet).toHaveCount(0);
  expect(sent).toEqual([{ p_order: ID, p_reason: "other", p_note: "Wallet at home" }]);
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
});

test("MN2 a plain reason sends no words; Go back, Close and Back send nothing; a refusal shows a true line and the order stays", async ({ page, context }) => {
  const { sent, sheet } = await open(context, page, { ok: false, error: "not_ready", message: "x" });
  await page.getByRole("button", { name: "Money not collected?" }).click();
  await sheet.getByRole("button", { name: "Go back" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("button", { name: "Money not collected?" }).click();
  await sheet.locator("button.ui-sheet-close").click();
  await expect(sheet).toHaveCount(0);
  expect(sent).toHaveLength(0);
  await page.getByRole("button", { name: "Money not collected?" }).click();
  await sheet.locator(".ui-pay-row", { hasText: "Will pay later" }).click();
  await sheet.getByRole("button", { name: "Not collected", exact: true }).click();
  expect(sent).toEqual([{ p_order: ID, p_reason: "will_pay_later", p_note: null }]);
  await expect(sheet.getByRole("alert")).toContainText("not out for delivery any more");
  await expect(sheet).toBeVisible();
});

test("MN3 customer code switch on: Not collected opens the existing Customer's code sheet; a wrong code shows its line; the right code delivers with the reason", async ({ page, context }) => {
  const net = await setup(context, page, [onTheWay()]);
  net.state.kitchens = [KITCHEN];
  net.state.dropOn = true;
  const sent: { p_order: string; p_reason: string; p_note: string | null; p_code: string }[] = [];
  await context.route("**/rest/v1/rpc/rider_money_not_collected_v1*", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    sent.push(body);
    const reply = body.p_code === "1234" ? { ok: true, order: { id: ID, status: "delivered" } } : { ok: false, error: "wrong_code", message: "x", tries_left: 4 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) }).catch(() => {});
  });
  await page.goto("/rider/");
  await page.getByRole("button", { name: `Arriving ${ID.slice(0, 8)}` }).click();
  await page.getByRole("button", { name: "Collect", exact: true }).click();
  await page.getByRole("button", { name: "Money not collected?" }).click();
  const money = page.getByRole("dialog", { name: "Money not collected" });
  await money.locator(".ui-pay-row", { hasText: "Will pay later" }).click();
  await money.getByRole("button", { name: "Not collected", exact: true }).click();
  const code = page.getByRole("dialog", { name: "Customer's code" });
  await expect(code).toBeVisible();
  expect(sent).toHaveLength(0);   // no call before the code is typed
  const boxes = code.locator(".ui-code-boxes input");
  for (let i = 0; i < 4; i++) await boxes.nth(i).fill("9876"[i]);
  await expect(code.locator(".ui-code-line")).toContainText("That code does not match this order");
  for (let i = 0; i < 4; i++) await boxes.nth(i).fill("1234"[i]);
  await expect(code).toHaveCount(0);
  expect(sent.map((s) => [s.p_reason, s.p_note, s.p_code])).toEqual([["will_pay_later", null, "9876"], ["will_pay_later", null, "1234"]]);
  await expect(page.getByText("Delivered", { exact: true })).toBeVisible();
});
