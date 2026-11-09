// Story 875 (epic E32), boards A-AddPerson-Invite (I1) and A-Kitchen-Invite (I2): the admin adds a person by email before their first sign-in.
// The network is answered by the test (helpers.ts); the database side is proved in scripts/test_staff_invites.py.
import { test, expect, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const KITCHENS = [
  { id: "k-1", name: "Tau Ka Dhaba", address: "C-4, Lajpat Nagar II", phone: "9876500011", pin_codes: ["110024", "110025"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" },
  { id: "k-2", name: "Amma's Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: null, closes_at: null },
];
const INVITE = { id: "i-9", email: "sunita.devi@gmail.com", kind: "kitchen", kitchen_id: "k-1", kitchen_name: "Tau Ka Dhaba", created_at: "2026-11-04T10:00:00Z" };
const city = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click(); };
const fillCook = async (page: Page, email: string) => {
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role").selectOption("kitchen");
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByRole("button", { name: "Add person" }).click();
};

test("S1 an email with no account becomes an invite: the box says Invite ready and offers the link", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.inviteOnAdd = true;
  await city(page);
  await fillCook(page, "Sunita.Devi@gmail.com");
  const box = page.getByRole("status").filter({ hasText: "Invite ready" });
  await expect(box).toContainText("Invite ready for sunita.devi@gmail.com");
  await expect(box).toContainText("Nothing to install");
  await expect(box).not.toContainText(/\b(she|he|her|his)\b/i);   // the invitee's pronouns are not known
  await expect(box).toContainText("/kitchen/");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("S2 Share the link opens the phone's share sheet with the kitchen link", async ({ page, context }) => {
  await context.addInitScript(() => { (window as any).__shared = []; (navigator as any).share = async (d: unknown) => { (window as any).__shared.push(d); }; });
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.inviteOnAdd = true;
  await city(page);
  await fillCook(page, "sunita.devi@gmail.com");
  await page.getByRole("button", { name: "Share the link" }).click();
  const shared = await page.evaluate(() => (window as any).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].url).toMatch(/\/kitchen\/$/);
});

test("S3 with no share sheet the link is copied and the box says so", async ({ page, context }) => {
  await context.addInitScript(() => { (window as any).__copied = []; Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => { (window as any).__copied.push(t); } }, configurable: true }); });
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.inviteOnAdd = true;
  await city(page);
  await fillCook(page, "sunita.devi@gmail.com");
  await page.getByRole("button", { name: "Share the link" }).click();
  await expect(page.getByText("Link copied.")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copied)).toEqual([expect.stringMatching(/\/kitchen\/$/)]);
});

test("S4 a rider invite points to the rider app", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.inviteOnAdd = true;
  await city(page);
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByLabel("Email").fill("amit@example.com");
  await page.getByLabel("Role").selectOption("rider");
  await page.getByRole("button", { name: "Add person" }).click();
  const box = page.getByRole("status").filter({ hasText: "Invite ready" });
  await expect(box).toContainText("Invite ready for amit@example.com");
  await expect(box).toContainText("/rider/");
});

test("S5 a person who already has an account joins at once: no invite box", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  await city(page);
  await fillCook(page, "old.cook@example.com");
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "admin_add_person").length).toBe(1);
  await expect(page.getByText("Invite ready")).toHaveCount(0);
});

test("S6 the kitchen's staff list shows an invited person with the Invited tag and a Cancel that deletes the invite", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.people = [{ kind: "kitchen", user_id: "u-1", email: "raju@example.com", kitchen_id: "k-1", kitchen_name: "Tau Ka Dhaba" }];
  net.state.invites = [INVITE];
  await city(page);
  await expect(page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ })).toContainText("1 invited");
  await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
  const staff = page.getByRole("region", { name: "Staff" });
  await expect(staff).toContainText("1 · 1 invited");
  await expect(staff).toContainText("sunita.devi@gmail.com");
  await expect(staff).toContainText("not signed in yet");
  await expect(staff.getByText("Invited", { exact: true })).toBeVisible();
  await staff.getByRole("button", { name: "Cancel the invite for sunita.devi@gmail.com" }).click();
  await expect.poll(() => net.calls.rpc.find((c) => c.name === "admin_cancel_invite")?.body).toEqual({ p_id: "i-9" });
  await expect(staff).not.toContainText("sunita.devi@gmail.com");
  await expect(staff).toContainText("raju@example.com");
});

test("S7 an invited rider is listed with the Invited tag and can be cancelled", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.invites = [{ ...INVITE, id: "i-8", email: "amit@example.com", kind: "rider", kitchen_id: null, kitchen_name: null }];
  await city(page);
  const riders = page.getByRole("region", { name: "Riders" });
  await expect(riders).toContainText("amit@example.com");
  await expect(riders.getByText("Invited", { exact: true })).toBeVisible();
  await riders.getByRole("button", { name: "Cancel the invite for amit@example.com" }).click();
  await expect.poll(() => net.calls.rpc.find((c) => c.name === "admin_cancel_invite")?.body).toEqual({ p_id: "i-8" });
  await expect(riders).not.toContainText("amit@example.com");
});

test("S8 an account that already works for another kitchen is refused and the line names that kitchen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.rpcError = { name: "admin_add_person", message: "already_staff", details: "Amma's Kitchen" };
  await city(page);
  await fillCook(page, "old.cook@example.com");
  await expect(page.getByRole("alert")).toHaveText("This person already works for Amma's Kitchen. Remove them there first.");
});

test("S9 the first load of the kitchen app claims a waiting invite and opens the kitchen", async ({ page, context }) => {
  const net = await setup(context, page, []);
  net.state.anonymous = false;
  net.state.claimGrant = "kitchen";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "No new tickets" })).toBeVisible();   // the kitchen app opened
  expect(net.calls.rpc.filter((c) => c.name === "claim_my_invites")).toHaveLength(1);
  expect(net.state.kitchen).toBe("k-1");
});

test("S10 the first load of the rider app claims a waiting invite and opens the rider app", async ({ page, context }) => {
  const net = await setup(context, page, []);
  net.state.anonymous = false;
  net.state.rider = null;
  net.state.claimGrant = "rider";
  await page.goto("/rider/");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();   // the rider app opened
  expect(net.calls.rpc.filter((c) => c.name === "claim_my_invites")).toHaveLength(1);
});

test("S11 with no invite waiting the gate still says the account is not staff, after one claim try", async ({ page, context }) => {
  const net = await setup(context, page, []);
  net.state.anonymous = false;
  await page.goto("/kitchen/");
  await expect(page.getByText("Not kitchen staff yet")).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "claim_my_invites")).toHaveLength(1);
});

test("S12 a guest on the kitchen sign-in page does not call the claim (no email yet)", async ({ page, context }) => {
  const net = await setup(context, page, [], { guest: true });
  await page.goto("/kitchen/");
  await expect(page.getByTestId("google-signin")).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "claim_my_invites")).toHaveLength(0);
});

for (const theme of ["day", "night"] as const) {
  test(`S13 the invite box and the invited rows have no serious contrast or role violation in ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page);
    net.state.admin = true;
    net.state.kitchens = KITCHENS;
    net.state.invites = [INVITE];
    net.state.inviteOnAdd = true;
    await city(page);
    const scan = async () => expect(await axeScan(page, ["wcag2a", "wcag2aa"])).toEqual([]);
    await fillCook(page, "new.cook@example.com");
    await expect(page.getByText("Invite ready for new.cook@example.com")).toBeVisible();
    await scan();   // I1
    await page.getByRole("button", { name: /^Open kitchen Tau Ka Dhaba/ }).click();
    await expect(page.getByText("not signed in yet").first()).toBeVisible();
    await scan();   // I2
  });
}

// Story #968: the same invite for a second admin. The database side is proved in scripts/test_admin_invite.py.
const fillAdmin = async (page: Page, email: string) => {
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role").selectOption("admin");
  await page.getByRole("button", { name: "Add person" }).click();
};

test("S9 (#968) an admin email with no account becomes an invite: the box has the admin link and words, and People lists it as Invited", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.inviteOnAdd = true;
  await city(page);
  await fillAdmin(page, "Second.Admin@gmail.com");
  const box = page.getByRole("status").filter({ hasText: "Invite ready" });
  await expect(box).toContainText("Invite ready for second.admin@gmail.com");
  await expect(box).toContainText("/admin/");
  await expect(box).toContainText("Open this link and tap Continue with Google to run GoServe as an admin.");
  await expect(box).not.toContainText(/\b(she|he|her|his)\b/i);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".ui-row", { hasText: "second.admin@gmail.com" }).getByText("Invited", { exact: true })).toBeVisible();
});

test("S10 (#968) Share the link sends the admin link and the admin words", async ({ page, context }) => {
  await context.addInitScript(() => { (window as any).__shared = []; (navigator as any).share = async (d: unknown) => { (window as any).__shared.push(d); }; });
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.inviteOnAdd = true;
  await city(page);
  await fillAdmin(page, "second.admin@gmail.com");
  await page.getByRole("button", { name: "Share the link" }).click();
  const shared = await page.evaluate(() => (window as any).__shared[0]);
  expect(shared.url).toMatch(/\/admin\/$/);
  expect(shared.text).toBe("Open this link and tap Continue with Google to run GoServe as an admin.");
});

test("S11 (#968) the admin gate claims a waiting invite before it asks is_admin, so the invited person never sees Not an admin account", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = false;
  net.state.claimGrant = "admin";
  await page.goto("/admin/");
  await expect(page.getByRole("button", { name: "City", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not an admin account" })).toHaveCount(0);
  const names = net.calls.rpc.map((c) => c.name).filter((n) => n === "claim_my_invites" || n === "is_admin");
  expect(names.slice(0, 2)).toEqual(["claim_my_invites", "is_admin"]);
});

test("S12 (#968) with no invite waiting the admin screen still says Not an admin account", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = false;
  await page.goto("/admin/");
  await expect(page.getByRole("heading", { name: "Not an admin account" })).toBeVisible();
  expect(net.calls.rpc.filter((c) => c.name === "claim_my_invites")).toHaveLength(1);
});
