// Story #1049 part 3 (board NK-A, replaces the old pin-code screen): no kitchen serves this pin. "We don't reach here yet", the place, Change location, Tell me when you come here.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

async function noKitchen(page: import("@playwright/test").Page) {
  await page.goto("/customer/");
  await page.getByRole("button", { name: "Type it by hand" }).click();
  await page.getByLabel("Address", { exact: true }).fill("Sector 62, Noida, Uttar Pradesh 201301");
  await page.getByLabel("Pin code").fill("110099");
  await page.getByRole("button", { name: "See the menu" }).click();
}
const screen = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "No kitchen here" });

test("S1 a pin no kitchen serves shows NK-A: the words, the place, Change location, Tell me when you come here, step 4 of 4", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await noKitchen(page);
  await expect(page.getByRole("heading", { name: "We don't reach here yet" })).toBeVisible();
  await expect(screen(page)).toContainText("Step 4 of 4");
  await expect(screen(page)).toContainText("Sector 62");
  await expect(screen(page)).toContainText("Noida, Uttar Pradesh 201301");
  await expect(page.getByRole("button", { name: "Change location" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tell me when you come here" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Not here yet");   // the old pin-code screen is gone
});

test("S2 Tell me when you come here stores the ask with the pin once and says so", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  await noKitchen(page);
  await page.getByRole("button", { name: "Tell me when you come here" }).click();
  await expect(page.getByRole("heading", { name: "You found us early. Thank you." })).toBeVisible();   // story 1129: the founder note takes the place of the old one-liner
  const asks = net.calls.rpc.filter((c) => c.name === "area_request_add_v2");
  expect(asks).toHaveLength(1);
  expect(asks[0].body).toMatchObject({ p_pin: "110099" });
  await expect(page.getByRole("button", { name: "Tell me when you come here" })).toHaveCount(0);   // asked once
});

test("S3 when the ask fails the screen says so in words and the button stays", async ({ page, context }) => {
  const net = await setup(context, page, [], { pin: null });
  net.state.areaRequest = { ok: false, message: "That pin code is not valid." };
  await noKitchen(page);
  await page.getByRole("button", { name: "Tell me when you come here" }).click();
  await expect(page.getByRole("alert")).toContainText("That pin code is not valid.");
  await expect(page.getByRole("button", { name: "Tell me when you come here" })).toBeEnabled();
});

test("S4 Change location goes back to the map", async ({ page, context }) => {
  await setup(context, page, [], { pin: null });
  await noKitchen(page);
  await page.getByRole("button", { name: "Change location" }).click();
  await expect(page.getByRole("region", { name: "Pin map" })).toBeVisible();
});
