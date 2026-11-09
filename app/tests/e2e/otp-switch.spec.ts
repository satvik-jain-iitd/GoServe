// Story 829 (board O0g-B-GoogleFirst): the phone code login is a switch. Off, the welcome screen is Continue with Google only; on, it is today's screen.
// A signed-out customer is `guest: true` in setup(); every other spec is signed in, as every customer on the menu is.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

async function open(context: BrowserContext, page: Page, otp: boolean | null | "down", signedIn = false) {
  const net = await setup(context, page, [], { guest: !signedIn });
  net.state.otpLogin = otp;
  await page.goto("/customer/");
  return net;
}
const noPhoneParts = async (page: Page) => {
  await expect(page.getByLabel("Mobile", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send code" })).toHaveCount(0);
  await expect(page.getByText("Sign in with this number")).toHaveCount(0);
  await expect(page.getByText("Use another number")).toHaveCount(0);
  await expect(page.locator(".otp-boxes")).toHaveCount(0);
};

test("S1 with the switch off the welcome screen is Continue with Google only, and the menu is behind it", async ({ page, context }) => {
  await open(context, page, false);
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible();
  await expect(page.getByText("No password, no code to wait for.")).toHaveCount(0);   // story #1044
  const google = page.getByTestId("google-signin");
  await expect(google).toBeVisible();
  await expect(google).toHaveClass(/\bbig\b/);
  await expect(google).not.toHaveClass(/\bghost\b/);
  await expect(page.getByText("We ask for your mobile number on the bill, so the rider can call you.")).toHaveCount(0);   // story #1044
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  await noPhoneParts(page);
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toHaveCount(0);
});

test("S2 with the switch on the welcome screen is today's screen", async ({ page, context }) => {
  await open(context, page, true);
  await expect(page.getByRole("heading", { name: "Where do we reach you?" })).toBeVisible();
  await expect(page.getByLabel("Mobile", { exact: true })).toBeVisible();
  await expect(page.getByTestId("google-signin")).toHaveClass(/\bghost\b/);
});

test("S3 when the setting cannot be read the screen is Google only, never blank", async ({ page, context }) => {
  await open(context, page, "down");
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible();
  await noPhoneParts(page);
});

test("S3b a missing row is the same as off", async ({ page, context }) => {
  await open(context, page, null);
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible();
});

test("S4 a flip while the app is open changes the screen without a reload, inside 10 seconds", async ({ page, context }) => {
  const net = await open(context, page, false);
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible();
  net.state.otpLogin = true;
  await expect(page.getByRole("heading", { name: "Where do we reach you?" })).toBeVisible({ timeout: 10_000 });
  net.state.otpLogin = false;
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible({ timeout: 10_000 });
});

test("S5 a customer who is already signed in is untouched by the switch", async ({ page, context }) => {
  await open(context, page, false, true);
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toHaveCount(0);
});

test("S6 with the switch off a Google customer orders without any code: the phone is typed on the bill", async ({ page, context }) => {
  const net = await open(context, page, false, true);
  await page.getByRole("button", { name: "Add Butter Chicken" }).click();
  await page.getByRole("button", { name: /View bill/ }).click();
  await page.getByLabel("Your name").fill("Asha");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Address").fill("Flat 4, Green Park");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("dialog", { name: "Confirm your number" })).toHaveCount(0);
  await expect(page.getByText(/Order placed|Placed|Received/i).first()).toBeVisible();
  expect(net.calls.rpc.some((c) => c.name.startsWith("otp"))).toBe(false);
});
