// Story #1170 (QA screen 21, owner's 9 Nov pick, boards L4c and L4d): one disabled style for every .ui-btn (flat #DCDFD6, text #4F5A50 at 4.5:1 or more, no opacity), and a reason line,
// centred and 12 px above, for a disabled main button. The Bill has no reason line: its bar says what to do (story 1574). The address is not a box any more.
import { test, expect, type Page } from "@playwright/test";
import { placeAt, setup } from "./helpers";

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
  const place = page.getByRole("button", { name: /Add your phone number/ });
  await place.evaluate((el) => { (el as HTMLButtonElement).disabled = true; });   // story 1574: the Bill's bar is off only while it sends or a dish is sold out; the style is the same one
  await expect(place).toBeDisabled();
  const c = await place.evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, color: s.color, opacity: s.opacity, cursor: s.cursor, shadow: s.boxShadow, border: s.borderTopWidth }; });
  expect(rgb(c.bg)).toEqual([220, 223, 214]);
  expect(ratio(rgb(c.color), rgb(c.bg))).toBeGreaterThanOrEqual(4.5);
  expect(c.opacity).toBe("1");
  expect(c.cursor).toBe("not-allowed");
  expect(c.shadow).toBe("none");
  expect(c.border).toBe("0px");
});

test("S2 with a place that is not confirmed the bar asks for the phone, then says Confirm on the map; no grey line (story 1574)", async ({ page, context }) => {
  await context.addInitScript((p) => { window.localStorage.setItem("gs-pin", p.pin); window.localStorage.setItem("gs-place", JSON.stringify(p)); }, { ...placeAt("110016"), confirmed: false });   // a raw phone fix
  await toBill(page, context);
  await expect(page.getByRole("button", { name: /Add your phone number/ })).toBeEnabled();
  await page.getByLabel("Phone").fill("9876543210");
  await expect(page.getByRole("button", { name: "Confirm on the map" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Place order/ })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("S3 the bill has no address box (story 1532)", async ({ page, context }) => {
  await toBill(page, context);
  await expect(page.getByRole("textbox", { name: "Address" })).toHaveCount(0);
});

test("S4 with the phone missing the bar asks for it, and no grey line (story 1417: never the name; story 1574)", async ({ page, context }) => {
  await toBill(page, context);
  await expect(page.getByRole("button", { name: /Add your phone number/ })).toBeEnabled();
  await expect(page.getByText("Add your 10 digit phone number.")).toHaveCount(0);
});
