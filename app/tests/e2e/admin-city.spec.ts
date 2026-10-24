// Story H12 (#195), layer 2: the City boards A5 (city), A6 (one kitchen) and A7 (add a kitchen). The network is answered by the test (helpers.ts).
import { test, expect, type Page } from "@playwright/test";
import { setup, scan as axeScan } from "./helpers";

const city = async (page: Page) => { await page.goto("/admin/"); await page.getByRole("button", { name: "City", exact: true }).click(); };
const KITCHENS = [
  { id: "k-1", name: "Hauz Khas Kitchen", address: "C-4, Hauz Khas", phone: "9876500011", pin_codes: ["110016", "110017"], open: true, active: true, opens_at: "11:00:00", closes_at: "22:00:00" },
  { id: "k-2", name: "Rohini Kitchen", address: null, phone: null, pin_codes: ["110085"], open: false, active: true, opens_at: null, closes_at: null },
];

test("S1 City lists the kitchens with Open or Closed and the riders with Online or Offline", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.people = [{ kind: "kitchen", user_id: "u-1", email: "sunita@example.com", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen" }, { kind: "rider", user_id: "r-1", email: "amit@example.com", kitchen_id: null, kitchen_name: null }];
  net.state.riders = [{ user_id: "r-1", name: "Amit Kumar", phone: "9810011223", online: true }, { user_id: "r-2", name: "Deepak Singh", phone: null, online: false }];
  await city(page);
  await expect(page.getByRole("heading", { name: "City", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kitchens" })).toContainText("1 open · 1 closed");
  await expect(page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ })).toContainText("Open");
  await expect(page.getByRole("button", { name: /^Open kitchen Rohini Kitchen/ })).toContainText("Closed");
  await expect(page.getByRole("region", { name: "Riders" })).toContainText("1 online · 1 off");
  await expect(page.getByText("Amit Kumar")).toBeVisible();
  await expect(page.getByText("Deepak Singh")).toBeVisible();
});

test("S2 one kitchen shows its details, staff, menu and a Call button; the menu tools keep their names", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = KITCHENS;
  net.state.people = [{ kind: "kitchen", user_id: "u-1", email: "sunita@example.com", kitchen_id: "k-1", kitchen_name: "Hauz Khas Kitchen" }];
  await city(page);
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await expect(page.getByRole("heading", { name: "Hauz Khas Kitchen" })).toBeVisible();
  await expect(page.getByText("110016 · 110017")).toBeVisible();
  await expect(page.getByText("11:00 to 22:00")).toBeVisible();
  await expect(page.getByRole("region", { name: "Staff" })).toContainText("sunita@example.com");
  await expect(page.getByRole("region", { name: "Menu" })).toContainText("Butter Chicken");
  await page.getByRole("button", { name: "Mark Butter Chicken sold out" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  await expect(page.getByRole("link", { name: "Call Hauz Khas Kitchen" })).toHaveAttribute("href", "tel:9876500011");
  await page.getByRole("button", { name: "Back to city" }).click();
  await expect(page.getByRole("heading", { name: "City", exact: true })).toBeVisible();
});

test("S3 Add a kitchen opens the form; a complete kitchen is sent", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await city(page);
  await page.getByRole("button", { name: "Add a kitchen" }).click();
  await expect(page.getByRole("heading", { name: "Add a kitchen" })).toBeVisible();
  await page.getByLabel("Kitchen name").fill("Punjab Rasoi");
  await page.getByLabel("Address").fill("A-12, Greater Kailash I");
  await page.getByLabel("Phone").fill("9810022334");
  await page.getByLabel("Pin codes").fill("110048");
  await page.getByRole("button", { name: "Add kitchen" }).click();
  await expect.poll(() => net.calls.kitchenWrites.length).toBe(1);
  expect(net.calls.kitchenWrites[0].body).toMatchObject({ name: "Punjab Rasoi", pin_codes: ["110048"] });
  await expect(page.getByRole("heading", { name: "City", exact: true })).toBeVisible();   // back on the city after the save
});

test("S4 Add a person opens the form under the riders; a dish can be added from one kitchen", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  await city(page);
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByLabel("Email").fill("cook@example.com");
  await page.getByLabel("Role").selectOption("kitchen");
  await page.getByLabel("Kitchen", { exact: true }).selectOption("k-1");
  await page.getByRole("button", { name: "Add person" }).click();
  await expect.poll(() => net.calls.rpc.filter((c) => c.name === "admin_add_person").length).toBe(1);
  await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
  await page.getByRole("button", { name: "Add a dish" }).click();
  await page.getByLabel("Dish name").fill("Dal Makhani");
  await page.getByLabel("Price (₹)").fill("220");
  await page.getByRole("button", { name: "Add dish" }).click();
  await expect.poll(() => net.calls.menuWrites.length).toBe(1);
  expect(net.calls.menuWrites[0].body).toMatchObject({ kitchen_id: "k-1", name: "Dal Makhani", price_paise: 22000 });
});

for (const theme of ["day", "night"] as const) {
  test(`S5 the City screens have no serious contrast or role violation in ${theme}`, async ({ page, context }) => {
    await context.addInitScript((v) => localStorage.setItem("gs-theme", v), theme);
    const net = await setup(context, page);
    net.state.admin = true;
    net.state.kitchens = KITCHENS;
    net.state.riders = [{ user_id: "r-1", name: "Amit Kumar", phone: "9810011223", online: true }];
    await city(page);
    const scan = async () => expect(await axeScan(page, ["wcag2a", "wcag2aa"])).toEqual([]);
    await expect(page.getByText("Amit Kumar")).toBeVisible();
    await scan();   // A5
    await page.getByRole("button", { name: /^Open kitchen Hauz Khas Kitchen/ }).click();
    await expect(page.getByRole("heading", { name: "Hauz Khas Kitchen" })).toBeVisible();
    await scan();   // A6
    await page.getByRole("button", { name: "Back to city" }).click();
    await page.getByRole("button", { name: "Add a kitchen" }).click();
    await expect(page.getByRole("heading", { name: "Add a kitchen" })).toBeVisible();
    await scan();   // A7
  });
}

test("S6 when the riders cannot be read the City says so and offers Try again; Delete and Remove ask first", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.ridersFail = true;
  net.state.people = [{ kind: "rider", user_id: "r-9", email: "rider@example.com", kitchen_id: null, kitchen_name: null }];
  await city(page);
  await expect(page.getByText("Could not read the riders.")).toBeVisible();
  await expect(page.getByText("Offline", { exact: true })).toHaveCount(0);   // unknown is not shown as offline
  net.state.ridersFail = false;
  net.state.riders = [{ user_id: "r-9", name: "Amit Kumar", phone: null, online: true }];
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Amit Kumar")).toBeVisible();
  page.on("dialog", (d) => void d.dismiss());   // a No on the confirm sends nothing
  await page.getByRole("button", { name: "Remove rider@example.com" }).click();
  await page.waitForTimeout(300);
  expect(net.calls.rpc.filter((c) => c.name === "admin_remove_person")).toHaveLength(0);
});

test("S7 a kitchen taken out of the system says Off, not Closed", async ({ page, context }) => {
  const net = await setup(context, page);
  net.state.admin = true;
  net.state.kitchens = [...KITCHENS, { id: "k-3", name: "Old Kitchen", address: null, phone: null, pin_codes: [], open: true, active: false, opens_at: null, closes_at: null }];
  await city(page);
  await expect(page.getByRole("button", { name: /^Open kitchen Old Kitchen/ })).toContainText("Off");
  await expect(page.getByRole("button", { name: /^Open kitchen Rohini Kitchen/ })).toContainText("Closed");
});
