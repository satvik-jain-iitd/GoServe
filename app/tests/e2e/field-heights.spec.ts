// Story #1020, boards A2-AddressOla and C2-AddressSheet: Label, Address and Pin code look like one family of boxes.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const HOME = { id: "h1", label: "Home", address: "C-4, Green Park Extension, New Delhi", pin_code: "110016", lat: 28.5677, lng: 77.2432, last_used_at: new Date(Date.now() - 3 * 86_400_000).toISOString() };

async function measure(page: Page) {
  const box = async (re: RegExp) => page.getByLabel(re).evaluate((el) => {
    const r = el.getBoundingClientRect(), c = getComputedStyle(el);
    return { h: Math.round(r.height), border: c.borderTopWidth, radius: c.borderTopLeftRadius, padL: c.paddingLeft, bg: c.backgroundColor };
  });
  return { label: await box(/^Label/), address: await box(/^Address/), pin: await box(/^Pin code/) };
}

function same(m: Awaited<ReturnType<typeof measure>>) {
  expect(m.pin.h, "Pin and Label are the same height").toBe(m.label.h);
  expect(m.pin.h, "48 px as drawn").toBeLessThanOrEqual(48);
  expect(m.address.h, "Address is taller than Label (two rows)").toBeGreaterThan(m.label.h);
  for (const k of ["border", "radius", "padL", "bg"] as const) {
    expect(m.pin[k], `pin ${k}`).toBe(m.label[k]);
    expect(m.address[k], `address ${k}`).toBe(m.label[k]);
  }
}

test("S1 on the Add address page Label, Address and Pin code are one family", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Add new address" }).click();
  same(await measure(page));
});

test("S2 on the Edit sheet Label, Address and Pin code are one family", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: "110016" });
  net.state.addresses = [HOME];
  await page.goto("/customer/");
  await page.getByRole("button", { name: /^Home\b/ }).click();
  await page.getByRole("button", { name: "Edit or remove Home" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  same(await measure(page));
});
