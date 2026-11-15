// Story 1548, rule 11: the Bill says how far the delivery place is from the phone, in the Deliver to row: "<n> km from your current location".
// It shows past the far distance (2 km), from the phone's last known place: opening the Bill does not read the phone again. The line takes the place of the small
// "Deliver to" label (the reviewer's call): no empty line is kept, so the Bill of a customer who is not far is as it was. Nothing on the Bill moves when the line
// comes or goes (owner's rule 23): the two states are laid over each other by measure. The You page's row does the same. Run by Chromium (bill-far.spec.ts) and by WebKit (bill-far.webkit.spec.ts).
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { asked, comeBack, phoneLoc, setLoc, setup, whereBox, type Loc } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "Z-900, Sample Garden Colony, Sampletown", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: "2026-11-05T10:00:00Z" };
const AT_HOME = { latitude: HOME.lat, longitude: HOME.lng };
const AWAY = { latitude: 28.6139, longitude: 77.209 };   // about 6 km from Home
const ONE_KM = { latitude: 28.5767, longitude: 77.2432 };   // about 1 km from Home
const LINE = /^\d+ km from your current location$/;
const row = (page: Page) => page.getByRole("group", { name: "Deliver to" });
const line = (page: Page) => row(page).getByText(/km from your current location/);
const label = (page: Page) => row(page).getByText("Deliver to", { exact: true });   // the small label; the row's own name (aria-label) stays "Deliver to" either way
const small = (page: Page) => row(page).locator("small");   // the one small line of the row: the label, or the km line in its place
const spot = async (page: Page) => { const b = (await small(page).boundingBox())!; return `at ${Math.round(b.x)},${Math.round(b.y)}, ${Math.round(b.height)} high`; };
const homePlace = { address: HOME.address, pin: HOME.pin_code, lat: HOME.lat, lng: HOME.lng, house: "", landmark: "", confirmed: true, id: HOME.id as string | null };

// This phone holds a place and a dish on the bill. step "bill": the app opens on the Bill, as after a reload there.
async function open(context: BrowserContext, page: Page, loc: Loc, { step = "bill", place = homePlace, rows = [HOME] as object[] } = {}) {
  const net = await setup(context, page, [], { pin: null });
  net.state.addresses = rows;
  await context.addInitScript(([p, s]) => {
    if (window.localStorage.getItem("gs-place")) return;
    window.localStorage.setItem("gs-place", JSON.stringify(p)); window.localStorage.setItem("gs-pin", (p as { pin: string }).pin);
    window.localStorage.setItem("gs-draft", JSON.stringify({ step: s, cart: { d1: 1 }, address: (p as { address: string }).address, name: "", phone: "9876543210" }));
  }, [place, step] as const);
  await phoneLoc(page, loc);
  await page.goto("/customer/");
  return net;
}
// Every part of the Bill, by measure in the browser. The far line itself is left out: it is the one thing that may differ.
const parts = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const put = (name: string, el: Element | null) => { if (!el) return void out.push(`${name} is not on the screen`); const r = el.getBoundingClientRect(); out.push(`${name} ${Math.round(r.width * 10) / 10}x${Math.round(r.height * 10) / 10} at ${Math.round(r.x * 10) / 10},${Math.round(r.y * 10) / 10}`); };
  put("header", document.querySelector(".ui-head"));
  put("slip", document.querySelector(".ui-slip"));
  put("total", document.querySelector(".ui-slip-total"));
  const form = document.querySelector(".ui-form")!;
  put("form", form);
  [...form.children].forEach((el, i) => put(`form part ${i} (${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]})`, el));
  const group = document.querySelector("[role=group][aria-label='Deliver to']")!;
  const at = (name: string, el: Element | null) => { if (!el) return void out.push(`${name} is not on the screen`); const r = el.getBoundingClientRect(); out.push(`${name} ${Math.round(r.height * 10) / 10} high at ${Math.round(r.x * 10) / 10},${Math.round(r.y * 10) / 10}`); };
  at("deliver to small line", group.querySelector("small"));   // the label, or the km line in its place: the same spot and height (its words differ, so its width may)
  at("deliver to words", group.querySelector("span > span"));
  out.push(`deliver to row holds ${group.querySelectorAll("small").length} small line and ${group.querySelectorAll("*").length} parts`);   // no empty line kept
  put("change", group.querySelector("button"));
  put("note", document.querySelector("textarea"));
  put("bar", document.querySelector(".ui-sticky"));
  put("place order", document.querySelector(".ui-sticky .ui-btn"));
  out.push(`page scroll ${document.querySelector(".ui-scroll")!.scrollHeight}`);
  return out;
});

export function billFar() {
  test("The Bill knows I am far: my delivery place is far from my phone, I open the Bill, and the delivery row says how many km it is from my current location", async ({ page, context }) => {
    const net = await open(context, page, { perm: "granted", pos: AWAY }, { step: "menu" });
    await whereBox(page).getByRole("button", { name: "Use another address" }).click();   // far from Home: Home is my answer
    await page.getByRole("button", { name: "Deliver to Home" }).click();
    const asks = await asked(page);
    await page.getByRole("button", { name: /View bill/ }).click();
    await expect(row(page)).toContainText(HOME.address);
    await expect(line(page)).toHaveText("6 km from your current location");
    await expect(line(page)).toHaveText(LINE);
    await expect(label(page)).toHaveCount(0);   // the km line is in the place of the small label
    await expect(small(page)).toHaveCount(1);
    await expect(page.getByText(/current address/i)).toHaveCount(0);   // "current location" is the phone's place; these words are used nowhere
    expect(await asked(page)).toBe(asks);   // the Bill did not read the phone again
    expect(net.calls.geocode).toHaveLength(0);
    await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();   // the line is a fact, not a stop
  });

  for (const width of [360, 412]) {
    test(`Nothing else on the Bill moved: the same Bill with and without the line, laid over each other (${width} px)`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(context, page, { perm: "granted", pos: AT_HOME });
      await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Place order/ })).toBeEnabled();
      await expect.poll(() => asked(page)).toBe(1);   // the phone was found, at Home
      await page.waitForTimeout(300);
      await expect(line(page)).toHaveCount(0);
      await expect(label(page)).toBeVisible();
      const near = await parts(page), labelAt = await spot(page);
      await setLoc(page, { perm: "granted", pos: AWAY });   // the customer comes back to the app 6 km away, with the Bill open
      await comeBack(page);
      await expect(line(page)).toHaveText("6 km from your current location");
      const far = await parts(page);
      expect(far).toEqual(near);   // rule 23: every part is where it was, at the same size
      await expect(label(page)).toHaveCount(0);
      expect(await spot(page)).toBe(labelAt);   // the km line sits exactly where the label was
      await expect(page.getByRole("group", { name: "Deliver to" })).toHaveCount(1);   // the row keeps its name for a screen reader
      expect(far.join(" | ")).not.toContain("is not on the screen");
      const [l, r] = [(await line(page).boundingBox())!, (await row(page).boundingBox())!];
      expect(l.y >= r.y && l.y + l.height <= r.y + r.height + 0.5 && l.x >= r.x && l.x + l.width <= r.x + r.width + 0.5, "the line sits inside the Deliver to row").toBe(true);
      expect(await line(page).evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height < 24), "the line is one whole line").toBe(true);
      await setLoc(page, { perm: "granted", pos: AT_HOME });   // and home again: the line goes, nothing moves
      await comeBack(page);
      await expect(line(page)).toHaveCount(0);
      await expect(label(page)).toBeVisible();
      expect(await parts(page)).toEqual(near);
    });
  }

  test("Within the far distance (about 1 km from my place): the Bill has no line", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: ONE_KM });
    await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
    await expect.poll(() => asked(page)).toBe(1);
    await page.waitForTimeout(300);
    await expect(line(page)).toHaveCount(0);
  });

  test("The phone's place cannot be read: the Bill has no line, and it does not ask the phone", async ({ page, context }) => {
    await open(context, page, { perm: "prompt", pos: "never" });
    await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(line(page)).toHaveCount(0);
    await expect(label(page)).toBeVisible();
    expect(await row(page).evaluate((el) => `${el.querySelectorAll("small").length} small, ${el.querySelectorAll("*").length} parts`)).toBe("1 small, 4 parts");   // the row as before this story: no empty line kept
    expect(await asked(page)).toBe(0);
  });

  test("A place that is not a saved address, far from my phone: the Bill says how far it is too", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AWAY }, { place: { ...homePlace, address: "12B, Sample Garden Colony", id: null }, rows: [] });
    await expect(row(page)).toContainText("12B, Sample Garden Colony");
    await expect(line(page)).toHaveText("6 km from your current location");
  });

  test("The You page: far from my place, its Deliver to row says the km in the place of the label too, and nothing on the page moves", async ({ page, context }) => {
    await open(context, page, { perm: "granted", pos: AT_HOME });
    await expect(page.getByRole("heading", { name: "Your bill" })).toBeVisible();
    await page.getByRole("button", { name: "Back to menu" }).click();
    await page.getByRole("button", { name: /^You: / }).click();
    await expect(row(page)).toContainText(HOME.address);
    await expect(label(page)).toBeVisible();
    const rects = () => page.evaluate(() => [...document.querySelectorAll(".ui-you-card, .ui-you-card .ui-phone-row, .ui-you-card .ui-phone-row button, .ui-you-card .ui-phone-row span > span")].map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}`; }));
    const near = await rects(), labelAt = await spot(page);
    await setLoc(page, { perm: "granted", pos: AWAY });
    await comeBack(page);
    await expect(line(page)).toHaveText("6 km from your current location");
    await expect(label(page)).toHaveCount(0);
    expect(await rects()).toEqual(near);
    expect(await spot(page)).toBe(labelAt);
    expect(near.length).toBeGreaterThan(3);
  });
}
