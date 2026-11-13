// Story #1170 (QA screen 21, owner's 9 Nov pick, boards L4c and L4d): one disabled style for every .ui-btn (flat #DCDFD6, text #4F5A50 at 4.5:1 or more, no opacity), and a reason line,
// centred and 12 px above, for a disabled main button. On the bill: "Add your address to place the order." The bill address box carries the e.g. example.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

async function toBill(page: Page, context: Parameters<typeof setup>[0]) {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
}

test("S1 a disabled main button is flat grey with readable text and no opacity", async ({ page, context }) => {
  await toBill(page, context);
  const place = page.getByRole("button", { name: /Place order/ });
  await expect(place).toBeDisabled();
  const c = await place.evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, color: s.color, opacity: s.opacity, cursor: s.cursor, shadow: s.boxShadow, border: s.borderTopWidth }; });
  expect(rgb(c.bg)).toEqual([220, 223, 214]);
  expect(ratio(rgb(c.color), rgb(c.bg))).toBeGreaterThanOrEqual(4.5);
  expect(c.opacity).toBe("1");
  expect(c.cursor).toBe("not-allowed");
  expect(c.shadow).toBe("none");
  expect(c.border).toBe("0px");
});

test("S2 with the bill address empty the reason shows, centred, 12 px above the button, and goes when the address is typed", async ({ page, context }) => {
  await toBill(page, context);
  const reason = page.getByRole("status").filter({ hasText: "Add your address to place the order." });
  await expect(reason).toBeVisible();
  const [r, b, vp] = [(await reason.boundingBox())!, (await page.getByRole("button", { name: /Place order/ }).boundingBox())!, page.viewportSize()!];
  expect(Math.abs(b.y - (r.y + r.height) - 12)).toBeLessThanOrEqual(2);
  expect(Math.abs(r.x + r.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await expect(reason).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
});

test("S3 the bill address box has the e.g. example", async ({ page, context }) => {
  await toBill(page, context);
  await expect(page.getByLabel("Address")).toHaveAttribute("placeholder", "e.g. C-128, Green Avenue Colony");
});

test("S4 with the phone missing the reason asks for it (story 1417: never the name)", async ({ page, context }) => {
  await toBill(page, context);
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await expect(page.getByRole("status").filter({ hasText: "Add your 10 digit phone number." })).toBeVisible();
});
