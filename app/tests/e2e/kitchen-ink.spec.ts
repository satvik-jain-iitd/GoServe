// Story H11 (#194): the kitchen app on the Ink v3 boards K1 to K6. The network is answered by the test (helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ID, SESSION, order, setup } from "./helpers";

const NOW = new Date().toISOString();
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("S1 a new ticket sits on the New tab with Accept, opens as one ticket, and moves to Cooking once accepted", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "New" })).toBeVisible();
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  await expect(page.getByText("2 × Butter Chicken")).toBeVisible();
  await expect(page.getByLabel("1 new")).toBeVisible();   // the badge on the New tab
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Ticket" })).toBeVisible();
  await expect(page.getByText("Rider collects")).toBeVisible();
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Cooking" })).toBeVisible();   // K4 Accept lands on the Cooking tab
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible();
  expect(net.calls.status[0].body).toMatchObject({ order_id: ID, session_id: SESSION, to_status: "accepted", actor: "kitchen" });
});

test("S2 the Cooking tab holds Start and Ready, and a ready ticket waits for the rider below", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted"), { ...order("preparing"), id: "0b0b0b0b-0000-0000-0000-000000000000" }, { ...order("ready"), id: "0c0c0c0c-0000-0000-0000-000000000000" }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await tab(page, "Cooking").click();
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ready 0b0b0b0b" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready · rider on the way" })).toBeVisible();
  await expect(page.getByText("No. 0c0c0c0c")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Accept|Start|Ready) 0c0c0c0c/ })).toHaveCount(0);   // no step once the rider is called
});

test("S3 a quiet kitchen sees No new tickets and the day's count", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("delivered", NOW, NOW) }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "No new tickets" })).toBeVisible();
  await expect(page.getByText("Today · 1 done")).toBeVisible();
});

test("S4 the Kitchen tab has the open switch and the dishes by category, with Sold out per dish", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await tab(page, "Kitchen").click();
  await expect(page.getByText("Hauz Khas Kitchen")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Open for orders" })).toBeChecked();
  await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  await page.getByRole("switch", { name: "Open for orders" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "set_kitchen_open").length).toBe(1);
  await expect(page.getByRole("switch", { name: "Open for orders" })).not.toBeChecked();
  await expect(page.getByText("Closed · customers see it now")).toBeVisible();
});

test("S5 an account that is not kitchen staff sees the gate with Check again", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.anonymous = false;
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "Not kitchen staff yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept 0f0f0f0f" })).toHaveCount(0);
});

test("S6 a phone with no Google sign-in sees Sign in to cook", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "Sign in to cook" })).toBeVisible();
  await expect(page.getByTestId("google-signin")).toBeVisible();
});

for (const theme of ["day", "night"] as const) {
  test(`S7 the kitchen screens have no serious contrast or role violation in ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page, [order("placed"), { ...order("preparing"), id: "0b0b0b0b-0000-0000-0000-000000000000" }]);
    net.state.kitchen = "k-1";
    await page.goto("/kitchen/");
    await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
    for (const name of [null, "Cooking", "Kitchen"]) {
      if (name) await tab(page, name).click();
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    }
  });
}
