// Story #616 (row T4): the owner saw the Open for orders knob spill past the track on an iPhone. This runs the switch in WebKit (iPhone 13), on and off.
// Cause (pinned in WebKit, iPhone 13, 28 Oct 2026): the switch is a flex item beside a long label and WebKit shrinks it from 52 px to 36 px, so the 24 px knob and its 20 px slide pass the right edge. The track must keep its 52 px.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 WebKit: the knob sits inside the track, on and off, with air on both sides", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await page.getByRole("button", { name: "Today" }).or(page.getByRole("link", { name: "Today" })).first().click();
  const sw = page.getByRole("switch", { name: "Open for orders" });
  await expect(sw).toBeChecked();
  const geometry = () => sw.evaluate((el) => {
    const b = getComputedStyle(el, "::before"), track = el as HTMLInputElement;
    const x = new DOMMatrix(b.transform === "none" ? undefined : b.transform).m41;
    const left = parseFloat(b.left) + x, right = left + parseFloat(b.width);
    return { left, rightAir: track.clientWidth - right, leftAir: left, appearance: getComputedStyle(el).appearance };
  });
  await expect(sw).toHaveJSProperty("offsetWidth", 52);   // not shrunk by the long label
  const on = await geometry();
  expect(on.leftAir).toBeGreaterThanOrEqual(2);
  expect(on.rightAir).toBeGreaterThanOrEqual(2);
  await sw.click();
  // The flip is an RPC answered by the stub, then the screen updates. On CI's WebKit this once stayed checked for 5 s: wait for the call first and say what was seen if it fails.
  const flips = () => net.calls.rpc.filter((c) => c.name === "set_kitchen_open").length;
  try {
    await expect.poll(flips, { timeout: 15_000 }).toBe(1);
    await expect(sw).not.toBeChecked({ timeout: 15_000 });
  } catch (e) {
    const alerts = await page.getByRole("alert").allTextContents();
    throw new Error(`switch did not flip: rpc calls ${JSON.stringify(net.calls.rpc.map((c) => c.name))}, alerts ${JSON.stringify(alerts)}, checked ${await sw.isChecked()}; ${String(e).split("\n")[0]}`);
  }
  const off = await geometry();
  expect(off.leftAir).toBeGreaterThanOrEqual(2);
  expect(off.rightAir).toBeGreaterThanOrEqual(2);
});
