// Story #667 (layer C of #655; boards O0-Welcome and O0b-Code): with the phone code on, the first screen is the mobile number and the code, with Google under it.
// No menu before one of the two. The otp function and Supabase Auth are answered by the test. The code in these tests is the fixed 123456 of story #665.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

async function firstOpen(context: BrowserContext, page: Page, verify: { status: number; body: unknown } = { status: 200, body: { ok: true, phone: "919876543210" } }) {
  const net = await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  const calls = { sends: [] as unknown[], verifies: [] as unknown[] };
  await context.route("https://test.supabase.co/functions/v1/otp/*", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const which = req.url().split("/").pop();
    const body = JSON.parse(req.postData() ?? "{}");
    const answer = which === "send" ? { status: 200, body: { ok: true, expires_in_s: 600 } } : verify;
    (which === "send" ? calls.sends : calls.verifies).push(body);
    return route.fulfill({ status: answer.status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(answer.body) });
  });
  return { net, calls };
}
const title = (page: Page) => page.getByRole("heading", { name: "Where do we reach you?" });

test("S1 first open shows the number screen with Google under it, and no menu", async ({ page, context }) => {
  await firstOpen(context, page);
  await page.goto("/customer/");
  await expect(title(page)).toBeVisible();
  await expect(page.getByLabel("Mobile", { exact: true })).toBeVisible();
  await expect(page.getByText("Your mobile number, then a 6 digit code. The rider calls this number.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send code" })).toBeDisabled();
  await expect(page.getByTestId("google-signin")).toBeVisible();
  await expect(page.getByText("Butter Chicken")).toHaveCount(0);   // no menu before the number or Google
  await expect(page.getByRole("button", { name: "Not now" })).toHaveCount(0);
});

test("S2 a number then the code 123456 opens the app", async ({ page, context }) => {
  const { calls } = await firstOpen(context, page);
  await page.goto("/customer/");
  await page.getByLabel("Mobile", { exact: true }).fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Enter the 6 digit code" })).toBeVisible();
  await expect(page.getByLabel("Digit 1")).toBeEnabled();
  await page.getByLabel("Digit 1").pressSequentially("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(title(page)).toHaveCount(0);
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  expect(calls.sends).toEqual([{ phone: "9876543210" }]);
  expect(calls.verifies).toEqual([{ phone: "9876543210", code: "123456" }]);
});

test("S3 a wrong code shows the line and stays on the code screen, with no menu", async ({ page, context }) => {
  await firstOpen(context, page, { status: 422, body: { ok: false, error: "wrong_code", message: "That code is not right." } });
  await page.goto("/customer/");
  await page.getByLabel("Mobile", { exact: true }).fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("Digit 1")).toBeEnabled();
  await page.getByLabel("Digit 1").pressSequentially("111111");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("alert")).toHaveText("That code is not right.");
  await expect(page.getByText("Butter Chicken")).toHaveCount(0);
});

test("S4 a customer who is already signed in goes straight on", async ({ page, context }) => {
  const { net } = await firstOpen(context, page);
  net.state.anonymous = false;
  await page.goto("/customer/");
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(title(page)).toHaveCount(0);
});

test("S5 with the phone code off the first screen is the menu, as before", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/customer/");
  await expect(page.getByText("Butter Chicken")).toBeVisible();
  await expect(title(page)).toHaveCount(0);
});
