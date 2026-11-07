// Story #957 (board A-City-SignOut, canvas row 2p): the City tab ends with a "You" section, so a signed-in admin can leave or switch accounts.
import { test, expect } from "@playwright/test";
import { setup } from "./helpers";

test("S1 the City tab ends with a You section: Signed in as <first name>, the email, Sign out, and the board's line", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.userEmail = "satvik.jain@example.com";
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  const you = page.getByRole("region", { name: "You" });
  await expect(you).toBeVisible();
  await expect(you).toContainText("Signed in as Amit");   // the first name of the Google account
  await expect(you).toContainText("satvik.jain@example.com");
  await expect(you.getByRole("button", { name: /Sign out/ })).toBeVisible();
  await expect(you).toContainText("Sign out brings the Google sign-in back. The city stays as it is.");
  // it is the last section of the City tab
  const last = await page.locator(".ui-group").last().getAttribute("aria-label");
  expect(last).toBe("You");
});

test("S2 Sign out ends the session and the admin app asks for the Google sign-in again", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.userEmail = "satvik.jain@example.com";
  const logout: string[] = [];
  await context.route("https://test.supabase.co/auth/v1/logout**", (r) => { logout.push(r.request().method()); net.state.anonymous = true; net.state.admin = false; return r.fallback(); });
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("region", { name: "You" }).getByRole("button", { name: /Sign out/ }).click();
  await expect(page.getByRole("heading", { name: "Sign in to run the city" })).toBeVisible();
  expect(logout).toEqual(["POST"]);
});

test("S3 the You section is only on the City list, not inside a kitchen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await page.goto("/admin/");
  await page.getByRole("button", { name: "City", exact: true }).click();
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await expect(page.getByRole("region", { name: "You" })).toHaveCount(0);
});
