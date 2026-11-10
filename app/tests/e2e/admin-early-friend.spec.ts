// Story #1329 (board A14-EarlyFriend, same shape as A10): the admin turns the early-friend offer on or off and sets its amount. Off by default. A promise already given is dropped.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan } from "./helpers";

const toSettings = async (page: Page, context: Parameters<typeof setup>[0], over: Record<string, unknown> = {}) => {
  const net = await setup(context, page);
  net.state.admin = true;
  Object.assign(net.state, over);
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Early friend offer" })).toBeVisible();
  return net;
};
const sw = (page: Page) => page.getByRole("switch", { name: /^Give the early friend offer/ });
const amount = (page: Page) => page.getByLabel("Early friend amount, rupees");

test("E1 the offer is off by default, the amount shows 100, and who set it last", async ({ page, context }) => {
  await toSettings(page, context);
  await expect(sw(page)).not.toBeChecked();
  await expect(amount(page)).toHaveValue("100");
  await expect(page.getByText("Now off · set by owner@goserve.test, 10 Nov")).toBeVisible();
});

test("E2 turning it on saves it with the amount, and it is still on after a reload", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await sw(page).click();
  await expect(sw(page)).toBeChecked();
  await expect.poll(() => net.state.earlySets).toEqual([{ p_on: true, p_amount_paise: 10000 }]);
  await page.reload();
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  await expect(sw(page)).toBeChecked();
  await expect(page.getByText(/^Now on, ₹100/)).toBeVisible();
});

test("E3 changing the amount to 50 and tapping Save sends 5000 paise", async ({ page, context }) => {
  const net = await toSettings(page, context, { early: { on: true, amount_paise: 10000 } });
  await amount(page).fill("50");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect.poll(() => net.state.earlySets).toEqual([{ p_on: true, p_amount_paise: 5000 }]);
  await expect(page.getByText(/^Now on, ₹50/)).toBeVisible();
});

test("E4 an amount outside 10 to 500 gets a plain line and nothing is sent", async ({ page, context }) => {
  const net = await toSettings(page, context);
  for (const bad of ["9", "501", "", "12.5"]) {
    await amount(page).fill(bad);
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByRole("alert")).toHaveText("Pick a whole number of rupees from 10 to 500.");
  }
  expect(net.state.earlySets).toEqual([]);
});

test("E5 a failed save leaves the switch where the server holds it and shows an error", async ({ page, context }) => {
  const net = await toSettings(page, context);
  net.state.earlyFail = true;
  await sw(page).click();
  await expect(page.getByRole("alert")).toHaveText("Could not save. Try again.");
  await expect(sw(page)).not.toBeChecked();
});

test("E6 turning it off says a promise already given is dropped, and no setting claims it is kept", async ({ page, context }) => {
  await toSettings(page, context, { early: { on: true, amount_paise: 10000 } });
  await expect(page.getByText("Off: the normal menu price. Promises already given are dropped.")).toBeVisible();
  await expect(page.getByText(/is kept/)).toHaveCount(0);
});

for (const theme of ["day", "night"]) {
  test(`E7 the early friend settings have no serious contrast or role violation in ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    await toSettings(page, context);
    expect(await scan(page, ["wcag2a", "wcag2aa"])).toEqual([]);
  });
}

test("E8 turning the offer off works with an empty or wrong amount box, and sends the saved amount", async ({ page, context }) => {
  const net = await toSettings(page, context, { early: { on: true, amount_paise: 5000 } });
  await amount(page).fill("");
  await sw(page).click();
  await expect(sw(page)).not.toBeChecked();
  await expect.poll(() => net.state.earlySets).toEqual([{ p_on: false, p_amount_paise: 5000 }]);
});
