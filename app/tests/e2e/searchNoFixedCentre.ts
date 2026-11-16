// Story 1573: a customer with no place at all (no phone place, no saved address, no kitchen on screen) types a town and its state.
// The search is never centred on a fixed city: the ask carries no centre. Sample towns only. One list of scenarios, run by Chromium and by WebKit.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

const hit = (served: boolean) => ({ name: "Sampletown", address: "Sampletown, Samplestate", lat: 12.34, lng: 56.78, pin: "", served, from: "ola" });

export function searchNoFixedCentre() {
  test("No place at all, I type a town and its state: the ask has no centre, the town shows, and a served place has no Not yet", async ({ page, context }) => {
    const net = await setup(context, page, [], { pin: null });
    net.state.places = { status: 200, body: { ok: true, from: "ola", results: [hit(true), hit(false)] } } as typeof net.state.places;
    await page.goto("/customer/");
    await page.getByRole("button", { name: "Search for my address" }).click();
    await page.getByRole("searchbox", { name: "Search an area or address" }).pressSequentially("sampletown samplestate");
    const rows = page.getByRole("region", { name: "Places" }).getByRole("button");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Sampletown");
    await expect(rows.nth(0)).not.toContainText("Not yet");
    await expect(rows.nth(1)).toContainText("Not yet");
    expect(net.calls.places.length).toBeGreaterThan(0);
    for (const url of net.calls.places) {
      const u = new URL(url).searchParams;
      expect(u.has("lat")).toBe(false);
      expect(u.has("lng")).toBe(false);
    }
  });
}
