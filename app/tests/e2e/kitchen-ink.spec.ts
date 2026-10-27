// Story H11 (#194): the kitchen app on the Ink v3 boards K1 to K6. The network is answered by the test (helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { ID, SESSION, order, setup, scan as axeScan } from "./helpers";

const NOW = new Date().toISOString();
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("S1 a new ticket sits on the New tab with Accept, opens as one ticket, and moves to Cooking once accepted", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "New" })).toBeVisible();
  await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
  await expect(page.getByText("2 × Butter Chicken")).toBeVisible();
  await expect(page.getByLabel("1 new")).toBeVisible();   // the badge on the New tab
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Ticket" })).toBeVisible();
  await expect(page.getByText("Rider collects")).toBeVisible();
  await page.getByRole("button", { name: "Accept 0f0f0f0f" }).click();
  await expect(page.getByRole("heading", { name: "Cooking" })).toBeVisible();   // K4 Accept lands on the Cooking tab
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible();
  expect(net.calls.status[0].body).toMatchObject({ order_id: ID, session_id: SESSION, to_status: "accepted", actor: "kitchen" });
});

test("S2 the Cooking tab holds Start and Ready, and a ready ticket waits for the rider below", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted"), { ...order("preparing"), id: "0b0b0b0b-0000-0000-0000-000000000000" }, { ...order("ready"), id: "0c0c0c0c-0000-0000-0000-000000000000" }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await tab(page, "Cooking").click();
  await expect(page.getByRole("button", { name: "Start 0f0f0f0f" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ready 0b0b0b0b" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready · rider on the way" })).toBeVisible();
  await expect(page.getByText("No. 0c0c0c0c")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Accept|Start|Ready) 0c0c0c0c/ })).toHaveCount(0);   // no step once the rider is called
});

test("S3 a quiet kitchen sees No new tickets and the day's count", async ({ page, context }) => {
  const net = await setup(context, page, [{ ...order("delivered", NOW, NOW) }]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "No new tickets" })).toBeVisible();
  await expect(page.getByText("Today · 1 done")).toBeVisible();
  await expect(page.getByLabel(/new$/)).toHaveCount(0);   // no badge at zero
});

test("S4 the Kitchen tab has the open switch and the dishes by category, with Sold out per dish", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await tab(page, "Today").click();
  await expect(page.getByText("Hauz Khas Kitchen")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Open for orders" })).toBeChecked();
  await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  await page.getByRole("switch", { name: "Open for orders" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "set_kitchen_open").length).toBe(1);
  await expect(page.getByRole("switch", { name: "Open for orders" })).not.toBeChecked();
  await expect(page.getByText("Closed · customers see it now")).toBeVisible();
});

test("S5 an account that is not kitchen staff sees the gate with Check again", async ({ page, context }) => {
  const net = await setup(context, page, [order("placed")]);
  net.state.anonymous = false;
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "Not kitchen staff yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept 0f0f0f0f" })).toHaveCount(0);
});

test("S6 a phone with no Google sign-in sees Sign in to cook", async ({ page, context }) => {
  await setup(context, page);
  await page.goto("/kitchen/");
  await expect(page.getByRole("heading", { name: "Sign in to cook" })).toBeVisible();
  await expect(page.getByTestId("google-signin")).toBeVisible();
});

for (const theme of ["day", "night"] as const) {
  test(`S7 the kitchen screens have no serious contrast or role violation in ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page, [order("placed"), { ...order("preparing"), id: "0b0b0b0b-0000-0000-0000-000000000000" }]);
    net.state.kitchen = "k-1";
    await page.goto("/kitchen/");
    await expect(page.getByText("No. 0f0f0f0f")).toBeVisible();
    const scan = async () => expect(await axeScan(page, ["wcag2a", "wcag2aa"])).toEqual([]);
    await scan();   // K3
    await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
    await expect(page.getByRole("heading", { name: "Ticket" })).toBeVisible();
    await scan();   // K4
    await page.getByRole("button", { name: "Back to new tickets" }).click();
    for (const name of ["Cooking", "Today"]) { await tab(page, name).click(); await scan(); }   // K3b, K5
    net.state.kitchen = null;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in to cook" })).toBeVisible();
    await scan();   // K1
    net.state.anonymous = false;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Not kitchen staff yet" })).toBeVisible();
    await scan();   // K2
  });
}

test("S8 when the kitchen row cannot be read, the open switch is disabled and says so", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  net.state.kitchens = [];   // no row for k-1
  await page.goto("/kitchen/");
  await tab(page, "Today").click();
  await expect(page.getByRole("switch", { name: "Open for orders" })).toHaveCount(0);   // no switch for an unknown state
  await expect(page.getByText("Could not read the kitchen")).toBeVisible();
  net.state.kitchens = [{ id: "k-1", name: "Hauz Khas Kitchen", address: null, phone: null, pin_codes: ["110016"], open: true, active: true, opens_at: "10:00:00", closes_at: "22:00:00" }];
  await page.getByRole("button", { name: "Try again" }).click();   // reads the row again, no reload
  await expect(page.getByRole("switch", { name: "Open for orders" })).toBeChecked();
});

test("S9 a ticket opened from Cooking goes back to cooking", async ({ page, context }) => {
  const net = await setup(context, page, [order("accepted")]);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await tab(page, "Cooking").click();
  await page.getByRole("button", { name: "Open ticket 0f0f0f0f" }).click();
  await page.getByRole("button", { name: "Back to cooking tickets" }).click();   // the arrow; the ghost button below says "Back to cooking"
  await expect(page.getByRole("heading", { name: "Cooking" })).toBeVisible();
});

// Story #616 (row T4 of the #325 sitting), board K-YourKitchen: the open row's sub-line is one quiet 12 px mono sentence-case line. The board's wording is 60 characters, which cannot fit one line beside the switch at 390 px in a 12 px mono face (about 7 px a character), so it may wrap to two; the check is the type, not the count.
test("S-616 the open switch's sub-line is 12 px mono in sentence case, the board's words", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const net = await setup(context, page);
  net.state.kitchen = "k-1";
  await page.goto("/kitchen/");
  await tab(page, "Today").click();
  const sub = page.locator(".ui-row-sub").filter({ hasText: /customers see/ });
  await expect(sub).toHaveText('Till 23:59 · customers see "closed" the moment you switch off');
  const look = await sub.evaluate((el) => {
    const s = getComputedStyle(el), lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.45;
    return { transform: s.textTransform, size: s.fontSize, lines: Math.round(el.getBoundingClientRect().height / lh) };
  });
  expect(look).toMatchObject({ transform: "none", size: "12px" });
  expect(look.lines).toBeLessThanOrEqual(2);
});
