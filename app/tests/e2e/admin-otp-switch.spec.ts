// Story 829: the admin flips the phone code login in the admin panel. It is off until an SMS provider is live.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

async function toSettings(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext) {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "Numbers", exact: true }).click();
  return net;
}

test("S1 the switch shows Phone code login, off, with the line that says why", async ({ page, context }) => {
  await toSettings(page, context);
  const sw = page.getByRole("switch", { name: /Phone code login/ });
  await expect(sw).toBeVisible();
  await expect(sw).not.toBeChecked();
  await expect(page.getByText("Needs an SMS provider. Off until one is live.")).toBeVisible();
});

test("S2 flipping it sends the new value and the switch stays on", async ({ page, context }) => {
  const net = await toSettings(page, context);
  await page.getByRole("switch", { name: /Phone code login/ }).click();
  await expect(page.getByRole("switch", { name: /Phone code login/ })).toBeChecked();
  expect(net.calls.rpc.filter((c) => c.name === "otp_login_set_v2").map((c) => c.body)).toEqual([{ p_on: true }]);
});

test("S3 a refused save puts the switch back and says so in a plain line", async ({ page, context }) => {
  const net = await toSettings(page, context);
  net.state.rpcError = { name: "otp_login_set_v2", message: "not_admin" };
  await page.getByRole("switch", { name: /Phone code login/ }).click();
  await expect(page.getByText("Could not save. Try again.")).toBeVisible();
  await expect(page.getByRole("switch", { name: /Phone code login/ })).not.toBeChecked();
});
