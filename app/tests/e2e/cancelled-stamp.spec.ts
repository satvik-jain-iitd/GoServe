// Story #916: the cancelled slip shows the word in red with a red outline and no fill. The global .error fill must not reach the stamp.
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

for (const theme of ["day", "night"]) {
  test(`S1 the cancelled stamp has no fill and the word reads in ${theme}`, async ({ page, context }) => {
    const net = await setup(context, page, [order("placed")]);
    await page.goto("/customer/");
    await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
    net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
    await expect(page.getByText("Your order was cancelled")).toBeVisible({ timeout: 5000 });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    const stamp = page.locator(".ui-stamp", { hasText: "Cancelled" });
    await expect(stamp).toBeVisible();
    const s = await stamp.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor, width: c.borderTopWidth }; });
    expect(s.bg, "no fill").toBe("rgba(0, 0, 0, 0)");
    expect(s.color, "the word is red, not the fill").not.toBe("rgba(0, 0, 0, 0)");
    expect(s.border).toBe(s.color);
    expect(s.width).toBe("3px");
  });
}

test("S2 the other error users keep their fill (note, tag, danger button)", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  net.push("UPDATE", order("cancelled", "2020-01-01T10:01:00Z"));
  await expect(page.getByText("Your order was cancelled")).toBeVisible({ timeout: 5000 });
  const fills = await page.evaluate(() => [".ui-note.error", ".ui-tag.error", ".ui-btn.danger"].map((q) => document.querySelector(q) ? getComputedStyle(document.querySelector(q)!).backgroundColor : "absent"));
  expect(fills.every((f) => f !== "rgba(0, 0, 0, 0)")).toBe(true);
});
