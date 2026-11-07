// Story #955: one danger sheet pattern for Remove kitchen and Clear everything (boards D1-RemoveKitchen and D2-ClearEverything, canvas row 2n).
// Both sheets are the same shape: the same class names, one 20 px margin for everything, a 44 px round close, a facts table, a word gate, red first, ghost to leave.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const KITCHEN = { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" };
const HELPER = "The red button wakes up when the word matches. Until then a touch does nothing.";

const removeSheet = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page); net.state.admin = true; net.state.kitchens = [KITCHEN];
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  await page.getByRole("region", { name: "Leaving GoServe" }).getByRole("button", { name: /Remove this kitchen/ }).click();
  return page.getByRole("dialog", { name: "Remove Tau Ka Dhaba?" });
};
const clearSheet = async (page: Page, context: Parameters<typeof setup>[0]) => {
  const net = await setup(context, page); net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Simulator", exact: true }).click();
  await page.getByRole("button", { name: "Clear everything" }).click();
  return page.getByRole("dialog", { name: "Clear everything?" });
};

for (const [name, open] of [["Remove kitchen", removeSheet], ["Clear everything", clearSheet]] as const) {
  test(`S1 ${name}: the sheet has the danger shape, with one 20 px margin`, async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    const sheet = await open(page, context);
    await expect(sheet).toHaveClass(/\bui-danger\b/);
    const m = await sheet.evaluate((el) => {
      const left = (e: Element | null) => (e ? Math.round(e.getBoundingClientRect().left * 10) / 10 : -1);
      const box = el.getBoundingClientRect();
      const close = el.querySelector(".ui-danger-head button") as HTMLElement | null;
      const cs = close ? getComputedStyle(close) : null;
      const input = el.querySelector("input") as HTMLElement;
      const buttons = Array.from(el.querySelectorAll(".ui-danger-acts button"));
      return {
        title: left(el.querySelector(".ui-danger-head h2")), sentence: left(el.querySelector(".ui-danger-sentence")), facts: left(el.querySelector(".ui-danger-facts")),
        input: left(input), red: left(buttons[0]), padding: parseFloat(getComputedStyle(el).paddingLeft), sheetLeft: left(el), width: box.width,
        close: close ? { w: Math.round(close.getBoundingClientRect().width), h: Math.round(close.getBoundingClientRect().height), radius: parseFloat(cs!.borderTopLeftRadius) >= 22, label: close.getAttribute("aria-label") } : null,
        labelWidth: Math.round(el.querySelector(".ui-danger-fact > :first-child")?.getBoundingClientRect().width ?? -1),
        dtAlign: el.querySelector(".ui-danger-fact > :last-child") ? getComputedStyle(el.querySelector(".ui-danger-fact > :last-child")!).textAlign : null,
        inputH: Math.round(input.getBoundingClientRect().height), inputFont: getComputedStyle(input).fontFamily.includes("mono") || input.classList.contains("mono-input"),
        order: buttons.map((b) => b.className.includes("danger-fill") ? "red" : b.className.includes("ghost") ? "ghost" : "other"),
      };
    });
    expect(m.padding).toBe(20);
    expect([m.title, m.sentence, m.facts, m.input, m.red].every((x) => x === m.sheetLeft + 20), `left edges ${JSON.stringify(m)}`).toBe(true);
    expect(m.close).toEqual({ w: 44, h: 44, radius: true, label: "Close" });
    expect(m.labelWidth).toBe(88);
    expect(["left", "start"]).toContain(m.dtAlign);
    expect(m.inputH).toBe(48);
    expect(m.order).toEqual(["red", "ghost"]);   // red first, ghost to leave
    await expect(sheet.locator(".ui-danger-kicker")).toBeVisible();
    expect(await sheet.locator("input").getAttribute("placeholder")).toBe(name === "Clear everything" ? "CLEAR" : "REMOVE");   // the word is the placeholder
    await expect(sheet.locator(".ui-danger-sentence")).toBeVisible();
    await expect(sheet.locator(".ui-danger-after")).toBeVisible();
    await expect(sheet.getByText(HELPER)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Close", exact: true })).toHaveCount(1);   // the 44 px round one; no Close pill
  });

  test(`S2 ${name}: the red button is asleep at 40 percent, and the round close leaves the sheet`, async ({ page, context }) => {
    const sheet = await open(page, context);
    const red = sheet.locator(".ui-danger-acts button").first();
    await expect(red).toBeDisabled();
    expect(await red.evaluate((e) => ({ o: getComputedStyle(e).opacity, pe: getComputedStyle(e).pointerEvents }))).toEqual({ o: "0.4", pe: "none" });
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("S3 both sheets use the same class names", async ({ page, context }) => {
  const names = async (sheet: ReturnType<Page["getByRole"]>) => Array.from(new Set(await sheet.evaluate((el) => Array.from(el.querySelectorAll("[class]")).map((e) => e.className).filter((c) => typeof c === "string" && c.includes("ui-danger"))))).sort().join("|");
  const a = await names(await removeSheet(page, context));
  const page2 = await context.newPage();
  const b = await names(await clearSheet(page2, context));
  expect(a).toBe(b);
  expect(a).toContain("ui-danger-facts");
});
