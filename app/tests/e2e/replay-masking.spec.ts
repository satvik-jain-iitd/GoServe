// Story #739: session replay (dev only, key-gated) must never show a name, a phone or an address. The three places that show them carry the class
// `ph-no-capture`, which PostHog blocks in a recording; inputs are masked by the SDK option maskAllInputs (unit test in analytics.test.ts).
import { test, expect } from "@playwright/test";
import { order, setup } from "./helpers";

const MENU = [{ id: "d2", name: "Dal Makhani", price_paise: 22000, image_url: null, image_credit: null, veg: true, category: "Main" }];

test("S1 the Bill's details form is blocked in a replay", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.menu = MENU;
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Add Dal Makhani" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await expect(page.getByLabel("Address · food gets delivered here")).toBeVisible();
  await expect(page.locator("form.ui-form")).toHaveClass(/ph-no-capture/);
});

test("S2 the You screen's delivery details are blocked in a replay", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await page.getByRole("button", { name: "You" }).click();
  await expect(page.getByRole("region", { name: "Delivery details" })).toHaveClass(/ph-no-capture/);
});

test("S3 the tracker's address line is blocked in a replay", async ({ page, context }) => {
  await setup(context, page, [order("preparing", "2020-01-01T10:02:00Z")]);
  await page.goto("/customer/");
  await expect(page.getByText("Flat 4, Green Park")).toHaveClass(/ph-no-capture/);
});
