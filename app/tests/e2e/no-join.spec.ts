// Story #938: a link can no longer choose which session a device works in. The wrong person is refused, not just ignored.
import { test, expect } from "@playwright/test";
import { SESSION, order, setup } from "./helpers";

const OTHER = "7e57ab1e-0000-4000-8000-0000000000b2";

for (const path of ["/customer/", "/kitchen/", "/console/"]) {
  test(`S1 ${path}?join= does not join anyone's session and keeps no key`, async ({ page, context }) => {
    const net = await setup(context, page, [order("placed")]);
    net.state.kitchen = "k-1";
    await page.goto(`${path}?join=${OTHER}`);
    await page.waitForLoadState("networkidle");
    expect(net.calls.rpc.filter((c) => c.name === "join_session")).toHaveLength(0);
    expect(await page.evaluate(() => window.localStorage.getItem("gs-joined-session"))).toBeNull();
    expect(net.calls.orderReads.some((u) => u.includes(`session_id=eq.${OTHER}`))).toBe(false);
  });
}

test("S2 a key left by an older version is cleared, and the device uses its own session", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  await context.addInitScript((id) => { try { window.localStorage.setItem("gs-joined-session", id); } catch { /* blocked */ } }, OTHER);
  await page.goto("/customer/");
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => window.localStorage.getItem("gs-joined-session"))).toBeNull();
  expect(net.calls.orderReads.some((u) => u.includes(`session_id=eq.${OTHER}`))).toBe(false);
  expect(net.calls.orderReads.some((u) => u.includes(`session_id=eq.${SESSION}`))).toBe(true);
});

test("S3 the demo console has no copy-link and no reset button", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/console/");
  await expect(page.getByRole("button", { name: "Autopilot" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link for a second device" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset demo" })).toHaveCount(0);
});
