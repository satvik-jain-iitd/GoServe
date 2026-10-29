// Story M.2 (#321, plan v2 H.2): opening hours are obeyed. The shared test kitchen is open 10:00 to 22:00 India time. The network is answered by the test.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

// The kitchen of these specs opens 10:00 and closes 22:00 India time. Each spec sets its own clock.
const HOURS = { opens_at: "10:00:00", closes_at: "22:00:00" };

const add = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Add Butter Chicken" });

test("S1 after closing time the menu says closed, with the opening time, and Add is off", async ({ page, context }) => {
  const net = await setup(context, page);
  Object.assign(net.state.kitchens[0], HOURS);
  await page.clock.setFixedTime(new Date("2026-10-24T18:00:00Z"));   // 23:30 India
  await page.goto("/customer/");
  await expect(page.getByText("Kitchen closed. Opens at 10:00 am.")).toBeVisible();
  await expect(add(page)).toBeDisabled();
});

test("S2 inside the hours the menu shows when the kitchen closes and Add works", async ({ page, context }) => {
  const net = await setup(context, page);
  Object.assign(net.state.kitchens[0], HOURS);
  await page.clock.setFixedTime(new Date("2026-10-24T06:30:00Z"));   // 12:00 India
  await page.goto("/customer/");
  await expect(page.getByText("Open till 10:00 pm")).toBeVisible();
  await expect(add(page)).toBeEnabled();
});

test("S3 the menu closes by itself at closing time, with no reload", async ({ page, context }) => {
  const net = await setup(context, page);
  Object.assign(net.state.kitchens[0], HOURS);
  await page.clock.install({ time: new Date("2026-10-24T16:29:40Z") });   // 21:59:40 India
  await page.goto("/customer/");
  await expect(page.getByText("Open till 10:00 pm")).toBeVisible();
  await expect(add(page)).toBeEnabled();   // the menu has loaded: a jump of the fake clock while its request is in flight times the request out (flake found 27 Oct)
  await page.clock.runFor(60_000);
  await expect(page.getByText("Kitchen closed. Opens at 10:00 am.")).toBeVisible();
  await expect(add(page)).toBeDisabled();
});

test("S4 #452 a kitchen switched off in the middle of its day says a little while, not tomorrow morning", async ({ page, context }) => {
  const net = await setup(context, page);
  Object.assign(net.state.kitchens[0], { ...HOURS, open: false });
  await page.clock.setFixedTime(new Date("2026-10-24T07:30:00Z"));   // 13:00 India, inside 10:00 to 22:00
  await page.goto("/customer/");
  await expect(page.getByText("Your bill is kept. Please look again soon.")).toBeVisible();
  await expect(page.getByText(/Opens at/)).toHaveCount(0);
  await expect(add(page)).toBeDisabled();
});
