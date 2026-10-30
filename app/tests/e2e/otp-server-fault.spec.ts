// Story #786 (E-PWA): a server fault is shown as a server fault. The otp function answers 502 {ok:false,error:"otp_unavailable"} with no message when the code cannot be sent;
// the app used to show the network line for it. Only a lost network (or an answer that is not JSON) shows "Could not reach GoServe."
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { setup } from "./helpers";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

async function sendWith(context: BrowserContext, page: Page, answer: { status: number; body?: unknown; abort?: boolean; text?: string }) {
  await setup(context, page);
  await context.addInitScript(() => { try { localStorage.setItem("gs-otp-gate", "1"); } catch { /* blocked */ } });
  await context.route("https://test.supabase.co/functions/v1/otp/*", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (answer.abort) return route.abort();
    return route.fulfill({ status: answer.status, headers: { ...CORS, "content-type": answer.text ? "text/plain" : "application/json" }, body: answer.text ?? JSON.stringify(answer.body) });
  });
  await page.goto("/customer/");
  await page.getByLabel("Mobile", { exact: true }).fill("9876543210");
  await page.getByRole("button", { name: "Send code" }).click();
  return page.getByRole("alert");
}

test("S1 otp_unavailable without a message says the codes are down, not that the network is lost", async ({ page, context }) => {
  const alert = await sendWith(context, page, { status: 502, body: { ok: false, error: "otp_unavailable" } });
  await expect(alert).toHaveText("Codes are down for a moment. Try again in a minute.");
});

test("S2 an unknown error word without a message says something went wrong on our side", async ({ page, context }) => {
  const alert = await sendWith(context, page, { status: 500, body: { ok: false, error: "brand_new_fault" } });
  await expect(alert).toHaveText("Something went wrong on our side. Try again in a minute.");
});

test("S3 a lost network and an answer that is not JSON still say Could not reach GoServe", async ({ page, context }) => {
  const alert = await sendWith(context, page, { status: 200, abort: true });
  await expect(alert).toHaveText("Could not reach GoServe. Try again.");
});

test("S4 a refusal that has its own message still shows that message", async ({ page, context }) => {
  const alert = await sendWith(context, page, { status: 429, body: { ok: false, error: "too_many_sends", message: "Too many codes. Try again in a few minutes." } });
  await expect(alert).toHaveText("Too many codes. Try again in a few minutes.");
});
