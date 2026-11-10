// Story #1276 (board K5-NoteBand): the customer's note is a filled band, "Customer says" and the whole note in 20 px bold, never cut. It shows on the New rows, the Cooking rows, the order sheet and the ticket.
import { test, expect, type Page } from "@playwright/test";
import { order, setup } from "./helpers";

const NOTE = "Less spicy please. No peanuts, allergy.";
const LONG = Array.from({ length: 33 }, (_, i) => `word${i + 1}`).join(" ").slice(0, 200);   // 200 letters, many words
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const band = (where: Page | ReturnType<Page["locator"]>) => where.locator(".ui-noteband");
const open = async (page: Page, context: Parameters<typeof setup>[0], orders: object[], theme = "day") => {
  await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
  const net = await setup(context, page, orders);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();
  return net;
};
const whole = async (b: ReturnType<typeof band>, note: string) => {
  await expect(b).toBeVisible();
  await expect(b).toContainText("Customer says");
  await expect(b.locator(".ui-noteband-text")).toHaveText(note);   // the whole note, every word
  const m = await b.locator(".ui-noteband-text").evaluate((el) => { const s = getComputedStyle(el); return { size: s.fontSize, weight: Number(s.fontWeight), over: s.textOverflow, wrap: s.whiteSpace, clip: el.scrollWidth > el.clientWidth + 1 }; });
  expect(m.size).toBe("20px"); expect(m.weight).toBeGreaterThanOrEqual(700);
  expect(m.over).not.toBe("ellipsis"); expect(m.wrap).not.toBe("nowrap"); expect(m.clip).toBe(false);   // it wraps and is never cut with dots
};

test("S1 a note on a New row, the order sheet, then the Cooking row and the ticket: the same band, the whole note", async ({ page, context }) => {
  await open(page, context, [{ ...order("placed"), customer_name: "Rahul Sharma", instructions: NOTE }]);
  await whole(band(page.locator(".ui-ticket")), NOTE);   // New row
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  const sheet = page.getByRole("dialog", { name: "Order 0f0f0f0f" });
  await whole(band(sheet), NOTE);   // the order sheet
  await sheet.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await tab(page, "Cooking").click();
  await whole(band(page.locator(".ui-ticket")), NOTE);   // Cooking row
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Ticket" })).toBeVisible();
  await whole(band(page.locator(".ui-slip")), NOTE);   // the ticket
});

test("S2 a note of 200 letters wraps inside the screen and every word is on screen", async ({ page, context }) => {
  expect(LONG.length).toBe(200);
  await open(page, context, [{ ...order("placed"), instructions: LONG }]);
  await whole(band(page.locator(".ui-ticket")), LONG);
  const box = (await band(page.locator(".ui-ticket")).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("S3 an order with no note has no band and no Customer says label", async ({ page, context }) => {
  await open(page, context, [order("placed")]);
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  await expect(band(page)).toHaveCount(0);
  await expect(page.getByText("Customer says")).toHaveCount(0);
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("dialog", { name: "Order 0f0f0f0f" })).toBeVisible();
  await expect(band(page)).toHaveCount(0);
});

for (const theme of ["day", "night"]) {
  test(`S4 ${theme}: the band text passes 4.5:1 on its fill`, async ({ page, context }) => {
    await open(page, context, [{ ...order("placed"), instructions: NOTE }], theme);
    await expect(band(page)).toBeVisible();
    const ratio = await band(page).evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const t = getComputedStyle(el.querySelector(".ui-noteband-text")!), f = getComputedStyle(el);
      const a = lum(rgb(t.color)), b = lum(rgb(f.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    const want = await page.evaluate(() => { const d = document.createElement("i"); d.style.background = "var(--md-error)"; d.style.color = "var(--md-on-error)"; document.body.append(d); const s = getComputedStyle(d); const r = { bg: s.backgroundColor, fg: s.color }; d.remove(); return r; });
    const got = await band(page).evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, fg: getComputedStyle(el.querySelector(".ui-noteband-text")!).color, pad: s.padding, radius: s.borderTopLeftRadius }; });
    expect(got.bg).toBe(want.bg); expect(got.fg).toBe(want.fg);   // board K5: the error fill with its own text colour, in both themes
    expect(got.pad).toBe("8px 10px"); expect(got.radius).toBe("4px");
  });
}
