// Story #54: /health. The network is answered by the test (see helpers.ts).
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 all green: OK for Supabase, n8n and Jev, each with a time", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/health");
  await expect(page.getByRole("heading", { name: "Health" })).toBeVisible();
  for (const name of ["Supabase", "n8n", "Jev"]) await expect(page.getByTestId(`check-${name}`)).toContainText("OK");
  await expect(page.getByTestId("check-Jev")).toContainText("310 ms");
  await expect(page.getByTestId("check-Supabase")).toContainText(/\d+ ms|\d\.\d s/);
  await expect(page.getByText("All green")).toBeVisible();
  expect(net.calls.health).toHaveLength(1);
  expect(net.calls.health[0].headers["x-gs-token"]).toBe("demo-token");
});

test("S1 a failing part shows FAIL and why, the others keep their result", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menuUp = false;
  await page.goto("/health");
  await expect(page.getByTestId("check-Supabase")).toContainText("FAIL");
  await expect(page.getByTestId("check-Supabase")).toContainText("Unexpected answer (500).");
  await expect(page.getByTestId("check-n8n")).toContainText("OK");
  await expect(page.getByText("Something failed")).toBeVisible();
});

test("S1 a wrong demo token shows n8n FAIL and Jev not checked", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.reply = { status: 401, body: { ok: false, error: "unauthorized", message: "Missing or wrong demo token." } };
  await page.goto("/health");
  await expect(page.getByTestId("check-n8n")).toContainText("The demo token is wrong.");
  await expect(page.getByTestId("check-Jev")).toContainText("Not checked: n8n failed.");
});

test("S1 Run again checks again", async ({ page, context }) => {
  const net = await setup(context, page);
  await page.goto("/health");
  await expect(page.getByText("All green")).toBeVisible();
  await page.getByRole("button", { name: "Run again" }).click();
  await expect.poll(() => net.calls.health.length).toBe(2);
});
