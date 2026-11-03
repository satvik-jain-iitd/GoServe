// Story 842: sign in with Google, sign out, sign in again. The Google leg is faked: /auth/v1/authorize answers with a redirect back to the app carrying a session in the
// address (the implicit return the client library detects), the way GoTrue does. The log of what the app asked, in order, is printed so the loop can be read.
import { test, expect, type Page } from "@playwright/test";
import { setup } from "./helpers";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const googleJwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "7e57ab1e-0000-4000-8000-0000000000a1", role: "authenticated", is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const BACK = `http://localhost:4180/customer/#access_token=${googleJwt}&refresh_token=r2&expires_in=3600&token_type=bearer`;

async function arm(context: import("@playwright/test").BrowserContext, page: Page, net: Awaited<ReturnType<typeof setup>>) {
  const log: string[] = [];
  page.on("request", (r) => { const u = r.url(); if (u.includes("/auth/v1/")) log.push(`${r.method()} ${u.split("/auth/v1/")[1].split("?")[0]}`); });
  await context.route(/test\.supabase\.co\/auth\/v1\/authorize/, (route) => { net.state.anonymous = false; log.push("-> Google, back to the app with a session in the address"); return route.fulfill({ status: 302, headers: { location: BACK } }); });
  await context.route(/test\.supabase\.co\/auth\/v1\/logout/, (route) => { net.state.anonymous = true; return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" }, body: "" }); });
  return log;
}

test("S1 sign in with Google, sign out, sign in again: the app opens signed in both times, and no extra anonymous user is made by the return", async ({ page, context }) => {
  const net = await setup(context, page, [], { guest: true });
  const log = await arm(context, page, net);
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible();
  await page.getByTestId("google-signin").click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  const signupsAfterFirst = net.calls.signups;
  log.push("== signed in; now You > Sign out");
  await page.getByRole("button", { name: "You" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible();
  log.push("== signed out; Continue with Google again");
  const beforeTap = net.calls.signups;
  await page.getByTestId("google-signin").click();
  await expect(page.getByRole("button", { name: "Add Butter Chicken" })).toBeVisible();
  expect(net.calls.signups).toBe(beforeTap);   // the return itself made no anonymous user; the one per page load is the welcome screen's (see the PR)
  await expect(page.getByRole("alert")).toHaveCount(0);   // a completed sign-in leaves no "did not finish" behind for the next visit
  console.log("REQUEST ORDER\n" + log.join("\n") + `\nanonymous sign-ups: after the first sign-in ${signupsAfterFirst}, at the end ${net.calls.signups}`);
});

test("S2 Google sends the person back with no session and no error: the screen says so, in plain words, and the button is still there", async ({ page, context }) => {
  const net = await setup(context, page, [], { guest: true });
  await context.route(/test\.supabase\.co\/auth\/v1\/authorize/, (route) => route.fulfill({ status: 302, headers: { location: "http://localhost:4180/customer/" } }));   // back, nothing in the address
  await page.goto("/customer/");
  await page.getByTestId("google-signin").click();
  await expect(page.getByRole("alert")).toHaveText("Google sign-in did not finish. Try again.");
  await expect(page.getByTestId("google-signin")).toBeVisible();
  expect(net.state.anonymous).toBe(true);
});

test("S3 a plain first visit says nothing about Google", async ({ page, context }) => {
  await setup(context, page, [], { guest: true });
  await page.goto("/customer/");
  await expect(page.getByRole("heading", { name: "One tap and you are in" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

