// Story 1709: a rider with an order in hand and no location gets a blocking sheet that needs an answer; with no order the red line stays.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const inHand = (id = ID) => ({ ...order("out_for_delivery", NOW, NOW), id, rider_id: SESSION, customer_name: "Rahul Verma", customer_phone: "9876543210" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Location band hai" });
const line = (page: Page) => page.getByRole("status").filter({ hasText: "Location band hai" });

async function open(context: BrowserContext, page: Page, orders: object[], permission: "prompt" | "denied" = "denied") {
  await context.addInitScript((state) => {   // the phone's own answer to "what is the location setting"
    const real = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d: PermissionDescriptor) => (d.name === "geolocation" ? Promise.resolve({ state, onchange: null } as unknown as PermissionStatus) : real(d));
  }, permission);
  const net = await setup(context, page, orders);
  net.state.rider = { user_id: SESSION, name: "Amit Kumar", phone: null, online: true, lat: null, lng: null };
  await context.clearPermissions();
  await page.goto("/rider/");
  return net;
}

for (const [w, h] of [[360, 640], [390, 844]]) {
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`S1 given an order in hand and location blocked, the sheet is open, the red line is gone, and a tap outside or Escape do nothing (${w})`, async ({ page, context }) => {
      await open(context, page, [inHand()]);
      await expect(sheet(page)).toBeVisible();
      await expect(line(page)).toHaveCount(0);
      await expect(page.getByText("Customer ko aap tabhi dikhenge jab location chalu ho.")).toBeVisible();
      await expect(page.getByText("Phone ki Settings kholein")).toBeVisible();
      await expect(page.getByText("Apps › GoServe › Location › Allow")).toBeVisible();
      await expect(page.getByText("Bina location ke chalne par admin ko khabar jati hai")).toBeVisible();
      await page.mouse.click(w / 2, 20);
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toBeVisible();
      await expect(page.getByRole("button", { name: /close|band/i })).toHaveCount(0);
    });

    test(`S2 the buttons are stacked, full width, 56 tall, one line, the main one last, and the sheet sits on the bottom edge (${w})`, async ({ page, context }) => {
      await open(context, page, [inHand()]);
      await expect(sheet(page)).toBeVisible();
      await page.waitForTimeout(400);   // the sheet's rise
      const skip = page.getByRole("button", { name: "Is baar bina location ke" });
      const main = page.getByRole("button", { name: "Location chalu kar di" });
      const [s, m, d] = [await skip.boundingBox(), await main.boundingBox(), await sheet(page).boundingBox()];
      console.log(`PX ${w}x${h} sheet`, JSON.stringify(d), "skip", JSON.stringify(s), "main", JSON.stringify(m));
      expect(s!.width).toBeCloseTo(m!.width, 0);
      expect(m!.width).toBeGreaterThan(w - 2 * 24 - 2);
      expect(m!.height).toBeGreaterThanOrEqual(56); expect(s!.height).toBeGreaterThanOrEqual(56);
      expect(m!.height).toBeLessThan(57); expect(s!.height).toBeLessThan(57);   // one line each: a second line would grow it
      expect(m!.y).toBeGreaterThan(s!.y + s!.height - 1);
      expect(Math.abs(d!.y + d!.height - h)).toBeLessThan(1);
    });

    test(`S3 focus is on the dialog and stays in it (${w})`, async ({ page, context }) => {
      await open(context, page, [inHand()]);
      await expect(sheet(page)).toBeFocused();
      for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true); }
    });
  });
}

test("S4 given location is turned on, Location chalu kar di closes the sheet", async ({ page, context }) => {
  await open(context, page, [inHand()]);
  await expect(sheet(page)).toBeVisible();
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 28.56, longitude: 77.2 });
  await page.getByRole("button", { name: "Location chalu kar di" }).click();
  await expect(sheet(page)).toHaveCount(0);
});

test("S5 given the phone has never asked, the steps are not shown and the main button says Location chalu karein", async ({ page, context }) => {
  await open(context, page, [inHand()], "prompt");
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByText("Phone ki Settings kholein")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Location chalu karein" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Location chalu kar di" })).toHaveCount(0);
});

test("S6 Is baar bina location ke closes the sheet for this order, survives a reload, and the next order opens it again", async ({ page, context }) => {
  const net = await open(context, page, [inHand()]);
  await page.getByRole("button", { name: "Is baar bina location ke" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Arriving 0f0f0f0f" })).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
  net.state.orders = [inHand("1a1a1a1a-1111-4222-8333-444444444444")];
  await page.reload();
  await expect(sheet(page)).toBeVisible();
});

test("S7 given no order in hand, there is no dialog; the red line stays", async ({ page, context }) => {
  await open(context, page, []);
  await expect(line(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
