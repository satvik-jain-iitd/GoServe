// Story 1672 (epic 1652), board k8admin: the admin's Numbers tab has a group "Handover codes" under Login with two switches, each off by default and each alone.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup, openSetting } from "./helpers";

async function toSettings(page: Page, context: BrowserContext) {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await openSetting(page, "Hand-over codes");
  return net;
}
const kitchen = (page: Page) => page.getByRole("switch", { name: /Kitchen handoff code/ });
const customer = (page: Page) => page.getByRole("switch", { name: /Customer handoff code/ });

test("H1 the group sits under Login with two switches, both off, and the lines of the board", async ({ page, context }) => {
  await toSettings(page, context);
  const group = page.getByRole("region", { name: "Handover codes" });
  await expect(group).toBeVisible();
  await expect(kitchen(page)).not.toBeChecked();
  await expect(customer(page)).not.toBeChecked();
  await expect(group.getByText("The rider tells the cook a code at pick up. Off: the rider taps Picked up, as today.")).toBeVisible();
  await expect(group.getByText("The customer tells the rider a code at the door. Off: the rider marks Delivered, as today.")).toBeVisible();
});

test("H2 each switch works alone: the kitchen one sends kitchen, the customer one sends customer", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await kitchen(page).click();
  await expect(kitchen(page)).toBeChecked();
  await expect(customer(page)).not.toBeChecked();
  await customer(page).click();
  await expect(customer(page)).toBeChecked();
  expect(net.calls.rpc.filter((c) => c.name === "handover_switch_set_v1").map((c) => c.body)).toEqual([{ p_which: "kitchen", p_on: true }, { p_which: "customer", p_on: true }]);
});

test("H3 a refused save puts the switch back and says so in a plain line", async ({ page, context }) => {
  const net = await toSettings(page, context);
  net.state.rpcError = { name: "handover_switch_set_v1", message: "not_admin" };
  await kitchen(page).click();
  await expect(page.getByText("Could not save. Try again.")).toBeVisible();
  await expect(kitchen(page)).not.toBeChecked();
});

test("H4 a switch that is on in the database shows on", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.handover = { kitchen: true, customer: false };
  await page.goto("/admin/");
  await openSetting(page, "Hand-over codes");
  await expect(kitchen(page)).toBeChecked();
  await expect(customer(page)).not.toBeChecked();
});
