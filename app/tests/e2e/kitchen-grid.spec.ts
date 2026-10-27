// Story #618 (row T4 of the #325 sitting), boards K2-Tickets and K2-Cooking: one ticket grid on New, Cooking and Ready: `1fr 112px`, gap 12, align start.
// Left: the number line (one line, never wraps) with the tag right after it, then the dish lines at 20 px in sentence case, wrapping allowed. Right: the one action 112 px wide, or the rider on Ready.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });
const LONG = [{ menu_item_id: "d1", name: "Amritsari Kulcha with Chole and extra pickled onions", qty: 1, price_paise: 100 }, { menu_item_id: "d2", name: "Veg thali", qty: 2, price_paise: 100 }];
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const withLong = (status: string, id: string) => ({ ...order(status), id, items: LONG });

// What one ticket looks like to the eye: its grid, the number line, the tag, the lines and the right column.
const look = (page: Page, shortId: string) => page.locator(".ui-ticket").filter({ hasText: `No. ${shortId}` }).evaluate((t) => {
  const box = (e: Element | null) => e?.getBoundingClientRect();
  const head = t.querySelector(".ui-ticket-head")!, num = head.firstElementChild!, tag = head.querySelector(".ui-tag")!;
  const lines = t.querySelector(".ui-slip-lines")!, right = t.lastElementChild!;
  const gs = getComputedStyle(t), ls = getComputedStyle(lines), ns = getComputedStyle(num);
  const rb = box(right)!, nb = box(num)!, tb = box(tag)!, hb = box(head)!;
  return {
    display: gs.display, columns: gs.gridTemplateColumns.split(" ").pop(), gap: gs.columnGap, align: gs.alignItems,
    numberLines: Math.round(nb.height / (parseFloat(ns.lineHeight) || parseFloat(ns.fontSize) * 1.45)), tagAfterNumber: tb.left >= nb.right && Math.abs(tb.top - nb.top) < 12,
    headWithinLeft: hb.right <= t.getBoundingClientRect().right - 112 - 11,
    lineSize: ls.fontSize, lineCase: ls.textTransform, lineHeight: ls.lineHeight,
    rightWidth: Math.round(rb.width), rightEdge: Math.round(rb.right),
  };
});

test("S1 New, Cooking and Ready share one grid; the action or rider column is 112 px at the same right edge", async ({ page, context }) => {
  const net = await setup(context, page, [withLong("placed", "0a0a0a0a-0000-0000-0000-000000000000"), withLong("accepted", "0b0b0b0b-0000-0000-0000-000000000000"), withLong("ready", "0c0c0c0c-0000-0000-0000-000000000000")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  const fresh = await look(page, "0a0a0a0a");
  await tab(page, "Cooking").click();
  const cooking = await look(page, "0b0b0b0b");
  const ready = await look(page, "0c0c0c0c");
  for (const t of [fresh, cooking, ready]) {
    expect(t).toMatchObject({ display: "grid", columns: "112px", gap: "12px", align: "start", numberLines: 1, tagAfterNumber: true, headWithinLeft: true, lineSize: "20px", lineCase: "none", rightWidth: 112 });
  }
  expect(new Set([fresh.rightEdge, cooking.rightEdge, ready.rightEdge]).size).toBe(1);
});

test("S2 a long dish name wraps in the lines, never in the number line, and the order of the parts is number, tag, lines, action", async ({ page, context }) => {
  const net = await setup(context, page, [withLong("placed", "0a0a0a0a-0000-0000-0000-000000000000")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  const t = page.locator(".ui-ticket").first();
  const order_ = await t.evaluate((el) => {
    const num = el.querySelector(".ui-ticket-head .mono")!, tag = el.querySelector(".ui-ticket-head .ui-tag")!, lines = el.querySelector(".ui-slip-lines")!, act = el.querySelector(".ui-btn")!;
    const pos = (n: Element) => (n.compareDocumentPosition(act) & Node.DOCUMENT_POSITION_FOLLOWING ? 0 : 1);
    const all = [num, tag, lines, act];
    return all.every((n, i) => i === 0 || !!(all[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) && pos(num) === 0;
  });
  expect(order_).toBe(true);
  const lineBox = await t.locator(".ui-slip-lines div").first().boundingBox();
  expect(lineBox!.height).toBeGreaterThan(26 * 1.3);   // the long name took more than one 20 px line
});
